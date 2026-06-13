## 2026-06-14T00:41:51Z
Implement the Company Digital Twin requirements:
1. Backend router & endpoint: `backend/app/routers/digital_twin.py` exposing `GET /api/digital-twin/graph`.
   - Extract Customers, Sales Orders, Products, BOMs, Manufacturing Orders, Purchase Orders, Suppliers, and Warehouse Shelves.
   - Establish edges.
   - Trace shortages recursively down the BoM explosion, calculate total revenue at risk, status checks.
2. Register in backend/app/main.py.
3. React UI in `frontend/src/pages/digital-twin/DigitalTwin.tsx` (Interactive SVG with panning/zooming, no external npm graphing packages).
   - Details Drawer, Simulation Center panel.
   - Register route, sidebar item, access permissions.
4. Test script `backend/test_digital_twin.py`.
5. Compile and Verify: run tests, run tsc -b / npm run build.
