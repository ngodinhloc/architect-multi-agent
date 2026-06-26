from typing import Literal
from pydantic import BaseModel


class IntentOut(BaseModel):
    intent: Literal["accept", "refine", "plan", "undefined"]
    comment: str | None = None
