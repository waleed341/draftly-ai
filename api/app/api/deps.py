from typing import Annotated

from fastapi import Depends, Request

from app.services.draft_service import DraftService


def get_draft_service(request: Request) -> DraftService:
    return request.app.state.draft_service


DraftServiceDep = Annotated[DraftService, Depends(get_draft_service)]
