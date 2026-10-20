from typing import Protocol


class MailProvider(Protocol):
    async def send(self, recipient: str, subject: str, body: str) -> None: ...


CONNECTORS = {"gmail": {"status": "coming_soon", "label": "Gmail connector"}}
