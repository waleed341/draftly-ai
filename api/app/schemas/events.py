from typing import Literal

from pydantic import BaseModel

from app.domain.enums import Step, StepState
from app.schemas.drafts import DraftOut


class StartedEvent(BaseModel):
    type: Literal["started"] = "started"
    draft_id: int


class StepEvent(BaseModel):
    type: Literal["step"] = "step"
    step: Step
    state: StepState


class DateEvent(BaseModel):
    type: Literal["date"] = "date"
    value: str


class TokenEvent(BaseModel):
    type: Literal["token"] = "token"
    text: str


class ResetEvent(BaseModel):
    """Drop any text already shown: the model wrote something before calling a tool."""

    type: Literal["reset"] = "reset"


class ReadyEvent(BaseModel):
    type: Literal["ready"] = "ready"
    draft: DraftOut


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


StreamEvent = StartedEvent | StepEvent | DateEvent | TokenEvent | ResetEvent | ReadyEvent | ErrorEvent
