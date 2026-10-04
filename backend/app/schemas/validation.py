from typing import Annotated

from pydantic import AfterValidator, StringConstraints


def password_bytes(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("密码的 UTF-8 编码不能超过 72 字节")
    return value


Password = Annotated[str, StringConstraints(min_length=6, max_length=72), AfterValidator(password_bytes)]
Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=64)]
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]
