from contextvars import ContextVar
from typing import Optional

# ContextVar to store the current logged-in user ID and username during the request lifecycle
current_user_id: ContextVar[Optional[int]] = ContextVar("current_user_id", default=None)
current_username: ContextVar[Optional[str]] = ContextVar("current_username", default=None)
