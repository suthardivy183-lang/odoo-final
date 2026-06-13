# Handoff Report: Company Digital Twin Exploration

## 1. Observation
We explored the database models in `backend/app/models.py`, frontend configurations in `frontend/package.json`, route components, and the testing framework setup.
* Database models: `Product`, `SalesOrder`, `PurchaseOrder`, `BoM`, `ManufacturingOrder`, `Warehouse`, `Aisle`, `Rack`, `Shelf`, `StockAllocation`, `WarehouseActivity` exist in `backend/app/models.py`.
* Customers are represented dynamically as unique `customer_name` values in `SalesOrder`.
* Suppliers are represented dynamically as unique `vendor_name` values in `PurchaseOrder` and `vendor_id` in `Product`.
* Zero external graphing libraries are installed in `frontend/package.json`.

Detailed paths, code lines, and quotes are recorded in `analysis.md` in the same directory.

## 2. Logic Chain
* The digital twin graph represents business relationships (e.g. `Customer` → `SalesOrder` → `Product` → `BoM` → `Materials` → `Warehouse Location` → `Supplier`).
* Shortage tracing calculates total product demand (SO lines + MO components) vs available free-to-use quantities and incoming PO/MO supply. Any unmitigated shortage results in a `red` status.
* Revenue at risk recursively traces finished goods to BOM components. If any component is in shortage, the sales order line is blocked, putting the line's revenue at risk.
* A column-based hierarchical layout places entities from Customers on the left to Suppliers on the right.
* Zoom/pan is achieved using React mouse event listeners (`onMouseDown`, `onMouseMove`, `onWheel`) applying a CSS matrix/transform on a child SVG `<g>` element.

Detailed formulas and coordinate mappings are recorded in `analysis.md`.

## 3. Caveats
* Purchase order delays are based on a 7-day heuristic rather than database-driven lead times due to schema limits.
* Cannibalization calculation allocates stock on a FIFO basis for existing sales orders before the virtual simulated order.

## 4. Conclusion
We proposed a concrete implementation design:
1. A FastAPI endpoint `GET /api/digital-twin/graph` returning a JSON graph structure with nodes, edges, and a business summary.
2. A custom zoomable SVG React page `DigitalTwin.tsx` containing an interactive view of the business map and client-side simulator.
3. An automated test script `backend/test_digital_twin.py` using `FastAPI TestClient` to test healthy/shortage states.

The complete code implementations for the router, schemas, page, and test suite are located in `analysis.md`.

## 5. Verification Method
1. Run backend tests: `python -m backend.test_digital_twin`.
2. Compile and run the frontend client: `npm run dev` in the `frontend` folder to verify TypeScript compilation.
