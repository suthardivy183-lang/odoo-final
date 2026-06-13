# Scope: Frontend Implementation for Warehouse Mapping

## Objective
Implement all frontend components, routes, types, hooks, and UI pages for the Warehouse Mapping module in React/TypeScript.

## Files to Edit
1. `frontend/src/App.tsx`: add route for `/warehouse-mapping` pointing to `WarehouseMapping` page.
2. `frontend/src/components/AppShell.tsx`: add "Warehouse Mapping" sidebar link below "Products" and above "Sales Orders". Use a suitable icon from `lucide-react` (e.g. `Warehouse` or `MapPin`).
3. `frontend/src/lib/types.ts`: add interface definitions for `Warehouse`, `Aisle`, `Rack`, `Shelf`, `StockAllocation`, `WarehouseActivity`, and `ComponentLocationInfo`. Update `ManufacturingOrderComponent` to include `storage_locations?: ComponentLocationInfo[]`.
4. `frontend/src/hooks/useWarehouse.ts` (New file): implement React Query hooks for locations CRUD, allocations, transfers, and activities.
5. `frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx` (New file): implement the main warehouse map dashboard:
   - Selectors for Warehouse and Aisle.
   - A grid layout mapping out Racks and Shelves (showing empty vs occupied status).
   - A Details Sidebar Panel that opens when clicking a Shelf, showing name/URI, allocations, capacity, and action buttons.
   - "Allocate Stock" and "Transfer Stock" modals.
   - A mockup "Scan QR Code" utility that lists shelves in a dropdown to simulate scanning and immediately load that shelf's details in the panel.
   - QR code generation using `qrcode.react` (if needed, install it in `frontend/` using npm: `npm install qrcode.react` or implement a simple SVG-based lookup QR placeholder).
   - A Warehouse Activity Feed at the bottom displaying recent movements.
6. `frontend/src/pages/manufacturing/ManufacturingDetail.tsx`: update the components list to show the exact storage location (Aisle -> Rack -> Shelf) for each raw material.

## Design Guidelines
- Maintain Tailwind style matching the rest of the application.
- Ensure TypeScript compilation completes without errors (`npm run build` or `tsc -b`).
