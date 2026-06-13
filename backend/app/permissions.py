"""
Lightweight role-based access control (RBAC).

Single source of truth for which roles may act in which module. Wired into
`main.py` at `include_router(...)` time so no router/business-logic file is
touched.

Model:
  - "Safe" reads (GET/HEAD/OPTIONS) are allowed for any authenticated user when
    a router is marked `read_all=True`. This keeps the cross-module dashboard and
    shared form dropdowns (e.g. product/BoM pickers) working.
  - Mutations (POST/PUT/PATCH/DELETE) and the sensitive modules
    (dashboard, insights, audit) are restricted to the owning role + admin.
"""
from fastapi import Depends, HTTPException, Request, status

from backend.app.auth import get_current_user
from backend.app.models import User

# Role identifiers (stored in users.role / embedded in the JWT)
ADMIN = "admin"
SALES = "sales"
PURCHASE = "purchase"
MANUFACTURING = "manufacturing"
INVENTORY_MANAGER = "inventory_manager"
BUSINESS_OWNER = "business_owner"

# role -> set of modules the role may act in
ROLE_MODULES: dict[str, set[str]] = {
    ADMIN: {"sales", "purchase", "manufacturing", "inventory", "bom", "dashboard", "audit"},
    SALES: {"sales"},
    PURCHASE: {"purchase"},
    MANUFACTURING: {"manufacturing"},
    INVENTORY_MANAGER: {"inventory"},
    BUSINESS_OWNER: {"dashboard"},
}

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def require_module(module: str, read_all: bool = False):
    """Return a dependency that allows the request only if the current user's
    role owns `module` (admin owns all). When `read_all` is set, safe read
    methods are permitted for any authenticated user."""

    def guard(request: Request, user: User = Depends(get_current_user)) -> User:
        if request.method == "OPTIONS":
            return user
        if read_all and request.method in _SAFE_METHODS:
            return user
        if module not in ROLE_MODULES.get(user.role, set()):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not allowed to access the {module} module",
            )
        return user

    return guard
