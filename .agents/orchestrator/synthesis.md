# Synthesis of Explorer Findings: Company Digital Twin Module

## Subagent Results Summary
- 2 completed (Explorer Twin 1, Explorer Twin 3), 1 in-progress (Explorer Twin 2).
- No failures or timeouts. High consensus on all design specs.

## Aggregated Findings
The explorers successfully analyzed the database structures, frontend layout, and testing conventions:
1. **Entity Graph (Backend)**:
   - Customers must be extracted from unique `customer_name` strings in `sales_orders` since there is no separate table.
   - Suppliers must be extracted from unique `vendor_name` strings in `purchase_orders` and default `vendor_id` fields in `products`.
   - Node statuses:
     - **Critical Shortage (Red)**: Free-to-use quantity (`on_hand_qty - reserved_qty`) is less than 0, or insufficient to cover uncompleted Sales Orders.
     - **Warning (Yellow)**: Free-to-use quantity is between 0 and `min_stock_level`.
     - **Healthy (Green)**: Free-to-use quantity >= `min_stock_level`.
2. **Visual Supply Chain Map (Frontend)**:
   - Layout should position nodes in columns left-to-right representing the supply chain path (Supplier -> PO/MO -> Raw Material -> BoM -> FG Product -> Warehouse Shelf -> Sales Order -> Customer).
   - Render using custom React stateful SVG elements, which is lightweight and avoids NPM package/dependency conflicts.
   - Zooming and panning must be supported via mouse dragging and scroll wheel event handlers.
3. **Virtual Simulator (Frontend)**:
   - Provide an in-memory calculation where users enter an SKU and quantity of Finished Goods.
   - Recalculate component requirements locally by exploding the BoM, virtual shortages, and potential revenue-at-risk, updating the SVG map visual styles in-memory without making DB writes.
4. **Verification (Tests)**:
   - Implement `backend/test_digital_twin.py` using standard FastAPI `TestClient(app)` to assert that querying `/api/digital-twin/graph` retrieves correct entities and relationships, and that inducing a shortage correctly computes revenue-at-risk and updates status fields.

## Per-Subagent Status
- **Explorer Twin 1** (Conv ID: `7a93c3cc-6f7d-4519-9fc0-5dc30ca44179`): Completed. Handoff at `.agents/explorer_digital_twin_1/handoff.md`.
- **Explorer Twin 3** (Conv ID: `e7894759-04c2-4a99-b1bd-03d3bf240216`): Completed. Handoff at `.agents/explorer_digital_twin_3/handoff.md`.
- **Explorer Twin 2** (Conv ID: `825c51b4-6611-4d90-b38e-1b3ac1e805c2`): In-Progress (redundant since we have full consensus).
