import logging

from app.config import get_settings
from app.services.storage.base import StorageBackend
from app.services.storage.local import LocalStorageBackend

logger = logging.getLogger(__name__)


def get_storage() -> StorageBackend:
    settings = get_settings()
    if settings.storage_backend != "local":
        logger.warning("存储后端 %s 尚未实现，回退本地存储", settings.storage_backend)
    return LocalStorageBackend(settings.file_storage_dir)
