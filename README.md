# Shiv Furniture Works ERP

AI-assisted mini ERP for a furniture manufacturer, built to show how sales, procurement, manufacturing, inventory, warehouse mapping, and business risk can work as one connected operating system.

This project was built as a hackathon-style ERP demo for **Shiv Furniture Works**. It focuses on one practical problem: when a furniture order arrives, the team should know what can be fulfilled, what must be manufactured, what materials are short, where materials are stored, and which business commitments are at risk.

## Why It Stands Out

- **AI Operations Center**: prioritizes shortages, delayed purchase orders, manufacturing constraints, and recommended next actions.
- **Warehouse Mapping**: models Warehouse -> Aisle -> Rack -> Shelf and shows stock at the exact physical location.
- **QR Location Workflow**: shelf-level QR generation and simulated scanning to verify locations and load stored quantities.
- **Manufacturing + BOM**: connects finished goods to component requirements and material readiness.
- **Company Digital Twin**: visual graph of Customer -> Sales Order -> Product -> BOM -> Warehouse -> Supplier dependencies.
- **Virtual Impact Simulator**: simulates new demand, highlights shortages, and calculates revenue at risk without mutating the database.
- **RBAC + Audit Trail**: role-specific access plus business-readable activity history.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, Pydantic |
| Database | SQLite by default, PostgreSQL-ready via `DATABASE_URL` |
| Auth | JWT, role-based access control |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Data fetching | Axios, TanStack Query |
| Deployment | Docker multi-stage build |

## Demo Accounts

The seed data creates these users:

| Role | Username | Password | Best route to inspect |
|---|---|---|---|
| Admin | `admin` | `admin123` | Full system access |
| Business Owner | `owner` | `owner123` | Dashboard and Digital Twin |
| Inventory Manager | `inventory` | `inventory123` | Products and Warehouse Mapping |
| Manufacturing | `manufacturing` | `manufacturing123` | Manufacturing orders |
| Sales | `sales` | `sales123` | Sales orders |
| Purchase | `purchase` | `purchase123` | Purchase orders |

## Quick Start

### 1. Backend

From the repo root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python -m backend.app.seed
python -m uvicorn backend.app.main:app --reload
```

Backend API:

- API root: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`

### 2. Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

### 3. Docker

For a single-container demo:

```powershell
docker build -t shiv-furniture-erp .
docker run --rm -p 8080:8080 shiv-furniture-erp sh -c "python -m backend.app.seed && uvicorn backend.app.main:app --host 0.0.0.0 --port 8080"
```

Open:

```text
http://localhost:8080
```

## 5-Minute Jury Walkthrough

1. **Login as admin** with `admin / admin123`.
2. Open **AI Operations Center** and inspect the prioritized action queue.
3. Open **Warehouse Mapping** and click through warehouse locations down to shelf-level stock.
4. Use the QR scan simulation to verify a shelf and load its details.
5. Open **Manufacturing** or **BOM** to show component requirements.
6. Open **Digital Twin**, inspect the dependency graph, and run a demand simulation.
7. Open **Audit Logs** to show system traceability.

For a detailed judging path, see [docs/JURY_GUIDE.md](docs/JURY_GUIDE.md).

## Test Commands

Run from the repo root after installing backend dependencies:

```powershell
python backend\test_flow.py
python backend\test_warehouse_mapping.py
python backend\test_digital_twin.py
python backend\test_mrp_recursive.py
python backend\test_po_partial.py
```

Frontend build check:

```powershell
cd frontend
npm run build
```

Note: the backend test scripts reseed/reset the local database as part of their verification flow.

## Project Structure

```text
backend/
  app/
    routers/        FastAPI modules for auth, products, sales, purchase, BOM,
                    manufacturing, warehouse mapping, dashboard, insights,
                    audit logs, and digital twin
    services/       Business insight and activity timeline logic
    models.py       SQLAlchemy domain model
    seed.py         Demo data and users

frontend/
  src/
    pages/          ERP screens and workflows
    components/     App shell, protected routes, reusable UI
    hooks/          API-backed React Query hooks
    lib/            Auth, permissions, API client, shared types

docs/
  JURY_GUIDE.md     Suggested judging walkthrough
  ARCHITECTURE.md   Compact technical architecture
```

## Architecture

For the technical overview, API module map, route map, and main business data flow, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
