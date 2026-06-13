# Handoff Report — Warehouse Mapping Module Investigation

## 1. Observation
- **Project Structure**: The project contains a Python/FastAPI backend in `backend/app/` and a React frontend in `frontend/`.
- **Backend Database and Models**: 
  - `backend/app/models.py` defines the base models (e.g. `User`, `Product`, `BoM`, `ManufacturingOrder`) inheriting from a declarative base `Base`.
  - Database operations are tracked using SQLAlchemy events for auditing (`after_insert`, `after_update`, `after_delete` listeners on lines 196-319 of `models.py`), which print logs and populate `audit_logs` table.
- **Manufacturing Order Logic**:
  - `backend/app/routers/manufacturing.py` handles business logic for manufacturing. In `produce_manufacturing_order` (lines 206-259), the components are consumed by directly deducting `required_quantity` from `Product.on_hand_qty` (lines 240-245):
    ```python
    # Consume components and release reservations
    for comp in mo.components:
        comp_product = db.query(Product).filter(Product.id == comp.component_product_id).first()
        if comp_product:
            comp_product.on_hand_qty -= comp.required_quantity
            comp_product.reserved_qty -= comp.required_quantity
            comp.consumed_quantity = comp.required_quantity
            comp.status = "Consumed"
    ```
- **Frontend Routing and Layout**:
  - `frontend/src/App.tsx` defines application routes on lines 18-31 using `react-router-dom`.
  - `frontend/src/components/AppShell.tsx` defines the side navigation menu using a `NAV` array (lines 16-24) and uses `lucide-react` icons.
  - `frontend/src/pages/manufacturing/ManufacturingDetail.tsx` renders a modal displaying component statuses and required quantities on lines 49-61.
- **Project Specifications**:
  - `PROJECT.md` outlines the contract details for Warehouse Mapping: hierarchical locations (`Warehouse` -> `Aisle` -> `Rack` -> `Shelf`), `StockAllocation` for product quantities, `WarehouseActivity` log, API contracts for CRUD and stock management, and frontend interactive page requirements.

---

## 2. Logic Chain
1. Since the project uses SQLite via SQLAlchemy without Alembic migrations (as seen in `seed.py` dropping and recreating tables with `Base.metadata.create_all` on lines 16-19), new models can be added directly to `backend/app/models.py` and they will be initialized automatically on the next database seed or test run.
2. Because audit logging is configured dynamically on all `Base` models in `backend/app/models.py`, any new CRUD operations on `Warehouse`, `Aisle`, `Rack`, and `Shelf` will automatically write audit trails to `audit_logs` without requiring extra routing logic.
3. The contract in `PROJECT.md` specifies that the components returned by `GET /api/manufacturing/orders/{id}` must include location hierarchy information. Therefore, we must:
   - Update `ManufacturingOrderComponentResponse` schema in `schemas.py` to add `storage_locations: List[ComponentLocationInfo]`.
   - Update the manufacturing router (`backend/app/routers/manufacturing.py`) to query `StockAllocation` for each component product, resolve the parent locations, and append them dynamically to the response.
4. When a Manufacturing Order is completed (`produce` endpoint), component stock is currently deducted from the overall `Product.on_hand_qty`. To ensure location accuracy, the router must also deduct this consumed stock from the specific shelf allocations (`StockAllocation`) for that product, logging a `Consumed` activity.
5. In `frontend/src/components/AppShell.tsx`, adding the `Warehouse Mapping` nav link will make the module accessible via the sidebar navigation.
6. The `WarehouseMapping` page must be introduced at `/warehouse-mapping` and linked in `App.tsx`. It needs to feature:
   - Warehouse selection.
   - Interactive grid layout rendering aisles, racks, and shelves.
   - A drawer detail sidebar to inspect shelf allocations, show a generated QR code, and triggers for stock placement and movement.
   - Simulated QR Scanner modal to lookup a shelf code and open its details.
   - Timeline feed showing recent `WarehouseActivity` records.

---

## 3. Caveats
- **Stock Synchronization**: If a product has stock allocations, the sum of `StockAllocation.quantity` for that product should always equal `Product.on_hand_qty`. The current `receive` router in `purchase_orders.py` increments `Product.on_hand_qty` directly but doesn't allocate it. Thus, we assume that stock received through POs remains "unallocated" in the warehouse until a user explicitly performs an allocation (`POST /api/warehouse/allocate`) or we could define a default staging shelf to allocate it to automatically.
- **Cascade Deletions**: Deleting a `Warehouse`, `Aisle`, `Rack`, or `Shelf` should use `cascade="all, delete-orphan"` to prevent dangling foreign key references in child location levels and allocations.
- **Audit Logs Size**: High frequency movements (allocate/transfer) will write significant volumes of data to `audit_logs` and `warehouse_activities`. Ensure indices are created on frequently searched columns (e.g. `timestamp`, `product_id`).

---

## 4. Conclusion
The Warehouse Mapping module can be cleanly implemented by adding six database models to `backend/app/models.py`, updating Pydantic schemas in `schemas.py`, exposing a new router `warehouse_mapping.py`, integrating location tracking into the `manufacturing.py` router during MO completion, and constructing the interactive React dashboard at `frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx`. No database migration scripts are needed as schemas are dropped and recreated on startup/seed.

---

## 5. Verification Method
After implementation, verify using:
1. **Automated Test Suite**:
   Create a test script at `backend/test_warehouse_mapping.py`. Run it using:
   ```powershell
   pytest backend/test_warehouse_mapping.py
   ```
   *Expected result*: All assertions pass for location CRUD, allocations, transfers, and manufacturing consumption.
2. **Database Verification**:
   Inspect table columns and constraints using:
   ```powershell
   sqlite3 mini_erp.db ".schema"
   ```
   Verify that `warehouses`, `aisles`, `racks`, `shelves`, `stock_allocations`, and `warehouse_activities` are created with correct foreign keys and indexes.
3. **Manual Verification**:
   - Start the backend and frontend.
   - Navigate to `/warehouse-mapping` via the sidebar.
   - Create locations, perform allocations, transfer stock between shelves, and verify that activities are printed in the timeline feed.
   - Confirm a Manufacturing Order, complete it, and verify that the components table displays the correct locations and that stock allocations on those shelves are reduced.
