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
    content, _ = chat_completion_with_reasoning(messages)
    return content


def chat_completion_with_reasoning(messages: list[dict[str, str]]) -> tuple[str | None, str | None]:
    """返回 (content, reasoning_content)。

    思考模式模型的完整输出含 reasoning_content（思考过程），此前该字段被直接丢弃，
    导致多轮对话无法原样回传（思考模式 API 要求历史 assistant 消息携带该字段时会被拒绝）。
    上层负责按需透传；content 为空时两者均返回 None（整体按降级处理）。
    """
    if not is_available():
        return None, None
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
        message = payload["choices"][0]["message"]
        content = message["content"]
        reasoning = message.get("reasoning_content")
    except httpx.HTTPStatusError as exc:
        # 单独记录 API 拒绝原因（如思考模式要求回传 reasoning_content 的 400），
        # 便于定位兼容性问题；错误响应体不含请求头中的密钥。
        try:
            detail = exc.response.text[:200]
        except Exception:
            detail = ""
        logger.warning(
            "模型接口拒绝(HTTP %s)，已降级：%s",
            exc.response.status_code,
            detail,
        )
        return None, None
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
        logger.warning("模型调用失败，已降级：%s", exc)
        return None, None
    if not isinstance(content, str) or not content.strip():
        logger.warning("模型返回内容为空，已降级")
        return None, None
    reasoning = reasoning if isinstance(reasoning, str) and reasoning.strip() else None
    return content, reasoning
