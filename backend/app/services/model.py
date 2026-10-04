from app.config import get_settings

settings = get_settings()


def extract_features(text: str | None = None, image_path: str | None = None) -> dict:
    # No remote adapter has been implemented; configuration is not evidence of a call.
    return {
        "labels": None,
        "extracted_text": text,
        "confidence": None,
        "source": "manual",
        "degraded": True,
    }
