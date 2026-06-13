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
