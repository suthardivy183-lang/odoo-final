# Project: Warehouse Mapping module for Shiv Furniture Works ERP

## Architecture
The Warehouse Mapping module provides complete tracking of products within the physical warehouse structure.
It has:
- Hierarchical database models: `Warehouse` -> `Aisle` -> `Rack` -> `Shelf`.
- `StockAllocation`: Tracks product quantities residing at a specific `Shelf`.
- `WarehouseActivityLog`: Logs stock movement events (`Received`, `Moved`, `Consumed`).
- FastAPI Backend endpoints: CRUD for locations, inventory placement, movement transfer API, and Manufacturing Order components integration.
- React Frontend dashboard: Interactive Warehouse Map, details sidebar panel, QR Code generation and simulated scanning, Manufacturing Order storage info displaying, and Activity timeline feed.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | DB Schema & Models | Implement SQLAlchemy models for Warehouse, Aisle, Rack, Shelf, StockAllocation, WarehouseActivity in `models.py` and schemas in `schemas.py` | None | PLANNED |
| 2 | Backend APIs | Location CRUD routers, stock placement/transfer endpoints, and activity logs GET endpoint | M1 | PLANNED |
| 3 | E2E Testing Infrastructure | Setup test framework and runner in `backend/test_warehouse_mapping.py` | M1, M2 | PLANNED |
| 4 | Manufacturing Order Integration | Update MO model, routers, and frontend detail display to include component storage locations | M2 | PLANNED |
| 5 | Frontend Layout & Sidebar | Register Sidebar link, create interactive Warehouse Map grid layout page and Details sidebar panel | M2 | PLANNED |
| 6 | QR Code Support & Activity Feed | Generate QR codes in frontend, mock QR scanner utility, render recent activities timeline feed | M5 | PLANNED |
| 7 | Full Integration & Verification | Run all tests, complete adversarial hardening, verify everything | M3, M4, M5, M6 | PLANNED |

## Interface Contracts
### Location CRUD APIs
- `GET /api/warehouses`, `POST /api/warehouses`, `PUT /api/warehouses/{id}`, `DELETE /api/warehouses/{id}`
- `GET /api/aisles`, `POST /api/aisles`, `PUT /api/aisles/{id}`, `DELETE /api/aisles/{id}`
- `GET /api/racks`, `POST /api/racks`, `PUT /api/racks/{id}`, `DELETE /api/racks/{id}`
- `GET /api/shelves`, `POST /api/shelves`, `PUT /api/shelves/{id}`, `DELETE /api/shelves/{id}`

### Stock Allocation & Movement APIs
- `POST /api/warehouse/allocate`
  - Input: `{ "product_id": int, "shelf_id": int, "quantity": float }`
  - Output: `StockAllocation` model representation
- `POST /api/warehouse/transfer`
  - Input: `{ "product_id": int, "from_shelf_id": int, "to_shelf_id": int, "quantity": float }`
  - Output: Success message and updated allocation details
- `GET /api/warehouse/activity`
  - Output: List of recent `WarehouseActivity` log records

### Manufacturing Order Integration
- `GET /api/manufacturing/orders/{id}`
  - Updated response: components list contains location hierarchy info: `warehouse_name`, `aisle_name`, `rack_name`, `shelf_name` or nested structure.

## Code Layout
### Backend
- `backend/app/models.py`: add Warehouse, Aisle, Rack, Shelf, StockAllocation, WarehouseActivity
- `backend/app/schemas.py`: add schemas for locations, allocation, transfer, activity log
- `backend/app/routers/warehouse_mapping.py`: implement the API routes
- `backend/app/main.py`: register new router `warehouse_mapping.router`
- `backend/test_warehouse_mapping.py`: E2E verification test script

### Frontend
- `frontend/src/components/AppShell.tsx`: add NavLink for "Warehouse Mapping" between Products and Sales Orders
- `frontend/src/App.tsx`: add route `/warehouse-mapping` pointing to `WarehouseMapping` page
- `frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx`: main dashboard containing visual grid map and Details Panel
- `frontend/src/pages/manufacturing/Manufacturing.tsx`: show component storage locations on detail view
