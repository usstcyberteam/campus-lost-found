from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

_STATUS_CODE_MAP = {
    400: "VALIDATION",
    401: "UNAUTH",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "STATE_CONFLICT",
    422: "PRECONDITION",
    503: "MODEL_UNAVAILABLE",
}


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def register_exception_handlers(app) -> None:
    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError):
        body = {"code": exc.code, "message": exc.message}
        if exc.details is not None:
            body["details"] = exc.details
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        code = _STATUS_CODE_MAP.get(exc.status_code, "ERROR")
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": code, "message": str(exc.detail)},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=400,
            content={
                "code": "VALIDATION",
                "message": "参数校验失败",
                "details": [
                    {"type": error["type"], "loc": error["loc"], "msg": error["msg"]} for error in exc.errors()
                ],
            },
        )
