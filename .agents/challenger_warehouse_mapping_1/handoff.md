# Handoff Report: Warehouse Mapping Empirical Validation & Boundary Checking

## 1. Observation

Empirical testing was conducted against the Warehouse Mapping endpoints using the test script `backend/test_warehouse_mapping_stress.py`. The execution command and resulting outputs were as follows:

**Execution Command:**
```powershell
$env:DATABASE_URL="sqlite:///./test_temp.db"; $env:PYTHONPATH="c:\Users\Shivam\Desktop\finalround"; backend/venv/Scripts/python.exe backend/test_warehouse_mapping_stress.py
```

**Verbatim Output Snippet Showing Failures:**
```text
==================================================
Starting Shiv Furniture Works - Stress/Boundary Tests
==================================================
...
--- Test 1: Allocate Negative Quantity ---
[FAIL] Negative allocation allowed! Quantity: -5.0
       Created allocation qty in DB: -5.0
       Product on_hand_qty in DB: 15.0

--- Test 2: Allocate Zero Quantity ---
[FAIL/WARN] Zero quantity allocation allowed!
       Created allocation qty in DB: -5.0

--- Test 3: Allocate to Non-existent Product ---
[PASS] Blocked with 404 Not Found

--- Test 4: Allocate to Non-existent Shelf ---
[PASS] Blocked with 404 Not Found
...
--- Test 6: Transfer Negative Quantity ---
[FAIL] Negative transfer allowed! Quantity: -5.0
       Source shelf allocation qty: 15.0
       Target shelf allocation qty: -5.0

--- Test 7: Transfer Zero Quantity ---
[FAIL/WARN] Zero transfer allowed!

--- Test 8: Transfer to Same Shelf ---
Response code: 200
Allocation quantity on source/target shelf: 15.0
[FAIL] Transfer to same shelf corrupted the allocation!
...
==================================================
Stress Testing Completed.
FAILURES/BUGS DETECTED: 5
 - Negative allocation allowed (returned 200 instead of 400/422)
 - Zero quantity allocation allowed (should be rejected as a no-op or error)
 - Negative transfer quantity allowed (returned 200 instead of 400/422)
 - Zero transfer quantity allowed
 - Transfer to same shelf corrupted the allocation (allocation changed or deleted)
==================================================
```

Relevant implementation file paths and lines of code:
- **`backend/app/routers/warehouse_mapping.py`**:
  - **`allocate_stock`** (lines 375–426): No validation checks for non-positive quantities (`payload.quantity`).
  - **`transfer_stock`** (lines 428–500): Check `src_alloc.quantity < payload.quantity` (line 462) fails to block negative quantities (e.g., `src_alloc.quantity < -5.0` is false). Same-shelf transfers (`source_shelf_id == target_shelf_id`) retrieve and reuse the same object pointer, leading to calculation updates that bypass deduction checks.
- **`backend/app/schemas.py`**:
  - **`AllocateStockPayload`** (lines 414–417) and **`TransferStockPayload`** (lines 419–424) do not specify pydantic `Gt` (greater than) validations on quantity field.

---

## 2. Logic Chain

1. **Lack of Payload Constraints**:
   - `AllocateStockPayload` and `TransferStockPayload` define `quantity: float` without any minimum value constraints (e.g., `Field(gt=0)`). As a result, Pydantic parses negative numbers and zero as valid floats and forwards them to the API router.
2. **Negative Allocation Execution**:
   - When `/api/warehouse/allocate` receives a negative quantity (`-5.0`), it bypasses validation checks. In `allocate_stock`:
     ```python
     alloc.quantity += payload.quantity # (adds -5.0)
     product.on_hand_qty += payload.quantity # (subtracts 5.0 from total)
     ```
     This results in negative allocation quantities stored in the DB and directly decreases the product's system-wide `on_hand_qty` (Observation: Test 1).
3. **Ineffective Insufficient Stock Check for Negative Transfers**:
   - In `/api/warehouse/transfer`, when `payload.quantity` is negative (e.g., `-5.0`), the system executes this check:
     ```python
     if not src_alloc or src_alloc.quantity < payload.quantity:
     ```
     If `src_alloc.quantity` is `10.0`, the comparison `10.0 < -5.0` is `False`. The check passes, allowing the negative transfer to proceed.
   - The deduction logic:
     ```python
     src_alloc.quantity -= payload.quantity # 10.0 - (-5.0) = 15.0 (increases source stock!)
     ```
     and upsert logic:
     ```python
     tgt_alloc.quantity += payload.quantity # adds -5.0 to target allocation!
     ```
     allow negative numbers to populate target allocations and inflate source allocations (Observation: Test 6).
4. **Same-Shelf Transfer Corruption**:
   - If `source_shelf_id == target_shelf_id` (e.g., Shelf 1 to Shelf 1), the query returns the same row from the DB for both `src_alloc` and `tgt_alloc`.
   - Modifying `src_alloc.quantity` first and then querying/updating `tgt_alloc.quantity` commits incorrect values because the memory pointer points to the same object within the SQLAlchemy session transaction context (Observation: Test 8).

---

## 3. Caveats

- **Concurrency**: Tests were executed sequentially. Concurrent stock transfers targeting the same source allocations were not evaluated. Under heavy concurrent load, there is a risk of race conditions leading to over-deduction (double-spend) or deadlock in database transaction locks.
- **SQLite Configuration**: The environment uses SQLite. Unlike production PostgreSQL or MySQL instances, cascade deletes or foreign keys might not be fully checked/enforced depending on database initialization pragma settings, though structural cascade deletes did succeed locally.

---

## 4. Conclusion

The Warehouse Mapping module contains **five critical/high-impact issues** that violate basic warehouse and inventory integrity rules:
1. **Negative Allocation Bug**: Allows manual or automated requests to decrease stock allocations and product quantities below zero.
2. **Zero Allocation/Transfer Spam**: Floods activity logs with useless entries and empty database writes.
3. **Negative Transfer Vulnerability**: Bypasses the insufficient stock check, resulting in inventory stealing (inflating source shelf quantity, creating negative target shelf quantity).
4. **Same-Shelf Corruption**: Same-shelf transfers fail to handle duplicate object identities in SQLAlchemy, leading to corrupted quantities.

**Recommended Actionable Mitigations (to be done by the developer):**
1. **Pydantic Validation**: Add `gt=0` to the `quantity` fields in both `AllocateStockPayload` and `TransferStockPayload` to block non-positive numbers at the API boundary:
   ```python
   class AllocateStockPayload(BaseModel):
       product_id: int
       shelf_id: int
       quantity: float = Field(gt=0, description="Quantity must be greater than zero")
   ```
2. **Same-Shelf Check**: Reject transfers where `source_shelf_id == target_shelf_id` by throwing a `400 Bad Request` or handling it as a no-op check at the beginning of `transfer_stock`.

---

## 5. Verification Method

To independently verify these findings, run the following stress test script:

**Command to Run:**
```powershell
$env:DATABASE_URL="sqlite:///./test_temp.db"; $env:PYTHONPATH="c:\Users\Shivam\Desktop\finalround"; backend/venv/Scripts/python.exe backend/test_warehouse_mapping_stress.py
```

**Files to Inspect:**
- `backend/test_warehouse_mapping_stress.py`
- `backend/app/routers/warehouse_mapping.py` (lines 375-500)

**Invalidation Conditions:**
- The verification fails if the stress script output does not report the `FAIL` flags for Tests 1, 2, 6, 7, and 8, or if the API endpoints are updated to return `400`/`422` when receiving negative, zero, or same-shelf payloads.
