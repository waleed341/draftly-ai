import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

from langchain.agents import create_agent
from langchain.chat_models import init_chat_model

from app.agents.contracts import TextDelta, ToolCalled, ToolReturned, WriteJob, WriterEvent
from app.agents.prompts import SYSTEM_PROMPT, build_user_prompt
from app.agents.tools import make_date_tool
from app.core.config import Settings

log = logging.getLogger(__name__)


class LangChainDraftWriter:
    """Runs a LangChain agent (model + date tool) and turns its stream into writer events."""

    def __init__(self, settings: Settings) -> None:
        kwargs: dict[str, Any] = {"temperature": settings.llm_temperature}
        if settings.llm_base_url:
            kwargs["base_url"] = settings.llm_base_url
        self._model = init_chat_model(settings.llm_model, **kwargs)
        self._timeout = settings.llm_timeout_seconds

    async def stream(self, job: WriteJob) -> AsyncIterator[WriterEvent]:
        agent = create_agent(
            model=self._model, tools=[make_date_tool(job.time_zone)], system_prompt=SYSTEM_PROMPT
        )
        inputs = {"messages": [{"role": "user", "content": build_user_prompt(job)}]}
        items = agent.astream(inputs, stream_mode="messages").__aiter__()
        deadline = asyncio.get_running_loop().time() + self._timeout
        try:
            while True:
                # The timeout only covers waiting on the model, never the consumer's own work.
                async with asyncio.timeout_at(deadline):
                    item = await anext(items, None)
                if item is None:
                    return
                for event in _to_events(item):
                    yield event
        finally:
            await items.aclose()


def _to_events(item: Any) -> list[WriterEvent]:
    message, metadata = _unpack(item)
    if message is None:
        return []
    node = (metadata or {}).get("langgraph_node")
    events: list[WriterEvent] = []
    if node == "tools":
        events.append(ToolReturned(name=getattr(message, "name", "") or "", output=_text(message.content)))
        return events
    if node == "model":
        for chunk in getattr(message, "tool_call_chunks", None) or []:
            if chunk.get("name"):
                events.append(ToolCalled(name=chunk["name"]))
        text = _text(message.content)
        if text:
            events.append(TextDelta(text=text))
    return events


def _unpack(item: Any) -> tuple[Any, dict | None]:
    if isinstance(item, dict) and item.get("type") == "messages":
        item = item.get("data")
    if isinstance(item, tuple | list) and len(item) == 2:
        return item[0], item[1]
    return None, None


def _text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return ""
