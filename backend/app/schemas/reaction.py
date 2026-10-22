from pydantic import BaseModel


class ReactionOut(BaseModel):
    liked: bool = False
    favorited: bool = False
    like_count: int = 0
    favorite_count: int = 0
