# Handoff Report: Company Digital Twin Exploration & Design

This report provides the structured handoff for the Company Digital Twin backend API, React graph visualization component, virtual simulation center, and automated tests.

---

## 1. Observation

We explored the codebase and observed the following:

- **Database Models (`backend/app/models.py`)**:
  - `Product` model on line 15 includes:
    ```python
    21:     category = Column(String, nullable=False)  # "Raw Material" or "Finished Good"
    ...
    32:     vendor_id = Column(String, nullable=True)  # default vendor (string or numeric identifier)
    ```
  - `SalesOrder` model on line 57 includes:
    ```python
    60:     customer_name = Column(String, nullable=False)
    ```
  - `PurchaseOrder` model on line 82 includes:
    ```python
    85:     vendor_name = Column(String, nullable=False)
    ```
  - Other key models present include: `SalesOrderLine` (line 69), `PurchaseOrderLine` (line 94), `BoM` (line 107), `BoMComponent` (line 120), `ManufacturingOrder` (line 141), `StockAllocation` (line 230), and physical warehouse hierarchy models (`Warehouse`, `Aisle`, `Rack`, `Shelf`) on lines 183-228.

- **Frontend Configuration (`frontend/package.json`)**:
  - Contains standard React/Vite dependencies (React 18.3.1 on line 20, Axios 1.7.2 on line 15, Lucide-react 0.395.0 on line 19) but **no external graph/diagram visualization packages** (such as D3, Vis.js, React Flow, or GoJS).

- **Navigation and Layout (`frontend/src/components/AppShell.tsx`)**:
  - Navigation links are grouped inside `NAV_GROUPS`. Lines 32-37 define the "Operations" group:
    ```typescript
    32:     items: [
    33:       { to: "/sales", label: "Sales Orders", icon: ShoppingCart },
    34:       { to: "/purchase", label: "Purchase Orders", icon: Truck },
    35:       { to: "/manufacturing", label: "Manufacturing", icon: Factory },
    36:       { to: "/warehouse-mapping", label: "Warehouse Mapping", icon: Warehouse },
    37:     ],
    ```

- **Vite Router & Access Control (`frontend/src/App.tsx` and `frontend/src/lib/permissions.ts`)**:
  - Routes are declared in `App.tsx` (lines 31-39).
  - Route permissions are mapped in `permissions.ts` (lines 8-17).

---

## 2. Logic Chain

1. **Graph Nodes (Customers and Suppliers)**: Because no explicit tables exist for Customers or Suppliers, Customer nodes must be extracted from the set of unique `customer_name` values in `SalesOrder`, and Supplier nodes from the union of unique `vendor_name` values in `PurchaseOrder` and `vendor_id` in `Product`.
2. **Graph Visualization**: Because `package.json` contains no graph packages, we must build a custom graph renderer. Rendering nodes and edges inside an SVG element is the most robust, performant, and conflict-free method in React. We can implement standard pan and zoom via state variables `scale` and `translate` applied to a root `<g>` element via standard CSS/SVG matrix transforms.
3. **Graph Layout**: A layered column-based layout provides high readability for supply chain structures. By placing entities in columns (Suppliers → PO/MO → Raw Materials → BoM → Finished Goods → Warehouse → Sales Orders → Customers), we establish a clear, left-to-right business dependency flow without requiring complex force-directed engines.
4. **Simulator Integration**: The virtual impact simulator should run client-side. By cloning the graph data, adding a virtual Sales Order node, recursively exploding the product's BoM to find virtual raw material requirements, and updating node status (Red/Yellow/Green) virtually, we simulate shortages and calculate simulated revenue at risk delta without mutating the SQL database.
5. **Revenue at Risk Calculation**: Revenue at risk is computed at the sales order line level. If a confirmed Sales Order demands quantity $Q$ of finished good $P$, and $P$'s free-to-use qty is insufficient, and production of the shortage is blocked by raw material component shortages, then the unfulfilled value is added to `revenue_at_risk`.

---

## 3. Caveats

- **Warehouse capacity threshold**: We assumed a shelf limit of 500 units for calculating capacity percentages in the absence of an explicit capacity field on the `Shelf` model.
- **Lead time / PO delays**: The database models do not have a `delivery_lead_time` field for products or suppliers. In `PurchaseOrder` status checks, we mock delays by flag-checking if an ordered PO was created more than 7 days ago.

---

## 4. Conclusion

The design plan documented in `analysis.md` fully satisfies the Company Digital Twin requirements (both backend API and frontend React visualizer). It proposes:
1. A FastAPI route `/api/digital-twin/graph` returning a nodes-and-edges representation with status alerts and revenue at risk.
2. A custom SVG-based React component supporting zoom, pan, and a structured layered-column layout.
3. An automated test script `backend/test_digital_twin.py` that validates graph structure and traces induced shortages and revenue at risk.

---

## 5. Verification Method

Once implemented, the Digital Twin module can be verified via:
1. **Automated Verification**: Running the new test script with `python backend/test_digital_twin.py` to assert correct node status propagation and revenue-at-risk calculation.
2. **Manual UI Verification**: Checking that "Digital Twin" displays in the sidebar under "Warehouse Mapping" and navigating to `/digital-twin` to check the interactive SVG graph layout, details drawer, and simulation tool.
