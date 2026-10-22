from enum import StrEnum


class DraftType(StrEnum):
    NEW = "new"
    REPLY = "reply"
    FOLLOW_UP = "follow_up"


class Tone(StrEnum):
    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"
    DIRECT = "direct"
    WARM = "warm"


class Length(StrEnum):
    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"


class DraftStatus(StrEnum):
    WRITING = "writing"
    NEEDS_REVIEW = "needs_review"
    APPROVED = "approved"
    FAILED = "failed"


class VersionSource(StrEnum):
    WRITTEN = "written"
    REWRITE = "rewrite"
    EDITED = "edited"


class Step(StrEnum):
    UNDERSTAND = "understand"
    DATE_CHECK = "date_check"
    WRITING = "writing"
    CHECKING = "checking"
    REVIEW = "review"


class StepState(StrEnum):
    ACTIVE = "active"
    DONE = "done"
