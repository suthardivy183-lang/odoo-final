import os

class Settings:
    PROJECT_NAME: str = "Mini ERP - Shiv Furniture Works"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./mini_erp.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-key-for-shiv-furniture-works-123456")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

settings = Settings()
