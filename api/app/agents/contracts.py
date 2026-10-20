from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class WriteJob:
    idea: str
    timezone: str
    rewrite_from: str | None = None


@dataclass(frozen=True)
class ToolCalled:
    name: str


@dataclass(frozen=True)
class ToolReturned:
    name: str
    value: str


@dataclass(frozen=True)
class TextDelta:
    text: str


class DraftWriter(Protocol):
    async def stream(self, job: WriteJob): ...
