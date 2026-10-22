from langchain_core.tools import BaseTool, tool

from app.agents.contracts import DATE_TOOL_NAME
from app.domain.time import today_label


def make_date_tool(time_zone: str) -> BaseTool:
    """A date tool bound to the person's time zone, so "tomorrow" means their tomorrow."""

    @tool(DATE_TOOL_NAME)
    def get_today() -> str:
        """Return today's date for the person you are writing for. Call this before writing."""
        return f"Today is {today_label(time_zone)} ({time_zone})."

    return get_today
