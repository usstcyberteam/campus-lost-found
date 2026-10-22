from typing import Protocol


class StorageBackend(Protocol):
    def save(self, key: str, data: bytes, mime: str) -> str:
        """写入文件并返回存储相对路径。"""
        ...

    def load(self, key: str) -> bytes:
        """按存储相对路径读取文件。"""
        ...

    def delete(self, key: str) -> None:
        """删除文件；文件不存在时不报错。"""
        ...
