from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class DomainError(Exception):
    """An error the person can read. `message` is shown in the UI as is."""

    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class NotFoundError(DomainError):
    status_code = 404
    code = "not_found"


class ConflictError(DomainError):
    status_code = 409
    code = "conflict"


class BlockedError(DomainError):
    status_code = 422
    code = "blocked"


class InvalidRequestError(DomainError):
    status_code = 422
    code = "invalid_request"


def error_body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _domain(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(error_body(exc.code, exc.message), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        message = "Please check the form and try again."
        for err in exc.errors():
            field = err.get("loc", [""])[-1]
            if field == "idea":
                message = "Tell Draftly what the email is about, in 3 to 2,000 characters."
                break
            if field in ("subject", "body"):
                message = "The subject and the message can't be empty."
                break
        return JSONResponse(error_body("invalid_request", message), status_code=422)
