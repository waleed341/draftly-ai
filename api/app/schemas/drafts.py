from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.domain.enums import DraftStatus, DraftType, Length, Tone, VersionSource


def _strip(value: str) -> str:
    return value.strip()


class CreateDraftRequest(BaseModel):
    idea: str = Field(min_length=3, max_length=2000)
    kind: DraftType = DraftType.NEW
    tone: Tone = Tone.PROFESSIONAL
    length: Length = Length.MEDIUM
    time_zone: str = Field(default="UTC", max_length=64)

    _strip_idea = field_validator("idea", mode="before")(lambda v: _strip(v) if isinstance(v, str) else v)


class RewriteRequest(BaseModel):
    instructions: str | None = Field(default=None, max_length=500)
    tone: Tone | None = None
    length: Length | None = None


class EditRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=20000)

    _strip_fields = field_validator("subject", "body", mode="before")(
        lambda v: _strip(v) if isinstance(v, str) else v
    )

    @field_validator("subject")
    @classmethod
    def reject_subject_newlines(cls, value: str) -> str:
        if "\r" in value or "\n" in value:
            raise ValueError("Subject must fit on one line.")
        return value


class ApproveRequest(BaseModel):
    reviewed: bool = False
    to: list[EmailStr] = Field(default_factory=list, max_length=20)
    cc: list[EmailStr] = Field(default_factory=list, max_length=20)
    bcc: list[EmailStr] = Field(default_factory=list, max_length=20)
    gmail_connection_id: int | None = None


class CheckOut(BaseModel):
    key: str
    label: str
    passed: bool
    message: str


class VersionOut(BaseModel):
    number: int
    subject: str
    body: str
    source: VersionSource
    note: str | None
    created_at: datetime


class DraftOut(BaseModel):
    id: int
    idea: str
    kind: DraftType
    tone: Tone
    length: Length
    status: DraftStatus
    created_at: datetime
    updated_at: datetime
    approved_at: datetime | None
    versions: list[VersionOut]
    checks: list[CheckOut]
    blanks: list[str]
    approval_id: int | None = None


class DraftSummary(BaseModel):
    id: int
    idea: str
    subject: str | None
    status: DraftStatus
    kind: DraftType
    version_count: int
    updated_at: datetime


class DraftStats(BaseModel):
    total: int
    needs_review: int
    approved: int


class CheckDraftRequest(BaseModel):
    subject: str = Field(default="", max_length=300)
    body: str = Field(default="", max_length=20000)


class CheckDraftResponse(BaseModel):
    checks: list[CheckOut]
    blanks: list[str]


class ConnectorOut(BaseModel):
    key: str
    name: str
    description: str
    status: str
