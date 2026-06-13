# Warehouse Mapping Implementation Plan

## Overview
This plan details the steps required to implement a robust, verified, and complete Warehouse Mapping module for Shiv Furniture Works ERP.

## Phase 1: DB Schema, Models, and Backend APIs
1. Create SQLAlchemy models in `backend/app/models.py`:
   - `Warehouse` (id, name, description)
   - `Aisle` (id, warehouse_id, name)
   - `Rack` (id, aisle_id, name)
   - `Shelf` (id, rack_id, name, capacity)
   - `StockAllocation` (id, shelf_id, product_id, quantity)
   - `WarehouseActivity` (id, activity_type: Received/Moved/Consumed, product_id, quantity, from_shelf_id, to_shelf_id, timestamp)
2. Create Pydantic schemas in `backend/app/schemas.py`.
3. Implement API router in `backend/app/routers/warehouse_mapping.py` with Location CRUD, Allocation, Transfer, and Activity feed.
4. Register the new router in `backend/app/main.py`.
5. Update `seed.py` or provide test fixtures to generate initial warehouse mapping data.

## Phase 2: Manufacturing Order Integration
1. Extend Manufacturing Order router to return location info for component products in `backend/app/routers/manufacturing.py` (specifically in get_order endpoints).
2. Integrate location details in `backend/app/models.py` for MO components.

## Phase 3: Testing Infrastructure (Dual Track)
1. Write automated test `backend/test_warehouse_mapping.py`.
2. Ensure it covers location creation, allocation, transfer, activity logging, and manufacturing order component location lookup.

## Phase 4: Frontend Development
1. Update Sidebar navigation in `frontend/src/components/AppShell.tsx`.
2. Add route mapping in `frontend/src/App.tsx`.
3. Build the interactive visual map in `frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx`:
   - Display a visual hierarchy grid.
   - Implement details sidebar panel with stored products, quantities, capacity usage.
   - Implement transfer/move action button and modal.
4. Support QR Codes (`qrcode.react` package verification and dynamic display).
5. Build QR Scanner simulator.
6. Display activity feed timeline.
7. Update Manufacturing page to display exact location.

## Phase 5: Verification & Adversarial Hardening
1. Run backend automated tests.
2. Build frontend and verify no TypeScript compilation errors.
3. Run forensic auditor to check integrity of the implementation.
4. Claim victory.
