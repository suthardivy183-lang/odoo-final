from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from backend.app.config import settings
from backend.app.utils.context import current_user_id, current_username
from backend.app.routers import auth, products, sales_orders, purchase_orders, bom, manufacturing, audit_logs, dashboard, insights

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

# Register routers
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(sales_orders.router)
app.include_router(purchase_orders.router)
app.include_router(bom.router)
app.include_router(manufacturing.router)
app.include_router(audit_logs.router)
app.include_router(dashboard.router)
app.include_router(insights.router)

@app.get("/")
def read_root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs"
    }
