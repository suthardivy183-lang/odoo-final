from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from jose import jwt, JWTError
from backend.app.config import settings
from backend.app.utils.context import current_user_id, current_username
from backend.app.permissions import require_module
from backend.app.routers import auth, products, sales_orders, purchase_orders, bom, manufacturing, audit_logs, dashboard, insights, warehouse_mapping, digital_twin

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Shiv Furniture Works Mini ERP System",
    version="1.0.0"
)

@app.middleware("http")
async def add_current_user_to_context(request: Request, call_next):
    auth_header = request.headers.get("Authorization")
    user_id = None
    username = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
            user_id = payload.get("id")
            username = payload.get("sub")
        except JWTError:
            pass

    token_uid = current_user_id.set(user_id)
    token_uname = current_username.set(username)
    try:
        response = await call_next(request)
        return response
    finally:
        current_user_id.reset(token_uid)
        current_username.reset(token_uname)

# Set up CORS middleware to allow communication from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers (RBAC guards attached here — see permissions.py).
# read_all=True keeps GET reads open to any authenticated user so the
# cross-module dashboard and shared form pickers keep working; writes are
# still gated to the owning role + admin.
app.include_router(auth.router)
app.include_router(products.router, dependencies=[Depends(require_module("inventory", read_all=True))])
app.include_router(sales_orders.router, dependencies=[Depends(require_module("sales", read_all=True))])
app.include_router(purchase_orders.router, dependencies=[Depends(require_module("purchase", read_all=True))])
app.include_router(bom.router, dependencies=[Depends(require_module("bom", read_all=True))])
app.include_router(manufacturing.router, dependencies=[Depends(require_module("manufacturing", read_all=True))])
app.include_router(audit_logs.router, dependencies=[Depends(require_module("audit"))])
app.include_router(dashboard.router, dependencies=[Depends(require_module("dashboard"))])
app.include_router(insights.router, dependencies=[Depends(require_module("dashboard"))])
app.include_router(warehouse_mapping.router, dependencies=[Depends(require_module("inventory", read_all=True))])
app.include_router(digital_twin.router, dependencies=[Depends(require_module("dashboard"))])

@app.get("/")
def read_root():
    import os
    dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
    index_file = os.path.join(dist_path, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs"
    }

# Serve React frontend built files if dist exists in production
import os
dist_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{fallback_path:path}")
    def serve_frontend(fallback_path: str):
        if fallback_path.startswith("api") or fallback_path.startswith("docs") or fallback_path.startswith("openapi.json"):
            return None
        index_file = os.path.join(dist_path, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
