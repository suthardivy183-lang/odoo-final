# Company Digital Twin Exploration & Design Report

## 1. Observation
From inspecting the codebase, the following files and code structures were directly observed:

### A. Database Models (`backend/app/models.py`)
- **Product** (Lines 15–56): Contains attributes `sku`, `name`, `category` ("Raw Material" or "Finished Good"), `sales_price`, `cost_price`, `on_hand_qty`, `reserved_qty`, `min_stock_level`, `procure_on_demand`, `procurement_type`, `vendor_id`, and `bom_id`. Includes relationships `bom`, `active_bom`, and `allocations`.
- **SalesOrder** & **SalesOrderLine** (Lines 57–81): `SalesOrder` contains `customer_name`, `status` ("Draft", "Confirmed", "Completed", "Cancelled"), and `total_amount`. `SalesOrderLine` references `product_id` and tracks `quantity`, `unit_price`, `total_price`, and `delivered_qty`.
- **PurchaseOrder** & **PurchaseOrderLine** (Lines 82–106): `PurchaseOrder` contains `vendor_name`, `status` ("Draft", "Ordered", "Received", "Cancelled"), and `total_amount`. `PurchaseOrderLine` tracks `product_id`, `quantity`, `unit_price`, `total_price`, and `received_qty`.
- **BoM** & **BoMComponent** & **BoMOperation** (Lines 107–140): `BoM` links to a finished good `Product`. `BoMComponent` links to `Product` (raw material) via `component_product_id` and defines the required `quantity` per finished good unit. `BoMOperation` defines operations like sequence, work center, and standard time.
- **ManufacturingOrder** (Lines 141–182): Tracks `product_id`, `bom_id`, `quantity`, `status` ("Draft", "Planned", "In Progress", "Completed", "Cancelled"), and has relationship arrays for `components` and `operations`.
- **Warehouse** & **Aisle** & **Rack** & **Shelf** (Lines 183–229): Represents physical storage hierarchy. `Shelf` has relationship `allocations` pointing to `StockAllocation`.
- **StockAllocation** (Lines 230–247): Associates a `product_id` and a `shelf_id` with a specific `quantity`.
- **WarehouseActivity** (Lines 248–262): Logs historical stock movements (`Consumed`, `Allocated`, `Transferred`).

### B. Navigation & Routing (`frontend/src/components/AppShell.tsx` and `frontend/src/App.tsx`)
- `AppShell.tsx` (Lines 31–38) organizes routes in `NAV_GROUPS`. Under the "Operations" group, we find:
  ```typescript
  { to: "/sales", label: "Sales Orders", icon: ShoppingCart },
  { to: "/purchase", label: "Purchase Orders", icon: Truck },
  { to: "/manufacturing", label: "Manufacturing", icon: Factory },
  { to: "/warehouse-mapping", label: "Warehouse Mapping", icon: Warehouse },
  ```
- `App.tsx` (Lines 31–39) maps URLs to page components inside a `ProtectedRoute` and `AppShell` layout:
  ```typescript
  <Route path="/warehouse-mapping" element={<WarehouseMapping />} />
  <Route path="/sales" element={<Sales />} />
  ```

### C. Existing Testing Style (`backend/test_warehouse_mapping.py`)
- Self-contained Python script (not using standard pytest fixtures) containing a `run_tests()` function.
- Uses FastAPI `TestClient(app)` to send HTTP requests, logs in as admin, seeds the database, calls CRUD and action APIs, and checks assertions using `assert` statements (Lines 10–244).

---

## 2. Logic Chain
To design a fully connected graph representing the Odoo-style ERP's current state, we translate relational database links into graphical vertices (nodes) and edges:

### A. Graph Node Representations
1. **Customer Nodes**: Represented by unique `customer_name` values queried from `SalesOrder`.
   - Node ID: `customer:<customer_name>`
2. **Supplier Nodes**: Derived from unique values combining `PurchaseOrder.vendor_name` and `Product.vendor_id` (default supplier).
   - Node ID: `supplier:<vendor_name>`
3. **Sales Orders**: Represented by `SalesOrder` records.
   - Node ID: `sales_order:<id>`
4. **Products (Finished Goods & Raw Materials)**: Represented by `Product` records.
   - Node ID: `product:<id>`
5. **BOMs**: Represented by `BoM` records.
   - Node ID: `bom:<id>`
6. **Warehouse Locations**: Represented by active `Warehouse` records and `Shelf` records with active `StockAllocation`.
   - Node ID: `warehouse:<id>` or `shelf:<id>`
7. **Manufacturing Orders (MOs)**: Represented by `ManufacturingOrder` records.
   - Node ID: `manufacturing_order:<id>`
8. **Purchase Orders (POs)**: Represented by `PurchaseOrder` records.
   - Node ID: `purchase_order:<id>`

### B. Graph Edges (Business Dependencies)
Edges represent flow, constraints, and dependencies:
- **`Customer` $\rightarrow$ `SalesOrder`**: Customer placed the sales order (`places`).
- **`SalesOrder` $\rightarrow$ `Product`**: Sales order demands a product (`demands`).
- **`Product` $\rightarrow$ `BoM`**: Finished good has a recipe (`manufactured_via`).
- **`BoM` $\rightarrow$ `Product` (Raw Material)**: Recipe requires a material component (`requires`).
- **`Product` (Raw Material) $\rightarrow$ `StockAllocation` $\rightarrow$ `Shelf`**: Material is stored at a location (`stored_at`).
- **`Shelf` $\rightarrow$ `Warehouse`**: Shelf belongs to a warehouse (`located_in`).
- **`ManufacturingOrder` $\rightarrow$ `Product` (Finished Good)**: MO will produce this FG (`produces`).
- **`Product` (Raw Material) $\rightarrow$ `ManufacturingOrder`**: MO consumes this material (`input_for`).
- **`SalesOrder` $\rightarrow$ `ManufacturingOrder`**: Sales Order links to MO (if specific production is scheduled).
- **`Supplier` $\rightarrow$ `PurchaseOrder`**: Supplier fulfills a purchase order (`fulfills`).
- **`PurchaseOrder` $\rightarrow$ `Product` (Raw Material)**: PO replenishes raw material stock (`replenishes`).
- **`Product` $\rightarrow$ `Supplier`**: Product is supplied by default vendor (`supplied_by`).

### C. Node Status Calculation Logic
- **Product Node (Raw Material/Finished Good)**:
  - **Red (Critical Shortage)**: Free-to-use quantity (`on_hand_qty - reserved_qty`) is negative, OR total uncompleted sales order demand exceeds total available stock.
  - **Yellow (Warning)**: Free-to-use quantity is between `0` and `min_stock_level`.
  - **Green (Healthy)**: Free-to-use quantity $\ge$ `min_stock_level`.
- **Sales Order Node**:
  - **Red**: Confirmed and at least one ordered product is in critical shortage (Red).
  - **Yellow**: Confirmed but waiting for stock/production; or delayed POs exist for items.
  - **Green**: Completed / Fully Delivered.
- **Manufacturing Order Node**:
  - **Red**: Planned/In Progress and one or more component materials are in critical shortage (Red).
  - **Yellow**: Planned/In Progress, components are below safety stock, or start date is past but not started.
  - **Green**: Completed.
- **Purchase Order Node**:
  - **Red**: Status is Ordered but past estimated arrival/lead time (Delayed).
  - **Yellow**: Draft or Ordered and within lead time.
  - **Green**: Received / Completed.
- **Warehouse/Shelf Node**:
  - **Red**: Occupancy capacity > 100%.
  - **Yellow**: Occupancy capacity between 85% and 100%.
  - **Green**: Occupancy capacity < 85%.
- **Supplier Node**:
  - **Red**: Multiple delayed/overdue purchase orders.
  - **Yellow**: One delayed purchase order.
  - **Green**: All open POs are on time.
- **Customer Node**:
  - **Red**: Has at least one Sales Order marked Red.
  - **Yellow**: Has at least one Sales Order marked Yellow (no Red).
  - **Green**: All Sales Orders Completed or Green.

### D. Revenue at Risk Algorithm
1. Identify all confirmed, uncompleted `SalesOrder` records.
2. For each Sales Order, check its `lines`. For each line:
   - Calculate unfulfilled quantity: $Q_{unfulfilled} = Q_{quantity} - Q_{delivered\_qty}$.
   - If $Q_{unfulfilled} \le 0$, skip.
3. Compute the free-to-use quantity of the finished good. If it is insufficient to cover $Q_{unfulfilled}$:
   - Check if there is an active `ManufacturingOrder` producing this finished good.
   - Run a recursive BOM explosion (like `explode_bom` in `insights.py`) to determine if there is a shortage in component raw materials.
4. If a shortage of finished good stock or raw material components exists that prevents fulfillment of the line:
   - Line is marked "At Risk".
   - Line Revenue at Risk = $Q_{unfulfilled} \times \text{unit\_price}$.
5. Accumulate the Revenue at Risk per Sales Order and aggregate the total across the business.
6. Trace this back to the shortage root cause: which specific raw material(s) have negative free stock or insufficient POs, and list them in the `/api/digital-twin/graph` JSON summary.

---

## 3. Caveats
- **Scale and Layout Overlap**: Layered column layouts are simple and clear, but if the database has hundreds of products or orders, columns will stretch vertically and nodes may overlap. A search/filter input on the frontend (e.g. filter by Customer or SKU) must be implemented to prune the graph for visibility.
- **Single-Location Storage Assumption**: The warehouse mapping system supports multi-shelf stock allocations. The status and connection calculations must aggregate quantities across all shelves for a product to compute the net free stock.
- **No Database Modification Constraint**: For the virtual impact simulator, calculations must happen strictly in-memory. If a user simulates a finished good quantity, the simulation updates the graph model locally on the client-side without sending modifying requests (no `POST` or `PUT` that writes to SQLite).

---

## 4. Conclusion & Actionable Design

### A. Backend API Design: `GET /api/digital-twin/graph`
This endpoint queries SQLite tables, builds the node-link graph data structure, computes status alerts, calculates revenue at risk, and returns a consolidated graph response.

#### Target Path: `backend/app/routers/digital_twin.py`
Create a new FastAPI router file with the following complete implementation outline:

```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime
from backend.app.database import get_db
from backend.app.auth import get_current_user
from backend.app.models import (
    Product, SalesOrder, PurchaseOrder, ManufacturingOrder, 
    Warehouse, Shelf, StockAllocation, BoM, BoMComponent
)

router = APIRouter(prefix="/api/digital-twin", tags=["Digital Twin"])

@router.get("/graph")
def get_digital_twin_graph(
    include_completed: bool = Query(False, description="Include completed orders in the graph"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Fetch raw data from DB
    products = db.query(Product).all()
    boms = db.query(BoM).all()
    
    so_query = db.query(SalesOrder)
    mo_query = db.query(ManufacturingOrder)
    po_query = db.query(PurchaseOrder)
    
    if not include_completed:
        so_query = so_query.filter(SalesOrder.status.in_(["Draft", "Confirmed", "Partially Delivered"]))
        mo_query = mo_query.filter(ManufacturingOrder.status.in_(["Draft", "Planned", "In Progress"]))
        po_query = po_query.filter(PurchaseOrder.status.in_(["Draft", "Ordered"]))
        
    sales_orders = so_query.all()
    mfg_orders = mo_query.all()
    purchase_orders = po_query.all()
    warehouses = db.query(Warehouse).all()
    shelves = db.query(Shelf).all()
    allocations = db.query(StockAllocation).all()

    nodes = []
    edges = []
    
    # 2. Extract Customer and Supplier sets
    customers = {so.customer_name for so in sales_orders if so.customer_name}
    suppliers = {po.vendor_name for po in purchase_orders if po.vendor_name}
    for p in products:
        if p.vendor_id:
            suppliers.add(p.vendor_id)

    # 3. Build Node Objects
    # Customers
    for cust in customers:
        nodes.append({
            "id": f"customer:{cust}",
            "type": "customer",
            "label": cust,
            "status": "green", # Initial, will update based on SO status
            "details": {"name": cust}
        })

    # Suppliers
    for supp in suppliers:
        nodes.append({
            "id": f"supplier:{supp}",
            "type": "supplier",
            "label": supp,
            "status": "green",
            "details": {"name": supp}
        })

    # Sales Orders
    for so in sales_orders:
        nodes.append({
            "id": f"sales_order:{so.id}",
            "type": "sales_order",
            "label": f"SO-{so.id}",
            "status": "green",
            "details": {"customer": so.customer_name, "status": so.status, "amount": so.total_amount}
        })

    # Products
    for p in products:
        nodes.append({
            "id": f"product:{p.id}",
            "type": "product",
            "label": p.name,
            "status": "green",
            "details": {
                "sku": p.sku, 
                "category": p.category, 
                "on_hand": p.on_hand_qty, 
                "reserved": p.reserved_qty,
                "free_to_use": p.free_to_use_qty,
                "min_stock": p.min_stock_level,
                "price": p.sales_price
            }
        })

    # Manufacturing Orders
    for mo in mfg_orders:
        nodes.append({
            "id": f"manufacturing_order:{mo.id}",
            "type": "manufacturing_order",
            "label": f"MO-{mo.id}",
            "status": "green",
            "details": {"qty": mo.quantity, "status": mo.status}
        })

    # Purchase Orders
    for po in purchase_orders:
        nodes.append({
            "id": f"purchase_order:{po.id}",
            "type": "purchase_order",
            "label": f"PO-{po.id}",
            "status": "green",
            "details": {"vendor": po.vendor_name, "status": po.status, "amount": po.total_amount}
        })

    # BOMs
    for bom in boms:
        nodes.append({
            "id": f"bom:{bom.id}",
            "type": "bom",
            "label": f"BOM - {bom.name}",
            "status": "green",
            "details": {"name": bom.name}
        })

    # Warehouse Shelves
    for sh in shelves:
        nodes.append({
            "id": f"shelf:{sh.id}",
            "type": "shelf",
            "label": sh.name,
            "status": "green",
            "details": {"name": sh.name}
        })

    # 4. Build Edges (Relationships)
    # Customer -> Sales Order
    for so in sales_orders:
        if so.customer_name:
            edges.append({
                "id": f"edge-cust-so-{so.id}",
                "source": f"customer:{so.customer_name}",
                "target": f"sales_order:{so.id}",
                "type": "places"
            })
            
    # Sales Order -> Products
    for so in sales_orders:
        for line in so.lines:
            edges.append({
                "id": f"edge-so-prod-{so.id}-{line.product_id}",
                "source": f"sales_order:{so.id}",
                "target": f"product:{line.product_id}",
                "type": "contains",
                "quantity": line.quantity
            })

    # Product -> BOM
    for bom in boms:
        edges.append({
            "id": f"edge-prod-bom-{bom.product_id}-{bom.id}",
            "source": f"product:{bom.product_id}",
            "target": f"bom:{bom.id}",
            "type": "manufactured_via"
        })
        # BOM -> Raw Materials
        for comp in bom.components:
            edges.append({
                "id": f"edge-bom-comp-{bom.id}-{comp.component_product_id}",
                "source": f"bom:{bom.id}",
                "target": f"product:{comp.component_product_id}",
                "type": "requires",
                "quantity": comp.quantity
            })

    # Product -> Shelf (Stock Allocations)
    for alloc in allocations:
        if alloc.quantity > 0:
            edges.append({
                "id": f"edge-alloc-{alloc.product_id}-{alloc.shelf_id}",
                "source": f"product:{alloc.product_id}",
                "target": f"shelf:{alloc.shelf_id}",
                "type": "stored_at",
                "quantity": alloc.quantity
            })

    # Manufacturing Orders
    for mo in mfg_orders:
        edges.append({
            "id": f"edge-mo-prod-{mo.id}-{mo.product_id}",
            "source": f"manufacturing_order:{mo.id}",
            "target": f"product:{mo.product_id}",
            "type": "produces"
        })
        for comp in mo.components:
            edges.append({
                "id": f"edge-mo-comp-{mo.id}-{comp.component_product_id}",
                "source": f"product:{comp.component_product_id}",
                "target": f"manufacturing_order:{mo.id}",
                "type": "input_for",
                "quantity": comp.required_quantity
            })

    # Purchase Orders
    for po in purchase_orders:
        edges.append({
            "id": f"edge-supp-po-{po.vendor_name}-{po.id}",
            "source": f"supplier:{po.vendor_name}",
            "target": f"purchase_order:{po.id}",
            "type": "fulfills"
        })
        for line in po.lines:
            edges.append({
                "id": f"edge-po-line-{po.id}-{line.product_id}",
                "source": f"purchase_order:{po.id}",
                "target": f"product:{line.product_id}",
                "type": "replenishes",
                "quantity": line.quantity
            })

    # Default Suppliers
    for p in products:
        if p.vendor_id:
            edges.append({
                "id": f"edge-prod-supp-{p.id}-{p.vendor_id}",
                "source": f"product:{p.id}",
                "target": f"supplier:{p.vendor_id}",
                "type": "supplied_by"
            })

    # 5. Compute Status & Revenue at Risk
    # Let's track shortages and delayed POs
    product_lookup = {p.id: p for p in products}
    node_map = {n["id"]: n for n in nodes}
    
    # Track critical shortages of raw materials
    critical_shortages = set()
    for p in products:
        if p.free_to_use_qty < 0:
            critical_shortages.add(p.id)
            node_map[f"product:{p.id}"]["status"] = "red"
        elif p.free_to_use_qty < p.min_stock_level:
            node_map[f"product:{p.id}"]["status"] = "yellow"

    total_revenue_at_risk = 0.0
    
    # Evaluate Sales Orders and Customer impact
    for so in sales_orders:
        is_so_red = False
        revenue_at_risk = 0.0
        for line in so.lines:
            unfulfilled = line.quantity - line.delivered_qty
            if unfulfilled > 0:
                prod = product_lookup.get(line.product_id)
                if prod and (prod.free_to_use_qty < unfulfilled or prod.id in critical_shortages):
                    is_so_red = True
                    revenue_at_risk += unfulfilled * line.unit_price
                    
        if is_so_red:
            node_map[f"sales_order:{so.id}"]["status"] = "red"
            node_map[f"sales_order:{so.id}"]["details"]["revenue_at_risk"] = revenue_at_risk
            total_revenue_at_risk += revenue_at_risk
            # Propagate to Customer Node
            if so.customer_name:
                cust_node = node_map.get(f"customer:{so.customer_name}")
                if cust_node:
                    cust_node["status"] = "red"
        elif so.status == "Draft":
            node_map[f"sales_order:{so.id}"]["status"] = "yellow"

    # Evaluate Manufacturing Orders status based on material components
    for mo in mfg_orders:
        is_mo_red = False
        for comp in mo.components:
            rem = comp.required_quantity - comp.consumed_quantity
            if rem > 0:
                comp_prod = product_lookup.get(comp.component_product_id)
                if comp_prod and comp_prod.free_to_use_qty < rem:
                    is_mo_red = True
        if is_mo_red:
            node_map[f"manufacturing_order:{mo.id}"]["status"] = "red"
        elif mo.status == "Draft":
            node_map[f"manufacturing_order:{mo.id}"]["status"] = "yellow"

    # Evaluate Purchase Orders (e.g. highlight draft POs)
    for po in purchase_orders:
        if po.status == "Draft":
            node_map[f"purchase_order:{po.id}"]["status"] = "yellow"

    # Format output
    return {
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "total_revenue_at_risk": total_revenue_at_risk,
            "critical_shortages_count": len(critical_shortages),
            "delayed_orders_count": sum(1 for so in sales_orders if node_map[f"sales_order:{so.id}"]["status"] == "red")
        }
    }
```

Add the route registration inside `backend/app/main.py`:
```python
from backend.app.routers import digital_twin
# ...
app.include_router(digital_twin.router, dependencies=[Depends(require_module("dashboard"))])
```

---

### B. Frontend Page Design: Custom Zoomable React Component
Implement the new page in `frontend/src/pages/digital-twin/DigitalTwin.tsx`. It contains the layout logic, SVG drawing, mouse handlers, and details panel drawer.

#### Zoom, Pan, and Layered Column Coordinates Math
Let the layout place nodes in columns according to node types:
- Column 0: **Customer** ($X = 100$)
- Column 1: **Sales Order** ($X = 300$)
- Column 2: **Finished Good** ($X = 500$)
- Column 3: **BOM & MO** ($X = 700$)
- Column 4: **Raw Material** ($X = 900$)
- Column 5: **Shelf** ($X = 1100$)
- Column 6: **PO** ($X = 1300$)
- Column 7: **Supplier** ($X = 1500$)

For a column $c$ with $N$ nodes, each node $i$ gets height:
$$Y_i = i \times \text{rowHeight} + \frac{H_{max} - (N - 1) \times \text{rowHeight}}{2}$$
This keeps the columns centered.

#### Component Code Blueprint (`frontend/src/pages/digital-twin/DigitalTwin.tsx`)
```tsx
import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  status: "green" | "yellow" | "red";
  details: any;
  x?: number;
  y?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  quantity?: number;
}

export default function DigitalTwin() {
  const { data: rawGraphData, isLoading, refetch } = useQuery({
    queryKey: ["digital-twin-graph"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/digital-twin/graph", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      return res.data;
    }
  });

  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[]; summary: any } | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Zoom & Pan State
  const [scale, setScale] = useState(0.8);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Simulator State
  const [simProductSku, setSimProductSku] = useState("");
  const [simQuantity, setSimQuantity] = useState(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState<any>(null);

  // 1. Arrange nodes in layered column coordinates
  useEffect(() => {
    if (!rawGraphData) return;
    const nodes = JSON.parse(JSON.stringify(rawGraphData.nodes)) as GraphNode[];
    const edges = rawGraphData.edges as GraphEdge[];

    const columnMapping: Record<string, number> = {
      customer: 0,
      sales_order: 1,
      product: 2, // will separate FG and RM dynamically
      bom: 3,
      manufacturing_order: 3,
      shelf: 5,
      purchase_order: 6,
      supplier: 7
    };

    // Refined separation of Finished Goods (has BOM or category is Finished Good) and Raw Materials
    nodes.forEach(n => {
      if (n.type === "product") {
        if (n.details.category === "Finished Good") {
          n.type = "product_fg";
        } else {
          n.type = "product_rm";
        }
      }
    });

    const finalColumnMapping: Record<string, number> = {
      customer: 0,
      sales_order: 1,
      product_fg: 2,
      bom: 3,
      manufacturing_order: 3,
      product_rm: 4,
      shelf: 5,
      purchase_order: 6,
      supplier: 7
    };

    const columns: Record<number, GraphNode[]> = {};
    Object.keys(finalColumnMapping).forEach((_, idx) => { columns[idx] = []; });

    nodes.forEach(node => {
      const colIdx = finalColumnMapping[node.type] ?? 0;
      columns[colIdx].push(node);
    });

    const columnWidth = 220;
    const rowHeight = 70;
    const maxColumnNodes = Math.max(...Object.values(columns).map(arr => arr.length));
    const maxHeight = maxColumnNodes * rowHeight;

    Object.keys(columns).forEach(colKey => {
      const colIdx = parseInt(colKey);
      const arr = columns[colIdx];
      const colHeight = arr.length * rowHeight;
      const startY = (maxHeight - colHeight) / 2;
      arr.forEach((node, itemIdx) => {
        node.x = colIdx * columnWidth + 80;
        node.y = startY + itemIdx * rowHeight + 40;
      });
    });

    setGraphData({ nodes, edges, summary: rawGraphData.summary });
  }, [rawGraphData]);

  // 2. Mouse Handlers for Dragging / Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target instanceof SVGElement && e.target.tagName === "svg") {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // 3. Wheel Handler for Zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = 1.1;
    const newScale = e.deltaY < 0 ? scale * zoomFactor : scale / zoomFactor;
    if (newScale < 0.1 || newScale > 3) return;

    const xs = (mouseX - offset.x) / scale;
    const ys = (mouseY - offset.y) / scale;

    setOffset({
      x: mouseX - xs * newScale,
      y: mouseY - ys * newScale
    });
    setScale(newScale);
  };

  // 4. Client-side Simulation Execution
  const handleRunSimulation = () => {
    if (!graphData) return;
    setIsSimulating(true);

    // Deep copy current graph to modify state virtually
    const simNodes = JSON.parse(JSON.stringify(graphData.nodes)) as GraphNode[];
    const simEdges = JSON.parse(JSON.stringify(graphData.edges)) as GraphEdge[];

    const fgNode = simNodes.find(n => n.type === "product_fg" && n.details.sku.toLowerCase() === simProductSku.toLowerCase());
    if (!fgNode) {
      alert("Finished Good SKU not found in Graph!");
      setIsSimulating(false);
      return;
    }

    // Explode BoM component requirements
    const virtualRequirements: Record<number, number> = {};
    const explode = (prodId: number, qty: number) => {
      const bomEdge = simEdges.find(e => e.source === `product:${prodId}` && e.type === "manufactured_via");
      if (!bomEdge) {
        virtualRequirements[prodId] = (virtualRequirements[prodId] || 0) + qty;
        return;
      }
      const bomId = bomEdge.target;
      const compEdges = simEdges.filter(e => e.source === bomId && e.type === "requires");
      compEdges.forEach(cEdge => {
        const compId = parseInt(cEdge.target.split(":")[1]);
        explode(compId, qty * (cEdge.quantity || 1));
      });
    };

    const fgProdId = parseInt(fgNode.id.split(":")[1]);
    explode(fgProdId, simQuantity);

    // Update statuses virtually based on simulated inventory deficits
    let simulatedRevenueAtRisk = 0;
    const shortages: string[] = [];

    simNodes.forEach(node => {
      if (node.type === "product_rm") {
        const prodId = parseInt(node.id.split(":")[1]);
        const reqQty = virtualRequirements[prodId] || 0;
        if (reqQty > 0) {
          const availStock = node.details.free_to_use;
          if (reqQty > availStock) {
            node.status = "red";
            node.details.simulated_required = reqQty;
            node.details.simulated_shortage = reqQty - availStock;
            shortages.push(`${node.label}: Missing ${reqQty - availStock} units`);
          } else {
            node.status = "yellow";
          }
        }
      }
    });

    if (shortages.length > 0) {
      simulatedRevenueAtRisk = simQuantity * fgNode.details.price;
      fgNode.status = "red";
    } else {
      fgNode.status = "green";
    }

    setGraphData({ ...graphData, nodes: simNodes });
    setSimulationResults({
      revenueAtRisk: simulatedRevenueAtRisk,
      shortages,
      isFeasible: shortages.length === 0
    });
  };

  const handleResetSimulation = () => {
    setIsSimulating(false);
    setSimulationResults(null);
    refetch();
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-900 text-slate-100">
      <PageHeader title="Company Digital Twin Map" description="Live interactive visualization of the supply chain graph" />

      {/* Control / Simulation Bar */}
      <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Input 
            placeholder="Simulate SKU (e.g. FG001)" 
            value={simProductSku} 
            onChange={(e) => setSimProductSku(e.target.value)} 
            className="w-48 bg-slate-950 border-slate-700 text-slate-100"
          />
          <Input 
            type="number" 
            placeholder="Qty" 
            value={simQuantity} 
            onChange={(e) => setSimQuantity(parseInt(e.target.value) || 1)} 
            className="w-24 bg-slate-950 border-slate-700 text-slate-100"
          />
          <Button onClick={handleRunSimulation} className="bg-primary hover:bg-primary-emphasis text-white">
            Run Simulation
          </Button>
          {isSimulating && (
            <Button onClick={handleResetSimulation} variant="secondary">
              Reset Map
            </Button>
          )}
        </div>
        
        {graphData && (
          <div className="flex gap-4 text-xs font-semibold">
            <div>Revenue at Risk: <span className="text-red-500">${graphData.summary.total_revenue_at_risk}</span></div>
            <div>Critical Shortages: <span className="text-yellow-500">{graphData.summary.critical_shortages_count}</span></div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* SVG Canvas */}
        {isLoading || !graphData ? (
          <div className="flex-1 flex items-center justify-center">Loading twin data...</div>
        ) : (
          <svg
            ref={svgRef}
            className="flex-1 cursor-grab active:cursor-grabbing bg-slate-950"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Arrowhead marker */}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
              </marker>
            </defs>

            <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
              {/* Draw Edges */}
              {graphData.edges.map(edge => {
                const sourceNode = graphData.nodes.find(n => n.id === edge.source);
                const targetNode = graphData.nodes.find(n => n.id === edge.target);
                if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) return null;

                const sx = sourceNode.x;
                const sy = sourceNode.y || 0;
                const tx = targetNode.x;
                const ty = targetNode.y || 0;

                // Bezier curve path
                const pathData = `M ${sx} ${sy} C ${(sx + tx) / 2} ${sy}, ${(sx + tx) / 2} ${ty}, ${tx} ${ty}`;

                return (
                  <path
                    key={edge.id}
                    d={pathData}
                    stroke={sourceNode.status === "red" ? "#ef4444" : "#475569"}
                    strokeWidth={sourceNode.status === "red" ? 2.5 : 1.5}
                    fill="none"
                    markerEnd="url(#arrow)"
                  />
                );
              })}

              {/* Draw Nodes */}
              {graphData.nodes.map(node => {
                const borderColors = { green: "border-emerald-500", yellow: "border-yellow-500", red: "border-red-500" };
                const bgColors = { green: "bg-emerald-950/80", yellow: "bg-yellow-950/80", red: "bg-red-950/80" };
                
                return (
                  <g key={node.id} transform={`translate(${node.x}, ${node.y || 0})`} onClick={() => setSelectedNode(node)} className="cursor-pointer">
                    <rect
                      x="-70"
                      y="-22"
                      width="140"
                      height="44"
                      rx="6"
                      className={`${bgColors[node.status]} stroke-2 ${borderColors[node.status]}`}
                      fillOpacity={0.9}
                      stroke={node.status === "red" ? "#ef4444" : node.status === "yellow" ? "#eab308" : "#10b981"}
                    />
                    <text
                      textAnchor="middle"
                      dy="2"
                      fill="#f8fafc"
                      fontSize="10"
                      fontWeight="600"
                      className="select-none pointer-events-none"
                    >
                      {node.label.length > 20 ? node.label.substring(0, 18) + ".." : node.label}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="14"
                      fill="#94a3b8"
                      fontSize="7"
                      className="select-none pointer-events-none uppercase tracking-wide"
                    >
                      {node.type.replace("_", " ")}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Floating Contextual Panel (Right Drawer) */}
        {selectedNode && (
          <Card className="absolute top-4 right-4 w-80 bg-slate-900 border-slate-700 text-slate-100 shadow-2xl">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <h3 className="font-semibold text-sm capitalize">{selectedNode.type.replace("_", " ")} Details</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white">
                  Close
                </Button>
              </div>

              <div className="text-xs space-y-2 text-slate-300">
                <div><strong>Label:</strong> {selectedNode.label}</div>
                <div><strong>Status:</strong> <span className={`capitalize ${selectedNode.status === "red" ? "text-red-400" : selectedNode.status === "yellow" ? "text-yellow-400" : "text-emerald-400"}`}>{selectedNode.status}</span></div>

                {selectedNode.type === "product_fg" && (
                  <>
                    <div><strong>SKU:</strong> {selectedNode.details.sku}</div>
                    <div><strong>On Hand Qty:</strong> {selectedNode.details.on_hand}</div>
                    <div><strong>Free stock:</strong> {selectedNode.details.free_to_use}</div>
                    <div><strong>Price:</strong> ${selectedNode.details.price}</div>
                  </>
                )}

                {selectedNode.type === "product_rm" && (
                  <>
                    <div><strong>SKU:</strong> {selectedNode.details.sku}</div>
                    <div><strong>On Hand Qty:</strong> {selectedNode.details.on_hand}</div>
                    <div><strong>Min Stock Level:</strong> {selectedNode.details.min_stock}</div>
                    {selectedNode.details.simulated_shortage && (
                      <div className="text-red-400"><strong>Simulated Shortage:</strong> {selectedNode.details.simulated_shortage} units</div>
                    )}
                  </>
                )}

                {selectedNode.type === "sales_order" && (
                  <>
                    <div><strong>Customer:</strong> {selectedNode.details.customer}</div>
                    <div><strong>Fulfillment Status:</strong> {selectedNode.details.status}</div>
                    <div><strong>Total Amount:</strong> ${selectedNode.details.amount}</div>
                    {selectedNode.details.revenue_at_risk && (
                      <div className="text-red-400"><strong>Revenue at Risk:</strong> ${selectedNode.details.revenue_at_risk}</div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Floating Simulation Report (Left Drawer) */}
        {simulationResults && (
          <Card className="absolute top-4 left-4 w-72 bg-slate-900/90 border-slate-700 text-slate-100 shadow-xl">
            <CardContent className="p-4">
              <h4 className="font-semibold text-xs border-b border-slate-700 pb-1 mb-2 uppercase tracking-wide">Simulation Results</h4>
              <div className="text-xs space-y-2">
                <div>
                  <strong>Feasibility:</strong>{" "}
                  {simulationResults.isFeasible ? (
                    <span className="text-emerald-400 font-bold">Feasible (Stock OK)</span>
                  ) : (
                    <span className="text-red-400 font-bold">Infeasible (Shortage)</span>
                  )}
                </div>
                <div><strong>Revenue at Risk:</strong> <span className="text-red-400">${simulationResults.revenueAtRisk}</span></div>
                {simulationResults.shortages.length > 0 && (
                  <div>
                    <strong>Shortage Details:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-400">
                      {simulationResults.shortages.map((sh: string, idx: number) => (
                        <li key={idx}>{sh}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

---

## 5. Verification Method

To verify the Company Digital Twin functionality, we propose designing a backend test script.

### Target Test File: `backend/test_digital_twin.py`
Create `backend/test_digital_twin.py` structured as follows:

```python
import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import Product

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("Starting Shiv Furniture Works - Digital Twin Tests")
    print("==================================================")

    # 1. Seed Database
    print("\n[Step 1] Seeding Database...")
    seed_db()
    
    # 2. Login
    print("\n[Step 2] Authenticating...")
    login_response = client.post(
        "/api/auth/login",
        data={"username": "admin", "password": "admin123"}
    )
    assert login_response.status_code == 200, "Auth failed"
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Authenticated as admin.")

    # 3. Fetch Graph and verify connections
    print("\n[Step 3] Querying /api/digital-twin/graph...")
    graph_resp = client.get("/api/digital-twin/graph", headers=headers)
    assert graph_resp.status_code == 200, "Failed to retrieve graph"
    data = graph_resp.json()
    
    # Check node types exist
    nodes = data["nodes"]
    edges = data["edges"]
    node_types = {n["type"] for n in nodes}
    print(f"Retrieved {len(nodes)} nodes of types: {node_types}")
    print(f"Retrieved {len(edges)} edges")
    
    assert "customer" in node_types
    assert "product" in node_types
    assert "sales_order" in node_types
    assert "bom" in node_types
    print("[PASS] Graph returns all business entities and relationships.")

    # 4. Induce Shortage and assert Revenue at Risk calculation
    print("\n[Step 4] Inducing material shortage...")
    db = SessionLocal()
    # Find RM001 (Wood Plank) and set inventory on hand to 0
    rm001 = db.query(Product).filter(Product.sku == "RM001").first()
    assert rm001 is not None, "RM001 not found"
    
    # Put inventory to 0 to simulate critical shortage
    old_qty = rm001.on_hand_qty
    rm001.on_hand_qty = 0.0
    db.commit()
    db.close()
    print("Set RM001 on_hand_qty to 0.0 in DB.")

    # Query graph again
    print("Re-querying /api/digital-twin/graph after shortage...")
    graph_resp2 = client.get("/api/digital-twin/graph", headers=headers)
    assert graph_resp2.status_code == 200
    data2 = graph_resp2.json()
    
    summary = data2["summary"]
    print(f"New Summary -> Revenue at Risk: ${summary['total_revenue_at_risk']}, Shortages: {summary['critical_shortages_count']}")
    
    assert summary["critical_shortages_count"] > 0, "No critical shortages flagged"
    assert summary["total_revenue_at_risk"] > 0.0, "Revenue at risk is 0"
    print("[PASS] Shortage propagation and Revenue at Risk computed correctly.")

    # Restore DB
    db = SessionLocal()
    rm001 = db.query(Product).filter(Product.sku == "RM001").first()
    rm001.on_hand_qty = old_qty
    db.commit()
    db.close()
    
    print("\n==================================================")
    print("ALL DIGITAL TWIN TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
```

### Execution Command
The test script can be run directly from the workspace root:
```bash
python -m backend.test_digital_twin
```
Verification succeeds if the output prints `ALL DIGITAL TWIN TESTS PASSED SUCCESSFULLY!`.
