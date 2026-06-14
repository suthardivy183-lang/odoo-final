# Architecture

Shiv Furniture Works ERP is a full-stack mini ERP that connects operational workflows across sales, procurement, manufacturing, inventory, warehouse locations, and executive risk visibility.

## System Overview

```text
React + Vite frontend
        |
        | /api/*
        v
FastAPI backend
        |
        v
SQLAlchemy domain model
        |
        v
SQLite by default / PostgreSQL via DATABASE_URL
```

The backend also serves the built frontend in production when `frontend/dist` exists.

## Backend Modules

The FastAPI app registers focused routers for each business area:

| Module | Responsibility |
|---|---|
| Auth | JWT login and current-user context |
| Products | Finished goods and raw materials |
| Sales Orders | Customer demand, confirmation, delivery |
| Purchase Orders | Supplier procurement and receiving |
| BOM | Finished-good recipes and component requirements |
| Manufacturing | Work orders, component consumption, production lifecycle |
| Warehouse Mapping | Warehouse -> Aisle -> Rack -> Shelf, stock allocation, transfers, activity |
| Dashboard + Insights | Business health, priority queue, operational signals |
| Digital Twin | Connected business graph and risk summary |
| Audit Logs | Business-readable activity timeline |

RBAC is centralized in `backend/app/permissions.py`. Admin has full access; role-specific users get scoped access to their operational modules.

## Frontend Route Map

| Route | Screen |
|---|---|
| `/landing` | Public landing page |
| `/login` | Demo account login |
| `/dashboard` | AI Operations Center |
| `/products` | Product and inventory master data |
| `/warehouse-mapping` | Visual warehouse layout, QR scan, stock movement |
| `/digital-twin` | Company graph and impact simulator |
| `/sales` | Sales orders |
| `/purchase` | Purchase orders |
| `/manufacturing` | Manufacturing orders |
| `/bom` | Bills of materials |
| `/simulation` | Business simulation center |
| `/audit-logs` | Activity timeline |

Route permissions are defined in `frontend/src/lib/permissions.ts`.

## Core Data Flow

```text
Sales Order
  -> reserves finished goods
  -> checks BOM requirements
  -> identifies raw material shortages
  -> triggers procurement or manufacturing actions
  -> maps stock to warehouse shelves
  -> records operational activity
  -> feeds dashboard insights
  -> appears in the Digital Twin graph
```

This flow lets the system answer practical operations questions:

- Can this order be fulfilled now?
- If not, which component is short?
- Where is available stock stored?
- Which supplier or purchase order is involved?
- What revenue is at risk?

## Warehouse Mapping Model

Physical storage is modeled hierarchically:

```text
Warehouse
  -> Aisle
    -> Rack
      -> Shelf
        -> StockAllocation(product, quantity)
```

Inventory movement creates warehouse activity records for receiving, transferring, and consuming materials.

## Digital Twin Model

The Digital Twin API returns nodes and edges that represent live business dependencies:

```text
Customer
  -> Sales Order
    -> Product
      -> BOM
        -> Raw Material
          -> Warehouse/Shelf
          -> Purchase Order
            -> Supplier
```

Nodes carry status signals such as healthy, warning, or critical. The frontend visualizes those signals as an interactive graph and uses simulation logic to highlight shortage paths and revenue at risk.

## Data and Environment

Defaults:

- SQLite database: `sqlite:///./mini_erp.db`
- API docs: `/docs`
- Frontend dev server: `http://localhost:5173`
- Backend dev server: `http://localhost:8000`

Production-style configuration can override:

```text
DATABASE_URL
JWT_SECRET
JWT_ALGORITHM
JWT_EXPIRE_MINUTES
```

## Verification Strategy

The repo uses executable Python integration scripts for backend verification:

- `backend/test_flow.py`: end-to-end ERP workflow.
- `backend/test_warehouse_mapping.py`: warehouse hierarchy, allocation, transfer, and consumption.
- `backend/test_digital_twin.py`: graph generation, shortage propagation, and revenue-at-risk calculation.
- `backend/test_mrp_recursive.py`: recursive material planning behavior.
- `backend/test_po_partial.py`: purchase order partial receiving behavior.

The frontend is validated with:

```powershell
cd frontend
npm run build
```
