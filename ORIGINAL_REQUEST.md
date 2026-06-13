# Original User Request

## Initial Request — 2026-06-13T13:17:49Z

A standalone "Warehouse Mapping" module for Shiv Furniture Works ERP to help users locate materials quickly, view warehouse organization visually, support manufacturing material picking, generate QR codes, and trace warehouse movements.

Working directory: c:\Users\Shivam\Desktop\finalround
Integrity mode: benchmark

## Requirements

### R1. Database Schema & Models
1. **Warehouse Hierarchy**: Create models for `Warehouse`, `Aisle`, `Rack`, and `Shelf` with hierarchical relationships (Warehouse → Aisle → Rack → Shelf).
2. **Stock Allocation**: Track product inventory levels (`Product`, `Quantity`) allocated to specific `Shelf` locations.
3. **Warehouse Activity Log**: Maintain a movement log to record events when inventory is:
   - `Received` (initial stock or PO receive)
   - `Moved`/`Transferred` (between shelves/racks)
   - `Consumed` (for manufacturing orders)

### R2. Backend APIs
1. **Location CRUD**: Provide full CRUD endpoints (`GET`, `POST`, `PUT`, `DELETE`) for warehouses, aisles, racks, and shelves.
2. **Inventory Placement & Movements**: Provide endpoints to assign products to a shelf and transfer stock from one shelf to another, creating `WarehouseActivity` log entries.
3. **Manufacturing Integration**: Extend the Manufacturing Order endpoints to retrieve and include storage location information (e.g., Warehouse → Aisle → Rack → Shelf) for each required component.
4. **Activity Logs**: Provide a GET endpoint to fetch recent warehouse movements.

### R3. Visual Warehouse Map & Location Details Panel
1. **Visual Map**: Render a visual interactive layout of the warehouse organization (Aisles, Racks, Shelves) in a clean, professional grid-like dashboard.
2. **Location Details Panel**: Clicking any location (aisle/rack/shelf) reveals a details panel with:
   - Location Name/URI
   - List of stored products and quantities
   - Capacity usage calculation (e.g., percentage of occupied slots or simple capacity percentage)
   - Action/button to transfer/move items

### R4. Manufacturing Material Locator
1. Update the frontend Manufacturing Order detail view to display the exact storage location (Aisle → Rack → Shelf) for all needed materials/components, assisting workers in picking components.

### R5. QR Code Support
1. Generate QR codes on the frontend for warehouses, racks, and shelves (e.g., using `qrcode.react`).
2. Provide a mock/simulated "Scan QR Code" utility in the UI where users can lookup/load location info, showing stored products and inventory quantities.

### R6. Warehouse Activity Feed
1. Display recent movements (Received, Transferred, Consumed) in a clean activity feed on the Warehouse Mapping dashboard.

### R7. Navigation & Sidebar
1. Add a standalone "Warehouse Mapping" link in the sidebar, positioned below "Products" and above "Sales Orders". Do not place it inside the AI Operations Center.

## Verification Plan

### Automated Tests
- Create a test script `backend/test_warehouse_mapping.py` that:
  1. Creates warehouses, aisles, racks, shelves.
  2. Allocates inventory to a shelf.
  3. Transfers inventory between locations and verifies stock updates.
  4. Retrieves storage locations for a Manufacturing Order's components.
  5. Asserts the correct creation of warehouse activity logs.

### Manual Verification
- Start the server, navigate to the new sidebar item, create locations, view the visual layout, verify QR code rendering and simulated scanning, and check component locations on MO detail views.

## Acceptance Criteria

### Backend & API
- [ ] Database schemas support Warehouse → Aisle → Rack → Shelf.
- [ ] CRUD endpoints for locations and movement API work correctly.
- [ ] Automated test `backend/test_warehouse_mapping.py` executes successfully.

### Frontend UI
- [ ] Sidebar includes "Warehouse Mapping" in the correct position.
- [ ] Interactive Visual Warehouse Map page is functional.
- [ ] Clicking a location opens the Location Details Panel showing correct quantities.
- [ ] Manufacturing Order page lists component storage locations.
- [ ] QR Codes are displayed and can be simulated-scanned to retrieve details.
- [ ] Recent movements are displayed in the activity feed.

## Follow-up — 2026-06-14T00:37:18+05:30

A live, interactive digital representation of the entire business (Company Digital Twin) that visualizes connected relationships between customers, sales orders, products, BOMs, raw materials, inventory, warehouse locations, manufacturing orders, purchase orders, and suppliers.

Working directory: c:\Users\Shivam\Desktop\finalround
Integrity mode: benchmark

## Requirements

### R1. Graph Data API (Backend)
1. **Entity Graph Generation**: Provide a backend endpoint `GET /api/digital-twin/graph` that queries the SQLite database to construct a connected graph (nodes and edges) representing all active objects: Customers, Sales Orders, Products, BOMs, Raw Materials, Inventory, Warehouse Locations, Manufacturing Orders, Purchase Orders, and Suppliers.
2. **Relationships**: Establish links representing business dependencies (Customer → Sales Order → Product → BOM → Materials → Inventory → Warehouse → Supplier).
3. **Problem Tracing & Root Cause**: Trace critical issues (e.g. material shortage) dynamically to identify affected manufacturing orders, delayed sales orders, and total revenue at risk.

### R2. Interactive Visual Graph UI (Frontend)
1. **Navigable Graph View**: Render an interactive, zoomable, and navigable graph layout (nodes and connections) instead of lists or tables. Use a clean, custom zoomable SVG or Canvas-based visual graph component implemented directly in React/TypeScript to ensure zero package conflicts.
2. **Status Highlighting**: Highlight nodes with status/occupancy alerts (e.g., Red = Critical Shortage, Yellow = Delayed, Green = Active/Healthy).
3. **Contextual Detail Drawer**: Clicking any node opens a sidebar/details panel showing contextual information:
   - Product Node: Demand, Inventory, and Manufacturing Status.
   - Material Node: Inventory, Warehouse Locations, and Suppliers.
   - Supplier Node: Performance, Open POs, and Lead Times.

### R3. Simulation Integration
1. **Virtual Impact Simulator**: Provide a simulation capability on the page where users can input a quantity of a finished good (e.g., "Simulate 5000 Chairs").
2. **Virtual Graph Update**: Calculate requirements and highlight shortages, warehouse capacity impacts, and potential revenue at risk without mutating the database (frontend-only calculation or backend-supported simulation are both acceptable).

### R4. Sidebar Navigation
1. Add a new navigation item "Digital Twin" in the main sidebar. Position it below "Warehouse Mapping".

## Verification Plan

### Automated Tests
- Create `backend/test_digital_twin.py` to:
  1. Seed active orders, products, and inventory.
  2. Query `/api/digital-twin/graph` and assert that all business entities and relationships are mapped.
  3. Induce a shortage (e.g., Wood Plank stock to 0) and verify that the API reports affected orders and revenue at risk.

### Manual Verification
- Launch the UI, navigate to "Digital Twin", view and navigate the interactive graph, run a simulation, click nodes to inspect details, and confirm the root cause highlighting.

## Acceptance Criteria

### Backend & API
- [ ] Endpoint `/api/digital-twin/graph` returns a complete nodes-and-edges graph.
- [ ] Root cause tracing and revenue-at-risk calculations are returned correctly.
- [ ] Automated tests in `backend/test_digital_twin.py` pass.

### Frontend UI
- [ ] Sidebar includes "Digital Twin" under "Warehouse Mapping".
- [ ] Interactive, zoomable, navigable business graph is displayed.
- [ ] Clicking nodes opens details panel.
- [ ] Critical shortages highlight impact paths.
- [ ] Simulation center updates graph state virtually.
