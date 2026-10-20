import json
from collections.abc import AsyncIterator


async def encode(events: AsyncIterator[dict[str, object]]) -> AsyncIterator[str]:
    async for event in events:
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
