from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import get_settings
from app.errors import register_exception_handlers

settings = get_settings()

app = FastAPI(title="校园寻物局", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(api_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}