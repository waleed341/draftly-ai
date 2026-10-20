from app.domain.time import safe_zone, today_label


def date_tool_for_timezone(timezone: str):
    from langchain.tools import tool

    zone = safe_zone(timezone)

    @tool
    def get_today_date() -> str:
        """Get the current date and time in the user's time zone."""
        return today_label(zone)

    return get_today_date
