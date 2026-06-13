# Handoff Report: Warehouse Mapping Module Review

This report provides the results of the backend and frontend review for the Warehouse Mapping module in Shiv Furniture Works ERP.

---

## 1. Observation

### Test Execution Observations
* Running the backend test suite via `python -m backend.test_warehouse_mapping` succeeded and yielded:
  ```
  ALL WAREHOUSE MAPPING TESTS PASSED SUCCESSFULLY!
  ```
* Running the frontend build via `npm run build` completed successfully without compile errors:
  ```
  vite v5.4.21 building for production...
  ✓ 1646 modules transformed.
  ✓ built in 2.20s
  ```
* Initial run of backend tests failed with `sqlite3.IntegrityError: UNIQUE constraint failed: users.username` at `backend/app/seed.py:32` during `db.commit()` when `test_warehouse_mapping.py` was invoked sequentially on an un-reset sqlite file with active connections.

### Backend Code Observations
* **Location schemas** in `backend/app/schemas.py`:
  - Line 414: `class AllocateStockPayload(BaseModel): product_id: int; shelf_id: int; quantity: float`
  - Line 419: `class TransferStockPayload(BaseModel): product_id: int; source_shelf_id: int; target_shelf_id: int; quantity: float`
  There are no positive value constraints (e.g. `gt=0`) on these quantity fields.
* **Allocation and Transfer routes** in `backend/app/routers/warehouse_mapping.py`:
  - Line 397-403: `allocate_stock` upserts allocations by performing `alloc.quantity += payload.quantity` without validating `payload.quantity > 0`.
  - Line 462-477: `transfer_stock` processes transfers using `src_alloc.quantity -= payload.quantity` and `tgt_alloc.quantity += payload.quantity` without validating `payload.quantity > 0`.
* **Model cascade deletes** in `backend/app/models.py`:
  - Line 192: `aisles = relationship("Aisle", back_populates="warehouse", cascade="all, delete-orphan")`
  - Line 204: `racks = relationship("Rack", back_populates="aisle", cascade="all, delete-orphan")`
  - Line 216: `shelves = relationship("Shelf", back_populates="rack", cascade="all, delete-orphan")`
  - Line 228: `allocations = relationship("StockAllocation", back_populates="shelf", cascade="all, delete-orphan")`
* **Route registration** in `backend/app/main.py`:
  - Line 6: `from backend.app.routers import ..., warehouse_mapping`
  - Line 56: `app.include_router(warehouse_mapping.router)`

### Frontend Code Observations
* **Replayed allocations** in `frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx`:
  - Line 167-209: The frontend calculates stock allocations by sorting the activity feed by ID and replaying movements in memory (`computedAllocations`).
* **Storage locations display** in `frontend/src/pages/manufacturing/ManufacturingDetail.tsx`:
  - Line 58-65: Displays component locations correctly mapping over `c.storage_locations` using the format:
    `{loc.warehouse_name} ({loc.aisle_name} → {loc.rack_name} → {loc.shelf_name}): {loc.quantity} units`

---

## 2. Logic Chain

1. **Happy Path Validated**: Since `python -m backend.test_warehouse_mapping` executed steps 1 to 9 successfully, all CRUD APIs, optional parent filtering, stock allocation, stock transfer, activities feed, Manufacturing Order integration, and sequential stock deduction are functionally working under standard usage.
2. **Adversarial Input Risk**: From the observation that `AllocateStockPayload` and `TransferStockPayload` do not validate quantity inputs, a client can pass negative values. This will lead to:
   - Negative allocation: subtracts from the shelf allocation and product total `on_hand_qty` (an unauthorized way to decrease stock).
   - Negative transfer: increases the source shelf allocation and decreases the target shelf allocation, essentially bypassing the source shelf stock sufficiency check (`src_alloc.quantity < payload.quantity` returns false for negative values).
3. **Database Desync Risk**: From the observation that `Shelf.allocations` cascades deletes, deleting a warehouse, aisle, rack, or shelf will silently delete its `StockAllocation` records in the database. Since `Product.on_hand_qty` is not updated during cascade deletes, the product's total stock on hand will remain unchanged while the allocations disappear. This results in permanent desync between global inventory numbers and physical location totals.
4. **Scale Performance Risk**: Replaying the warehouse activity log on the client-side to calculate allocations is an $O(N)$ operation where $N$ is the total number of activities ever recorded. In production, this client-side state reconstruction will eventually cause browser lag as $N$ grows.

---

## 3. Caveats

* We assumed the SQLite database is used for local tests; behavior with other transactional backends (like PostgreSQL) might differ regarding lock-holding and table dropping constraints.
* We did not test real-time concurrent API requests from multiple users, but SQLite's default file locks under heavy write load may trigger database lock exceptions if multiple allocation/transfers happen simultaneously.

---

## 4. Conclusion

### Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Major] Finding 1: Lack of positive quantity validation in Stock API payloads
* **What**: The quantity parameters for stock allocation and transfer can be negative.
* **Where**: `backend/app/schemas.py` lines 417 and 423.
* **Why**: Allows spoofing inventory. A negative transfer adds stock back to the source location and subtracts from the target, bypassing source stock checks.
* **Suggestion**: Add `gt=0` constraints to the quantity fields in both `AllocateStockPayload` and `TransferStockPayload`.
  ```python
  class AllocateStockPayload(BaseModel):
      product_id: int
      shelf_id: int
      quantity: float = Field(gt=0, description="Quantity must be strictly positive")
  ```

### [Major] Finding 2: Inventory desync on location deletion
* **What**: Deleting a warehouse, aisle, rack, or shelf with stock allocations deletes the allocation record without decrementing `Product.on_hand_qty`.
* **Where**: `backend/app/models.py` lines 192, 204, 216, 228.
* **Why**: The database total on-hand quantity remains the same, but the items are no longer allocated to any shelf, causing total stock to mismatch actual mapped locations without user warning or de-allocation logging.
* **Suggestion**: Validate and block deletion of locations (warehouses, aisles, racks, shelves) if they contain active stock allocations, or force a stock transfer/depletion before deletion is permitted.

### [Minor] Finding 3: Client-side stock allocation calculation
* **What**: Frontend reconstructs the stock allocations list by replaying the entire activity log.
* **Where**: `frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx` lines 167-209.
* **Why**: Replaying $N$ activities on the client-side has $O(N)$ complexity and scales poorly in production as transactions accumulate.
* **Suggestion**: Expose a backend endpoint `GET /api/warehouse/allocations` (optionally filtered by `shelf_id` or `product_id`) and fetch current allocation states directly from the database.

---

### Challenge Summary

**Overall risk assessment**: MEDIUM

## Challenges

### [High] Challenge 1: Negative Stock Transfer Attack
* **Assumption challenged**: Assumed that stock transfer requests only shift positive quantities.
* **Attack scenario**: A user calls `POST /api/warehouse/transfer` with `quantity = -50.0`. The check `src_alloc.quantity < -50.0` is evaluated as false. The source shelf is incremented by 50 units, and the target shelf is decremented by 50 units.
* **Blast radius**: Allows arbitrary inflation of shelf stock and creation of negative allocations on target shelves.
* **Mitigation**: Enforce Pydantic validation (`Field(gt=0)`) and add database check constraints on stock allocations.

### [Medium] Challenge 2: Cascade Delete desyncs Inventory
* **Assumption challenged**: Assumed deleting physical infrastructure is safe if cascade delete is enabled.
* **Attack scenario**: Deleting a Rack contains shelves holding 500 units of valuable inventory. The rack is deleted, cascade-deleting the shelves and allocations.
* **Blast radius**: The stock allocations are lost from the DB, but `Product.on_hand_qty` is still 500. The system believes the inventory is present, but it has no mapped location, creating an unresolvable audit discrepancy.
* **Mitigation**: Add a check in delete endpoints of warehouse, aisle, rack, and shelf to reject deletion if any child shelf has allocations.

---

## 5. Verification Method

### Backend Verification
Run the backend tests with PYTHONPATH set:
```powershell
$env:PYTHONPATH="."
python backend/test_warehouse_mapping.py
```
This tests the full end-to-end flow of the warehouse mapping database and APIs.

### Frontend Verification
Run the compilation checks:
```powershell
cd frontend
npm run build
```
This ensures React components, navigation links, and types compile correctly.
