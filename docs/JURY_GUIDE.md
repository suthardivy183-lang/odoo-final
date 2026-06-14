# Jury Guide

Use this guide when evaluating the repository or running the demo live. The recommended path is designed to show product value, engineering coverage, and end-to-end operational flow in about five minutes.

## Before the Demo

Seed and run the app:

```powershell
python -m backend.app.seed
python -m uvicorn backend.app.main:app --reload
```

Then start the frontend:

```powershell
cd frontend
npm run dev
```

Open `http://localhost:5173` and log in as:

```text
admin / admin123
```

## 5-Minute Walkthrough

### 1. Landing and Login

Start at the landing page, then sign in as Admin.

What to look for:

- Polished dark-mode product experience.
- Demo roles for different operational users.
- Protected routes after login.

### 2. AI Operations Center

Open `Dashboard` / `AI Operations Center`.

What to look for:

- Business health score.
- Critical and high-priority operational signals.
- Recommended actions for stock shortages, delayed purchase orders, and manufacturing constraints.
- Snapshot metrics across sales, inventory, purchase, and manufacturing.

### 3. Warehouse Mapping

Open `Warehouse Mapping`.

What to look for:

- Warehouse hierarchy: Warehouse -> Aisle -> Rack -> Shelf.
- Shelf-level product allocations and quantities.
- Location details panel with URI-style location context.
- Transfer workflow for moving stock between shelves.
- Recent warehouse activity feed.

### 4. QR Location Verification

Use the QR section on the Warehouse Mapping screen.

What to look for:

- Generated QR codes for warehouse locations.
- Simulated scan flow.
- Scan resolves into the selected location and stored inventory.

### 5. Manufacturing and BOM

Open `Manufacturing` and `BOM`.

What to look for:

- Finished goods connected to raw material requirements.
- Manufacturing order lifecycle.
- Component storage information for picking materials.
- BOM-driven readiness and shortage logic.

### 6. Company Digital Twin

Open `Digital Twin`.

What to look for:

- Zoomable graph of connected business entities.
- Relationships across customers, sales orders, products, BOMs, warehouse locations, purchase orders, and suppliers.
- Status coloring for healthy and critical nodes.
- Detail drawer when graph nodes are selected.

### 7. Virtual Impact Simulator

Use the simulator panel in Digital Twin.

What to look for:

- Demand simulation without database mutation.
- Shortage path highlighting.
- Revenue-at-risk calculation.
- Clear connection between material shortages and downstream business impact.

### 8. Audit Trail

Open `Audit Logs`.

What to look for:

- Business-readable record of user and system activity.
- Traceability across operational changes.
- Role-aware system access.

## Suggested Judge Questions to Ask

- Can the system explain why an order is blocked?
- Can a warehouse worker locate exactly where a component is stored?
- Can management see which shortages affect revenue?
- Can the app simulate a large order without corrupting live stock?
- Can the team prove who changed operational data?

## Best Evidence in the Codebase

- Backend graph API: `backend/app/routers/digital_twin.py`
- Warehouse APIs: `backend/app/routers/warehouse_mapping.py`
- Manufacturing integration: `backend/app/routers/manufacturing.py`
- RBAC source of truth: `backend/app/permissions.py`
- Frontend route map: `frontend/src/App.tsx`
- Digital Twin UI: `frontend/src/pages/digital-twin/DigitalTwin.tsx`
- Warehouse UI: `frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx`

## Validation Commands

```powershell
python backend\test_flow.py
python backend\test_warehouse_mapping.py
python backend\test_digital_twin.py
cd frontend
npm run build
```

The backend tests reseed/reset the local SQLite database while running.
