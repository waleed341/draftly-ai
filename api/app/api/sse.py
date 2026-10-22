from collections.abc import AsyncIterator

from fastapi.responses import StreamingResponse
from pydantic import BaseModel


async def _encode(events: AsyncIterator[BaseModel]) -> AsyncIterator[str]:
    async for event in events:
        yield f"data: {event.model_dump_json()}\n\n"


def event_stream(events: AsyncIterator[BaseModel]) -> StreamingResponse:
    return StreamingResponse(
        _encode(events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
