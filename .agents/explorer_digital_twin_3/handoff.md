# Handoff Report - Explorer Twin 3

## 1. Observation
- **Database Schema**: Examined `backend/app/models.py` (lines 15–247) and identified `Product`, `SalesOrder`, `SalesOrderLine`, `PurchaseOrder`, `PurchaseOrderLine`, `BoM`, `BoMComponent`, `ManufacturingOrder`, `Warehouse`, `Shelf`, and `StockAllocation` as key data models.
- **Routing & Navigation**: Observed `frontend/src/components/AppShell.tsx` (lines 31–38) for sidebar structure and `frontend/src/App.tsx` (lines 31–39) for page routing.
- **Test Style**: Inspected `backend/test_warehouse_mapping.py` which executes E2E database seeding and API tests via a `run_tests()` Python script.
- **Analysis Artifact**: Written a complete implementation design plan in `.agents/explorer_digital_twin_3/analysis.md`.

## 2. Logic Chain
- Based on `backend/app/models.py`, business dependencies are mapped by matching foreign keys (`customer_name` from `SalesOrder` represents Customer nodes; `vendor_name` from `PurchaseOrder` and `vendor_id` from `Product` represent Supplier nodes).
- To detect root-cause material shortages and calculate revenue at risk, we trace confirmed sales orders down to their finished goods, explode their Bill of Materials (BOM) recursively using an algorithm similar to `explode_bom` in `backend/app/services/insights.py`, check free-to-use quantities (`on_hand_qty - reserved_qty`), and calculate the value of unfulfillable sales order lines.
- To display this without external JavaScript dependencies, we propose using React stateful SVG nodes and bezier curves with custom mouse wheel event handlers to support dynamic zooming and panning.
- In-memory simulation calculates virtual finished good quantities by cloning the graph state locally, running a local recursive BOM explosion, marking shortage nodes red, and displaying the virtual revenue at risk.

## 3. Caveats
- Layered column layout coordinates are static; very large datasets with high node counts will require frontend pagination or search filters to remain legible.
- The simulation calculates requirements based on the current snapshot; it assumes no concurrent edits to the SQLite DB occur during simulation.

## 4. Conclusion
- The proposed backend endpoint `GET /api/digital-twin/graph` will construct the full nodes and edges list and calculate the summary statistics.
- The proposed frontend component `DigitalTwin.tsx` will display this dynamically with custom SVG drag-and-zoom and include a virtual simulation panel.
- Detailed implementation blueprints are fully specified in `.agents/explorer_digital_twin_3/analysis.md`.

## 5. Verification Method
- **Verification Script**: Run the proposed Python test script `backend/test_digital_twin.py` to confirm the API contract, graph structure, and revenue at risk calculations:
  ```bash
  python -m backend.test_digital_twin
  ```
- **Files to Inspect**:
  - `backend/app/routers/digital_twin.py` (New endpoint implementation)
  - `frontend/src/pages/digital-twin/DigitalTwin.tsx` (New interactive UI)
  - `.agents/explorer_digital_twin_3/analysis.md` (Detailed design blueprints)
