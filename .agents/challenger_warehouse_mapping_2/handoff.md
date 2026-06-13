# Handoff Report: Warehouse Mapping Empirical Validation & Boundary Checking

## 1. Observation
This report outlines findings from stress-testing the Warehouse Mapping module in the Mini ERP system. Tests were defined and executed using a custom verification script `backend/test_warehouse_boundary.py` on the local database structure.

*   **File Paths Inspected**:
    *   `backend/app/routers/warehouse_mapping.py`
    *   `backend/app/schemas.py`
    *   `backend/app/models.py`
*   **Test Command Run**:
    ```powershell
    backend/venv/Scripts/python.exe -m backend.test_warehouse_boundary
    ```
*   **Verbatim Test Log Output Snippet**:
    ```
    SUMMARY OF BOUNDARY & STRESS TEST RESULTS
    Total Failures/Vulnerabilities Found: 7
    ==================================================
    - [Negative Stock Allocation]
      Allowed negative stock allocation (-5.0). Allocation created/updated in DB: -5.0. Product on_hand_qty reduced from 20.0 to 15.0.
    - [Zero Stock Allocation]
      Allowed zero stock allocation. StockAllocation record created with quantity 0.0.
    - [Negative Stock Transfer]
      Allowed negative stock transfer. Source quantity modified to 15.0, target quantity modified to -5.0.
    - [Zero Stock Transfer]
      Allowed transferring zero quantity. Target allocation record might have been created unnecessarily with quantity -5.0.
    - [Empty Warehouse Name]
      FastAPI/Pydantic allowed creation of Warehouse with an empty name ("").
    - [Empty Aisle Name]
      Allowed creation of Aisle with an empty name ("").
    - [Shelf Delete Desynchronizes Product Quantity]
      Deleting Shelf (ID 1) containing 10.0 units of Product 'RM001' did not update the Product's on_hand_qty. Product on_hand_qty remains at 30.0, but the allocation is deleted, creating a database discrepancy.
    ==================================================
    ```

---

## 2. Logic Chain

1.  **Negative/Zero Quantities in Stock Allocation**:
    *   *Observation*: Sending `quantity: -5.0` or `quantity: 0.0` to `/api/warehouse/allocate` yields a `200 OK` response.
    *   *Reasoning*: The route code in `warehouse_mapping.py` (lines 375-427) does not assert that `payload.quantity` must be positive. It directly adds the quantity to `alloc.quantity` and `product.on_hand_qty` (e.g. `alloc.quantity += payload.quantity`), enabling arbitrary decrementing and negative values.
2.  **Negative/Zero Quantities in Stock Transfer**:
    *   *Observation*: `/api/warehouse/transfer` accepted `quantity: -5.0` and `quantity: 0.0` with a `200 OK`.
    *   *Reasoning*: The route code (lines 428-501) lacks validators for `payload.quantity > 0`. Because it uses `src_alloc.quantity -= payload.quantity`, passing a negative quantity increases the source allocation and decreases the target allocation, corrupting the stock levels.
3.  **Empty Name Structures**:
    *   *Observation*: Creating a Warehouse or Aisle with a name of `""` succeeds with `201 Created`.
    *   *Reasoning*: In `schemas.py` (lines 332, 346), `WarehouseBase` and `AisleBase` define `name: str` but do not specify any constraints like Pydantic's `min_length=1` or custom field validators to reject empty strings.
4.  **Shelf Delete Desynchronizes Product Quantity**:
    *   *Observation*: Deleting a Shelf with `10.0` units allocated deletes the `StockAllocation` record due to SQLAlchemy cascade but keeps `Product.on_hand_qty` unchanged.
    *   *Reasoning*: In `models.py` (lines 228), the relationship `allocations` in the `Shelf` model has `cascade="all, delete-orphan"`. In `warehouse_mapping.py` (lines 356-371), `delete_shelf` performs `db.delete(shelf)` and commits. SQLAlchemy cascaded the deletion to the `StockAllocation` record, but the router did not adjust `Product.on_hand_qty` for the product, leading to a silent desynchronization where physical inventory is orphaned in aggregate calculations.

---

## 3. Caveats
*   Tests were executed locally in a single-threaded environment. Heavy concurrency issues (e.g., race conditions during overlapping stock transfers) were not simulated.
*   Assumed SQLite database engine. A production engine (e.g. PostgreSQL) may enforce different transaction isolation levels, but the logical errors at the application level will persist.

---

## 4. Conclusion
The Warehouse Mapping module is highly vulnerable to inventory corruption and metadata pollution due to missing schema/boundary validations and improper database cascade handling.
**Recommended Actions**:
1.  Add Pydantic validation (`gt=0`) to `quantity` fields in `AllocateStockPayload` and `TransferStockPayload`.
2.  Add Pydantic validation (`min_length=1`) or regex validation to name fields in warehouse mapping schemas.
3.  Implement a pre-deletion handler or transactional checks in `delete_shelf`, `delete_rack`, `delete_aisle`, and `delete_warehouse` to deduct deleted allocation quantities from `Product.on_hand_qty` before committing.

---

## 5. Verification Method
*   **Run command**:
    ```powershell
    backend/venv/Scripts/python.exe -m backend.test_warehouse_boundary
    ```
*   **Expected Success Condition**: `Total Failures/Vulnerabilities Found: 0` printed in summary.
*   **Invalidation Conditions**: If any schema or router implementation is updated, running the test will verify if the checks are successfully applied.

---

## Adversarial Review / Challenge Report

### Challenge Summary
*   **Overall risk assessment**: HIGH
*   *Justification*: A delete operation on shelves directly causes aggregate stock counts to desynchronize silently, and negative allocations allow arbitrary manipulation of inventory totals, completely compromising stock accuracy.

### Challenges

#### [High] Challenge 1: Inventory Desynchronization on Shelf Deletion
*   **Assumption challenged**: Deleting structural warehouse elements is safe.
*   **Attack scenario**: A manager deletes a shelf that contains stock to repurpose it. The allocation records are wiped out, but the system keeps the stock count in the products table unchanged. The product now shows stock on hand that does not physically exist anywhere.
*   **Blast radius**: High. Direct financial and inventory reporting inaccuracy.
*   **Mitigation**: Restrict shelf deletion if allocations exist, or subtract the quantities from the product on-hand counts.

#### [Medium] Challenge 2: Arbitrary Stock Reductions via Negative Allocations
*   **Assumption challenged**: Stock allocation quantities are always positive.
*   **Attack scenario**: An attacker or errant script calls `/api/warehouse/allocate` with a negative number, deducting inventory without going through a standard sales/production order.
*   **Blast radius**: Medium. Bypasses normal audit controls.
*   **Mitigation**: Enforce `quantity > 0` validation on all allocation inputs.
