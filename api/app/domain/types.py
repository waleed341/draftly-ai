from enum import StrEnum


class DraftStatus(StrEnum):
    WRITING = "writing"
    NEEDS_REVIEW = "needs_review"
    APPROVED = "approved"
    FAILED = "failed"


class DraftStep(StrEnum):
    UNDERSTAND = "understand"
    DATE_CHECK = "date_check"
    WRITING = "writing"
    CHECKING = "checking"
    YOUR_REVIEW = "your_review"
