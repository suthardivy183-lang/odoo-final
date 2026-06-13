# Scope: Backend Implementation for Warehouse Mapping

## Objective
Implement all backend database models, schemas, routers, and manufacturing order integrations needed for the Warehouse Mapping module.

## Files to Edit
1. `backend/app/models.py`
2. `backend/app/schemas.py`
3. `backend/app/routers/warehouse_mapping.py` (New file)
4. `backend/app/main.py`
5. `backend/app/routers/manufacturing.py`

## Requirements
- Define SQLAlchemy models for `Warehouse`, `Aisle`, `Rack`, `Shelf`, `StockAllocation`, and `WarehouseActivity`.
- Register relationship back_populates on `Product` to `StockAllocation`.
- Ensure parent-child relationships and unique composite constraints on product_id & shelf_id in `StockAllocation`.
- Implement FastAPI CRUD routes under `/api/warehouses`, `/api/aisles`, `/api/racks`, `/api/shelves` supporting optional parent filtering.
- Implement `/api/warehouse/allocate` (upsert stock allocation and add to `Product.on_hand_qty`).
- Implement `/api/warehouse/transfer` (verify source allocation stock, deduct, add to target, delete source if quantity <= 0).
- Implement `/api/warehouse/activity` (returns activities ordered by timestamp desc).
- Update Manufacturing Order retrieval routes in `/api/manufacturing/orders/{id}` to attach component storage locations.
- Update `produce_manufacturing_order` route in `/api/manufacturing/orders/{mo_id}/produce` to deduct components from `StockAllocation` records sequentially (e.g. oldest first/any order) and log activity `Consumed`.
