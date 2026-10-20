import asyncio
from collections.abc import AsyncIterator
from typing import Any
from xml.sax.saxutils import escape

from langchain.agents import create_agent
from langchain.chat_models import init_chat_model

from app.agents.contracts import TextDelta, ToolCalled, ToolReturned, WriteJob
from app.agents.prompts import SYSTEM_PROMPT
from app.agents.tools import date_tool_for_timezone
from app.core.config import Settings


def _text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(block.get("text", "") for block in content if isinstance(block, dict) and block.get("type") == "text")
    return ""


class LangChainDraftWriter:
    def __init__(self, settings: Settings):
        kwargs = {"model_provider": "ollama"}
        if settings.ollama_base_url:
            kwargs["base_url"] = settings.ollama_base_url
        self.model = init_chat_model(settings.normalized_model, **kwargs)
        self.timeout = settings.request_timeout_seconds

    async def stream(self, job: WriteJob) -> AsyncIterator[ToolCalled | ToolReturned | TextDelta]:
        agent = create_agent(model=self.model, tools=[date_tool_for_timezone(job.timezone)], system_prompt=SYSTEM_PROMPT)
        prompt = f"<idea>\n{escape(job.idea)}\n</idea>"
        if job.rewrite_from:
            prompt += f"\n\n<previous_version>\n{job.rewrite_from}\n</previous_version>\nWrite a clearly different version."
        called_date = False
        async with asyncio.timeout(self.timeout):
            async for item in agent.astream({"messages": [{"role": "user", "content": prompt}]}, stream_mode="messages"):
                if isinstance(item, tuple):
                    message, metadata = item
                elif isinstance(item, dict) and item.get("type") == "messages":
                    message, metadata = item["data"]
                else:
                    continue
                node = metadata.get("langgraph_node", "")
                name = getattr(message, "name", "") or getattr(message, "additional_kwargs", {}).get("name", "")
                if node == "model":
                    calls = getattr(message, "tool_calls", None) or []
                    chunks = getattr(message, "tool_call_chunks", None) or []
                    if calls or chunks:
                        call_names = [call.get("name", "") for call in calls]
                        call_names.extend(chunk.get("name", "") for chunk in chunks)
                        for call_name in dict.fromkeys(call_names):
                            if call_name:
                                called_date |= call_name == "get_today_date"
                                yield ToolCalled(call_name)
                    else:
                        content = _text_content(getattr(message, "content", ""))
                        if content:
                            yield TextDelta(content)
                elif node == "tools":
                    content = _text_content(getattr(message, "content", "")) or str(getattr(message, "content", ""))
                    if name == "get_today_date":
                        yield ToolReturned(name, content)
        if not called_date:
            yield ToolReturned("get_today_date", date_tool_for_timezone(job.timezone).invoke({}))
