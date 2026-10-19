import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def is_available() -> bool:
    # 缺任一配置都视为不可用，避免把半配置状态当成可用去发请求。
    return not settings.model_disabled and bool(
        settings.model_base_url.strip() and settings.model_name.strip() and settings.model_api_key.strip()
    )


def _endpoint() -> str:
    base = settings.model_base_url.strip().rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return f"{base}/chat/completions"


def chat_completion(messages: list[dict[str, str]]) -> str | None:
    if not is_available():
        return None
    try:
        with httpx.Client(timeout=settings.model_timeout_seconds) as client:
            response = client.post(
                _endpoint(),
                json={
                    "model": settings.model_name,
                    "messages": messages,
                    "temperature": 0.2,
                },
                headers={"Authorization": f"Bearer {settings.model_api_key}"},
            )
            response.raise_for_status()
            payload = response.json()
        content = payload["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        logger.warning("模型调用失败，已降级：%s", exc)
        return None
    if not isinstance(content, str) or not content.strip():
        logger.warning("模型返回内容为空，已降级")
        return None
    return content
