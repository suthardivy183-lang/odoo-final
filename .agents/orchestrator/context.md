# Project Context: Warehouse Mapping

## Database & Models Context
- Database: SQLite (`backend/mini_erp.db`)
- ORM: SQLAlchemy (`backend/app/database.py`, `backend/app/models.py`)
- Schema migrations: The backend drops and recreates tables automatically during seeding. For updates to production/development without dropping, SQLAlchemy metadata creation or manually restarting/reseeding the DB can be used. Since the test script will run on the SQLite database, we must ensure it seeds or creates tables.

## Backend Dependencies
- FastAPI
- PyJWT, SQLAlchemy, Pydantic
- Existing code structure relies on Pydantic v2 schemas and standard SQLAlchemy declarative bases.

## Frontend Dependencies
- React with TypeScript (Vite bundler)
- Tailwind CSS, Lucide React icons
- `qrcode.react` package might need to be verified or installed. We should check if it's already in package.json or if we need to install it. Let's inspect package.json.

## Key API Endpoints to Intersect
- `/api/products` (already exists, returns product metadata)
- `/api/manufacturing/orders` (already exists)
