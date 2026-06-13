from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.routers import auth

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Shiv Furniture Works Mini ERP System",
    version="1.0.0"
)

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

@app.get("/")
def read_root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs"
    }
