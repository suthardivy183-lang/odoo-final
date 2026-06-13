# Warehouse Mapping & Company Digital Twin Implementation Plan

## Phase 1: DB Schema, Models, and Backend APIs
1. Create SQLAlchemy models in `backend/app/models.py`:
   - `Warehouse`, `Aisle`, `Rack`, `Shelf`, `StockAllocation`, `WarehouseActivity` [Completed]
2. Create Pydantic schemas in `backend/app/schemas.py`. [Completed]
3. Implement API router in `backend/app/routers/warehouse_mapping.py`. [Completed]
4. Register the new router in `backend/app/main.py`. [Completed]
5. Update `seed.py` to generate initial warehouse mapping data. [Completed]

## Phase 2: Manufacturing Order Integration
1. Extend Manufacturing Order router to return location info. [Completed]
2. Integrate location details in `backend/app/models.py`. [Completed]

## Phase 3: Testing Infrastructure (Warehouse Mapping)
1. Write automated test `backend/test_warehouse_mapping.py`. [Completed]

## Phase 4: Frontend Development (Warehouse Mapping)
1. Update Sidebar navigation in `frontend/src/components/AppShell.tsx`. [Completed]
2. Add route mapping in `frontend/src/App.tsx`. [Completed]
3. Build visual map page `WarehouseMapping.tsx`. [Completed]
4. Support QR Codes and Scanner simulator. [Completed]
5. Display activity feed timeline. [Completed]

## Phase 5: Verification & Adversarial Hardening (Warehouse Mapping)
1. Run backend tests and verify frontend TypeScript compile. [Completed]
2. Run forensic auditor to verify integrity. [Completed]

## Phase 6: Company Digital Twin Module (Current)
1. Implement backend endpoint `GET /api/digital-twin/graph` in `backend/app/routers/digital_twin.py`:
   - Query SQLAlchemy models (`Product`, `SalesOrder`, `PurchaseOrder`, `ManufacturingOrder`, `Warehouse`, `Shelf`, `StockAllocation`, `BoM`, `BoMComponent`) to construct connected graph nodes and edges.
   - Establish dependency links: Customer -> Sales Order -> Product (Finished Good) -> BoM -> Product (Raw Material) -> Stock Allocation -> Shelf -> Warehouse; Supplier -> Purchase Order -> Product (Raw Material); Product -> Supplier.
   - Compute node status: Red (Critical Shortage), Yellow (Warning/Draft), Green (Healthy/Active/Completed).
   - Trace root-cause shortages and compute Revenue at Risk for affected sales orders.
2. Register the digital twin router in `backend/app/main.py` and assign proper dependencies.
3. Update frontend routing and navigation:
   - Add sidebar navigation item "Digital Twin" below "Warehouse Mapping" in `frontend/src/components/AppShell.tsx`.
   - Add route mapping for `/digital-twin` in `frontend/src/App.tsx`.
   - Update permissions in `frontend/src/lib/permissions.ts` if needed to allow admin access to the Digital Twin.
4. Implement frontend React page `frontend/src/pages/digital-twin/DigitalTwin.tsx`:
   - Interactive zoomable and panable SVG supply chain graph visualization using custom mouse/wheel handlers (zero package conflict).
   - Display nodes in layered columns for clear structural hierarchy.
   - Highlight node statuses dynamically (Red, Yellow, Green).
   - Clicking nodes opens a contextual detail panel/drawer showing specific metrics.
   - Embed a virtual simulation center on the page for finished goods requirement calculations, highlighting shortages, capacity impact, and revenue at risk (in-memory, no DB write).
5. Implement automated test script `backend/test_digital_twin.py` to seed active orders/inventory, verify correct graph structure, induce shortage, and verify correct revenue-at-risk propagation.
6. Verify and compile both backend tests and frontend static build, then execute the Forensic Auditor to confirm clean integrity.
