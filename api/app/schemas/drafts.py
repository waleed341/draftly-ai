from typing import Literal

from pydantic import BaseModel, Field


class DraftCreate(BaseModel):
    idea: str = Field(min_length=1, max_length=10_000)
    timezone: str = "UTC"


class DraftEdit(BaseModel):
    subject: str = Field(max_length=500)
    body: str = Field(max_length=20_000)


class Approval(BaseModel):
    reviewed: bool


class SafetyCheckRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)


class VersionOut(BaseModel):
    number: int
    subject: str
    body: str
    source: str
    created_at: str


class DraftOut(BaseModel):
    id: str
    idea: str
    timezone: str
    status: str
    subject: str
    body: str
    checks: list[dict[str, object]]
    versions: list[VersionOut]
    created_at: str
    updated_at: str


class StartedEvent(BaseModel):
    type: Literal["started"] = "started"
    draft_id: str


class StepEvent(BaseModel):
    type: Literal["step"] = "step"
    step: str
    state: Literal["running", "complete"]


class DateEvent(BaseModel):
    type: Literal["date"] = "date"
    value: str


class TokenEvent(BaseModel):
    type: Literal["token"] = "token"
    text: str


class ResetEvent(BaseModel):
    type: Literal["reset"] = "reset"


class ReadyEvent(BaseModel):
    type: Literal["ready"] = "ready"
    draft: DraftOut


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str
