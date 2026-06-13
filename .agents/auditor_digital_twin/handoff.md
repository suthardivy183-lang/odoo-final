# Forensic Audit Report & Handoff

**Work Product**: Company Digital Twin Module
**Profile**: General Project
**Verdict**: CLEAN

---

## 1. Phase Results

### Phase 1: Source Code Analysis
- **Hardcoded output detection**: **PASS**
  - No static mock/test outputs were found in the backend router `backend/app/routers/digital_twin.py`. All values (e.g. node names, connections, quantities, and prices) are queried dynamically from the database using SQLAlchemy queries.
- **Facade detection**: **PASS**
  - The graph generation endpoint `/api/digital-twin/graph` contains genuine database logic.
  - The MRP-style recursive allocation function `allocate_and_trace` accurately updates virtual inventory stock levels, tracks finished good demand, calculates revenue at risk, and detects shortages.
  - The frontend page `frontend/src/pages/digital-twin/DigitalTwin.tsx` implements a custom, from-scratch zoomable/pannable SVG layout with interactive node context drawers and a frontend virtual BOM explosion simulation.
- **Pre-populated artifact detection**: **PASS**
  - No pre-populated `.log`, `*result*`, or `*output*` files exist in the workspace directory.

### Phase 2: Behavioral Verification
- **Build and run**: **PASS**
  - Executed `python -m backend.test_digital_twin` synchronously. The command successfully connected, seeded the database, logged in as administrator, queried the API endpoint, and correctly asserted graph connectivity.
- **Output verification**: **PASS**
  - The test induced a shortage of `RM001` (Wood Plank) by resetting its stock in the DB and verified that the backend endpoint successfully calculated a non-zero Revenue at Risk ($500.0) and marked the affected Sales Order node state as `red` (critical shortage).
- **Dependency audit**: **PASS**
  - The implementation uses standard/existing libraries (`fastapi`, `sqlalchemy`, `@tanstack/react-query`) and builds the interactive visualization directly in zoomable/pannable SVG without importing heavy third-party graph layout packages (e.g., vis.js or cytoscape). This meets the strict criteria for the **benchmark** integrity mode.

---

## 2. Forensic Evidence & Observations

### Verbatim Tool Command & Output
- **Command**: `python -m backend.test_digital_twin`
- **Working Directory**: `c:\Users\Shivam\Desktop\finalround`
- **Output**:
  ```text
  ==================================================
  Starting Shiv Furniture Works - Digital Twin Tests
  ==================================================

  [Step 1] Seeding Database...
  Dropping existing tables...
  Creating tables...
  Seeding users...
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=users
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=users
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=users
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=users
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=users
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=users
  Seeding products...
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=products
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=products
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=products
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=products
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=products
  Seeding Wooden Dining Table Bill of Materials (BoM)...
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=boms
  [AUDIT DEBUG] after_update: uid=None, uname=system_initializer, target=products
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=bom_components
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=bom_components
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=bom_components
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=bom_components
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=bom_operations
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=bom_operations
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=bom_operations
  Database seeding completed successfully.

  [Step 2] Adding active orders and warehouse layout...
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=warehouses
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=aisles
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=racks
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=shelves
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=stock_allocations
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=sales_orders
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=sales_order_lines
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=purchase_orders
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=purchase_order_lines
  [AUDIT DEBUG] after_insert: uid=None, uname=system_initializer, target=manufacturing_orders
  [PASS] Seeded active orders and inventory.

  [Step 3] Authenticating...
  [PASS] Authenticated as admin.

  [Step 4] Querying /api/digital-twin/graph...
  [AUTH DEBUG] get_current_user: Set context for admin (ID: 1)
  Retrieved 16 nodes of types: {'manufacturing_order', 'sales_order', 'customer', 'purchase_order', 'warehouse', 'supplier', 'product', 'shelf', 'bom'}
  Retrieved 16 edges
  Summary stats: {'total_revenue_at_risk': 0.0, 'critical_shortages_count': 0, 'delayed_orders_count': 0}
  [PASS] Graph returns all business entities and relationships.
  Edge types: {'located_in', 'stored_at', 'requires', 'replenishes', 'supplied_by', 'manufactured_via', 'fulfills', 'places', 'contains', 'produces'}
  [PASS] Graph contains all expected relationship types.

  [Step 5] Inducing material shortage (RM001)...
  [AUDIT DEBUG] after_update: uid=None, uname=system_initializer, target=products
  [AUDIT DEBUG] after_update: uid=None, uname=system_initializer, target=stock_allocations
  Set RM001 on_hand_qty and StockAllocation to 0.0 in DB.
  Re-querying /api/digital-twin/graph after shortage...
  [AUTH DEBUG] get_current_user: Set context for admin (ID: 1)
  New Summary -> Revenue at Risk: $500.0, Shortages: 1
  [PASS] Shortage propagation and Revenue at Risk computed correctly.

  ==================================================
  ALL DIGITAL TWIN TESTS PASSED SUCCESSFULLY!
  ==================================================
  ```

### Verified File Specifications
1. **`backend/app/routers/digital_twin.py`** (466 lines)
   - Defines route `/api/digital-twin/graph` fetching products, boms, sales orders, manufacturing orders, purchase orders, warehouses, shelves, and allocations.
   - Computes supply-chain dependencies using standard, custom Python logic (`allocate_and_trace`) starting from Sales Order lines, propagating to BoM ingredients.
2. **`backend/test_digital_twin.py`** (194 lines)
   - Integration test setting up dummy tables, orders, stock allocations, and calling test endpoints using FastAPI `TestClient`. Evaluates shortage propagation.
3. **`frontend/src/pages/digital-twin/DigitalTwin.tsx`** (782 lines)
   - Zoomable SVG layout. Computes columns for rendering nodes dynamically. Implements mouse dragging for panning and scroll wheel events for scaling. Implements a Virtual Impact Simulator that performs recursive BoM explosions client-side.
4. **`frontend/src/components/AppShell.tsx`** (163 lines)
   - Integrates "Digital Twin" in the main sidebar positioned directly under "Warehouse Mapping" (Line 38).

---

## 3. Logic Chain

1. **DB Integration check**:
   The backend router utilizes `Depends(get_db)` and queries `db.query(Product).all()`, `db.query(BoM).all()`, etc. It evaluates values based on rows returned dynamically, proving it is not a mock or facade implementation.
2. **Dynamic Calculations check**:
   The recursive `allocate_and_trace` function is a custom algorithm simulating manufacturing requirements matching stock dynamically. The output of `/api/digital-twin/graph` changes based on DB values. Setting `rm001.on_hand_qty = 0.0` in the database dynamically changed the API's returned Revenue at Risk from `$0.0` to `$500.0`, proving authentic behavior.
3. **Frontend Visual components check**:
   The frontend UI does not use pre-built black-box graph solutions. It translates coordinates, sets SVG viewport, and draws cubic bezier curves `pathData = 'M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}'` dynamically, fulfilling the custom React/TypeScript zoomable component requirement.
4. **Conclusion Support**:
   Since all behaviors (graph structure, node/edge population, shortage alert coloring, layout, and simulation calculations) are implemented natively and derived from actual database records or client-side inputs without any hardcoding, the work product is authentic.

---

## 4. Caveats

- **Scale Limits**: The recursive MRP-style shortage algorithm in Python is optimized using dictionary mappings (`product_map`, `bom_map`), but could incur stack depth limits if BoM depths exceed 50+ recursive nested layers (not typical for this application context).
- **Concurrency**: The simulation calculation on the frontend is isolated to client-side memory to avoid database mutations, which is clean and safe, but might drift if another user modifies the inventory concurrently.

---

## 5. Verification Method

To independently verify the integrity audit results:
1. Navigate to the project root directory: `c:\Users\Shivam\Desktop\finalround`.
2. Run the command:
   ```bash
   python -m backend.test_digital_twin
   ```
3. Inspect `backend/app/routers/digital_twin.py` to confirm query patterns.
4. Open the web browser, log in, click "Digital Twin" in the sidebar, and run a simulation (e.g., input "FG001" and "50") to confirm visual rendering of SVG nodes, status highlights, and connection layout.
