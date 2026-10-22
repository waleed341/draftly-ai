from dataclasses import dataclass
from typing import Protocol


class MailProvider(Protocol):
    """Saves an approved draft to a mailbox. Nothing is ever sent automatically."""

    key: str

    async def save_draft(self, *, subject: str, body: str) -> str: ...


@dataclass(frozen=True, slots=True)
class ConnectorInfo:
    key: str
    name: str
    description: str
    status: str  # "available" | "coming_soon"


CONNECTORS: list[ConnectorInfo] = [
    ConnectorInfo(
        "gmail", "Gmail connector", "Save approved drafts straight to your Gmail drafts.", "coming_soon"
    ),
    ConnectorInfo("outlook", "Outlook connector", "Save approved drafts to Outlook.", "coming_soon"),
]


def list_connectors() -> list[ConnectorInfo]:
    return list(CONNECTORS)
