from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def utcnow() -> datetime:
    return datetime.now(UTC)


def safe_zone(name: str | None) -> ZoneInfo:
    """The person's time zone, or UTC when it is missing or unknown."""
    if not name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def today_label(zone_name: str | None, now: datetime | None = None) -> str:
    """For example "Tuesday, 20 October 2026"."""
    local = (now or utcnow()).astimezone(safe_zone(zone_name))
    return f"{local:%A}, {local.day} {local:%B %Y}"
