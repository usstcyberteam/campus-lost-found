from pathlib import Path


class LocalStorageBackend:
    """本地磁盘存储；key 只由服务端生成，不接受用户输入。"""

    def __init__(self, root: str):
        self.root = Path(root).resolve()

    def _resolve(self, key: str) -> Path:
        target = (self.root / key).resolve()
        if not target.is_relative_to(self.root):
            raise ValueError("非法的存储路径")
        return target

    def save(self, key: str, data: bytes, mime: str) -> str:
        target = self._resolve(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return key

    def load(self, key: str) -> bytes:
        return self._resolve(key).read_bytes()

    def delete(self, key: str) -> None:
        target = self._resolve(key)
        if target.exists():
            target.unlink()
