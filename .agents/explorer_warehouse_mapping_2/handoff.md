# Handoff Report: Warehouse Mapping Module Investigation

## 1. Observation
- In `PROJECT.md` line 6, the hierarchy is defined as: `Warehouse` -> `Aisle` -> `Rack` -> `Shelf`.
- In `PROJECT.md` lines 23-43, the API contracts are established for Location CRUD, Stock Allocation & Movement, and Manufacturing Order Integration.
- In `backend/app/models.py`, `Product` (lines 15-55) handles overall stock levels (`on_hand_qty`), while `ManufacturingOrder` (lines 140-150) and `ManufacturingOrderComponent` (lines 157-168) manage manufacturing logic and component allocations.
- In `backend/app/schemas.py`, the existing `ManufacturingOrderComponentResponse` (lines 209-218) lacks dynamic location information.
- In `frontend/src/components/AppShell.tsx` (lines 16-24), sidebar nav items are defined.
- In `frontend/src/App.tsx` (lines 18-30), routes are mapped under the `AppShell` layout.
- In `frontend/src/pages/manufacturing/ManufacturingDetail.tsx` (lines 49-61), the components table currently only displays `name`, `required_quantity`, `consumed_quantity`, `stock`, and `status`.

## 2. Logic Chain
- To implement physical location mapping without disrupting the existing product inventory columns (`on_hand_qty`), we must model `Warehouse`, `Aisle`, `Rack`, and `Shelf` as a 1-to-many parent-child hierarchy, linking them with foreign keys.
- `StockAllocation` needs to associate a `Product` with a specific `Shelf` and hold a `quantity` decimal. A unique constraint on `(product_id, shelf_id)` ensures data integrity and single source of truth for shelf quantity.
- To display where components are stored, the backend API for Manufacturing Orders (`/api/manufacturing/orders/{id}`) needs to return component details updated with `storage_locations` (which represents the allocations of that component product). This requires adding a property or dynamic serialization block to `ManufacturingOrderComponentResponse`.
- The frontend needs a new page `/warehouse-mapping` registered in `App.tsx` and linked in `AppShell.tsx`.
- The `WarehouseMapping` page must handle selection state (`selectedWh`, `selectedAisle`, etc.) to render a visual map, and provide action handlers (`allocateMutation`, `transferMutation`) to post to the respective backend APIs.

## 3. Caveats
- The analysis assumes that the `StockAllocation` quantities are updated manually via the UI or dynamically upon receiving/consuming inventory. If automatic sync is desired, the implementation agent will need to update routers/sales_orders.py, purchase_orders.py, and manufacturing.py to update/deduct allocations during deliveries, receptions, and production.
- QR code scanning is simulated in the React code via a modal selector instead of calling actual hardware APIs or camera streams, which is standard for mock desktop environments.

## 4. Conclusion
- We recommend the complete and exact backend database models, Pydantic schemas, FastAPI router implementation structure, and frontend dashboard and order detail page layouts described in `analysis.md` to build the Warehouse Mapping module.
- No modifications have been made to the project source files, in alignment with the read-only constraint.

## 5. Verification Method
- Code Review: Inspect `c:\Users\Shivam\Desktop\finalround\.agents\explorer_warehouse_mapping_2\analysis.md` to review the proposed code changes.
- Integration Testing: Run the recommended E2E script `backend/test_warehouse_mapping.py` after implementing the models and routes. Verification commands:
  ```powershell
  python backend/test_warehouse_mapping.py
  ```
