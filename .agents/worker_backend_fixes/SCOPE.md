# Scope: Backend Fixes for Warehouse Mapping Boundary & Stress Vulnerabilities

## Objective
Fix all security, validation, and boundary vulnerabilities discovered in the Warehouse Mapping module backend.

## Files to Edit
1. `backend/app/schemas.py`
2. `backend/app/routers/warehouse_mapping.py`

## Requirements
1. **Quantity Constraints**:
   - Add `gt=0` constraint to `quantity` in `AllocateStockPayload` and `TransferStockPayload` schemas in `schemas.py` using `Field(gt=0, ...)`.
2. **Same-Shelf Transfer Check**:
   - In `transfer_stock` route (`backend/app/routers/warehouse_mapping.py`), verify that `payload.source_shelf_id != payload.target_shelf_id`. If they are the same, return `HTTP 400 Bad Request` with detail `"Source and target shelves must be different"`.
3. **Empty Location Name and Code Validation**:
   - When creating or updating any Warehouse, Aisle, Rack, or Shelf, ensure that the `name` and `code` fields (if provided) are not empty or purely whitespace. Return `HTTP 400 Bad Request` with an appropriate detail message (e.g. `"Name cannot be empty"`).
4. **Deletion Block on Active Stock Allocations**:
   - When deleting a Warehouse, Aisle, Rack, or Shelf:
     - Check if there are any non-zero `StockAllocation` records under the location structure.
     - Specifically, check:
       - Warehouse: Any `StockAllocation` where the shelf belongs to a rack inside an aisle inside this warehouse.
       - Aisle: Any `StockAllocation` where the shelf belongs to a rack inside this aisle.
       - Rack: Any `StockAllocation` where the shelf belongs to this rack.
       - Shelf: Any `StockAllocation` belonging to this shelf.
     - If any active stock allocation exists (meaning quantity > 0), raise `HTTP 400 Bad Request` with detail `"Cannot delete location containing active stock allocations. Transfer or consume stock first."`
5. **New Endpoint `GET /api/warehouse/allocations`**:
   - Expose a GET endpoint `GET /api/warehouse/allocations` in `backend/app/routers/warehouse_mapping.py` that queries `StockAllocation` and returns all allocations. Allow optional filters for `shelf_id` and `product_id`. This helps decouple allocation states from replaying activities.
6. **Verify and Run Tests**:
   - Run the existing backend integration test suite (`python backend/test_warehouse_mapping.py`) and confirm everything passes successfully.
   - Run the stress tests or boundary tests (e.g. `test_warehouse_boundary.py` if present) to confirm all validation vulnerabilities are fixed.
