from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def safe_zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise ValueError("Please choose a valid time zone.") from exc


def today_label(zone: ZoneInfo) -> str:
    return datetime.now(zone).strftime("%A, %d %B %Y, %I:%M %p %Z")
