"""What the services need from a writer. Nothing here knows about LangChain."""

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class PreviousVersion:
    subject: str
    body: str


@dataclass(frozen=True, slots=True)
class WriteJob:
    idea: str
    kind: str
    tone: str
    length: str
    time_zone: str
    previous: PreviousVersion | None = None
    instructions: str | None = None


@dataclass(frozen=True, slots=True)
class ToolCalled:
    name: str


@dataclass(frozen=True, slots=True)
class ToolReturned:
    name: str
    output: str


@dataclass(frozen=True, slots=True)
class TextDelta:
    text: str


WriterEvent = ToolCalled | ToolReturned | TextDelta

DATE_TOOL_NAME = "get_today"


class DraftWriter(Protocol):
    def stream(self, job: WriteJob) -> AsyncIterator[WriterEvent]: ...
