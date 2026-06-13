# Company Digital Twin - Analysis and Design Report

This report presents a comprehensive design, architecture, and implementation plan for the **Company Digital Twin** module of the Shiv Furniture Works ERP. It covers database model mapping, business dependencies, status highlighting, revenue-at-risk calculations, a custom zoomable SVG React graph rendering engine, a virtual simulation engine, API contracts, and automated tests.

---

## 1. Backend Models and Graph Relationships

We analyze `backend/app/models.py` and map the business objects to a unified graph structure consisting of **Nodes** and **Edges (Business Dependencies)**.

### A. Graph Node Definitions

Since the database does not contain explicit tables for all entity types (e.g., Customers and Suppliers), they are derived from existing transactional data.

| Entity Type | DB Model / Origin | Node ID Format | Key Metadata Attributes |
|---|---|---|---|
| **Customer** | Unique `customer_name` in `SalesOrder` | `customer:<name>` | Name, order count, total value, status |
| **Supplier** | Union of `vendor_name` in `PurchaseOrder` and `vendor_id` in `Product` | `supplier:<name_or_id>` | Supplier name/ID, open POs count, status |
| **Sales Order** | `SalesOrder` model | `so:<id>` | Order date, status, total amount, lines |
| **Product (FG)**| `Product` where `category == "Finished Good"` | `product:<id>` | SKU, name, price, on-hand qty, reserved qty, free qty, min stock level |
| **BoM** | `BoM` model | `bom:<id>` | Name, description, finished product ID |
| **Raw Material**| `Product` where `category == "Raw Material"` | `product:<id>` | SKU, name, cost, on-hand qty, reserved qty, free qty, min stock level |
| **Warehouse** | `Warehouse` model | `warehouse:<id>` | Name, location, capacity usage |
| **Shelf** | `Shelf` model | `shelf:<id>` | Name, rack ID, capacity usage |
| **Manufacturing Order**| `ManufacturingOrder` model | `mo:<id>` | Product ID, quantity, status, start/end dates |
| **Purchase Order**| `PurchaseOrder` model | `po:<id>` | Vendor name, order date, status, total amount |

### B. Graph Edges (Business Dependencies)

We establish directed links that represent the flow of demand and material dependencies:

```
Customer ──(places)──> Sales Order ──(demands)──> Finished Good ──(produced by)──> BoM
                                                                                      │
                                                                                 (requires)
                                                                                      ▼
Supplier <──(supplies)── Raw Material <──(uses)── Manufacturing Order <──(consumes)─┘
    │
 (delivers)
    ▼
Purchase Order
```

1. **Customer → Sales Order**: `customer:<name>` → `so:<id>`
2. **Sales Order → Product (FG)**: `so:<id>` → `product:<fg_product_id>` (defined by `SalesOrderLine`)
3. **Product (FG) → BoM**: `product:<fg_product_id>` → `bom:<bom_id>` (via `Product.bom_id` or `BoM.product_id`)
4. **BoM → Raw Material**: `bom:<bom_id>` → `product:<material_product_id>` (via `BoMComponent`)
5. **Raw Material → Supplier**: `product:<material_product_id>` → `supplier:<vendor_id>` (via `Product.vendor_id`)
6. **Supplier → Purchase Order**: `supplier:<vendor_name>` → `po:<id>` (via `PurchaseOrder.vendor_name`)
7. **Purchase Order → Raw Material**: `po:<id>` → `product:<material_product_id>` (via `PurchaseOrderLine`)
8. **Manufacturing Order → Product (FG)**: `mo:<id>` → `product:<fg_product_id>`
9. **Manufacturing Order → BoM**: `mo:<id>` → `bom:<bom_id>`
10. **Manufacturing Order → Raw Material**: `mo:<id>` → `product:<material_product_id>` (via `ManufacturingOrderComponent`)
11. **Product/Raw Material → Shelf**: `product:<id>` → `shelf:<shelf_id>` (via `StockAllocation` representing physical inventory storage)
12. **Physical Hierarchy**: `shelf:<id>` → `rack:<rack_id>` → `aisle:<aisle_id>` → `warehouse:<warehouse_id>`

---

### C. Node Status Calculation Logic

Each node is computed as **Red** (Critical Warning), **Yellow** (Minor Warning/Delay), or **Green** (Healthy).

```python
# Product Status
free_to_use_qty = on_hand_qty - reserved_qty
if free_to_use_qty < 0:
    status = "Red"  # Critical Shortage
elif on_hand_qty < min_stock_level:
    status = "Yellow"  # Low Stock Alert
else:
    status = "Green"  # Healthy

# Sales Order Status
if status == "Completed" or status == "Cancelled":
    status = "Green"
elif status == "Confirmed":
    # Red if any line item's product is Red
    if any(line.product.free_to_use_qty < 0 for line in order.lines):
        status = "Red"
    # Yellow if any line item's product is Yellow
    elif any(line.product.on_hand_qty < line.product.min_stock_level for line in order.lines):
        status = "Yellow"
    else:
        status = "Green"
elif status == "Draft":
    status = "Yellow"

# Manufacturing Order Status
if status == "Completed" or status == "Cancelled":
    status = "Green"
elif status in ("Planned", "In Progress"):
    # Red if any of its components is short
    if any(comp.component_product.free_to_use_qty < (comp.required_quantity - comp.consumed_quantity) for comp in mo.components):
        status = "Red"
    else:
        status = "Green"
elif status == "Draft":
    status = "Yellow"

# Purchase Order Status
if status in ("Received", "Fully Received", "Cancelled"):
    status = "Green"
elif status in ("Ordered", "Confirmed"):
    # Yellow if PO is older than 7 days (simulated delivery delay)
    if (datetime.utcnow() - order_date).days > 7:
        status = "Red"
    else:
        status = "Green"
elif status == "Draft":
    status = "Yellow"

# Customer Status
# Red if they have any Red sales orders; Yellow if any Yellow sales orders; otherwise Green

# Supplier Status
# Red if any open PO to them is Red or if their supplied product is Red; otherwise Yellow/Green

# Warehouse Location Status
# Calculate usage % = allocated_qty / max_capacity. Red if > 90%; Yellow if 75-90%; Green if < 75%
```

---

### D. Revenue at Risk Algorithm

We trace critical shortages downstream to determine which Sales Orders are delayed and quantify the exact revenue at risk:

1. Identify all active, unfulfilled Sales Orders (status `Confirmed` or `Draft`).
2. For each Sales Order, check its `lines`. Let:
   - $Q_{rem} = \text{line.quantity} - \text{line.delivered\_qty}$
   - $Q_{avail} = \text{product.free\_to\_use\_qty}$
3. If $Q_{avail} < Q_{rem}$, there is a shortage of $Q_{short} = Q_{rem} - \max(0, Q_{avail})$.
4. Check if the Finished Good production is blocked. Trace the product's BoM:
   - For each component $C_i$ requiring $q_i$ units per finished good:
     - Component quantity needed $Q_{req} = Q_{short} \times q_i$
     - If $C_i.\text{free\_to\_use\_qty} < Q_{req}$, we have a critical component shortage.
5. If there is a component shortage, we search for active Purchase Orders (`Ordered` status) containing the component:
   - Let $Q_{incoming}$ be the pending PO quantity.
   - If $Q_{incoming} < Q_{short}(C_i)$, the shortage is **unresolved**, causing a production blockage.
6. The **Revenue at Risk** for this line is:
   $$\text{Revenue at Risk} = Q_{short} \times \text{line.unit\_price}$$
7. The Sales Order's `revenue_at_risk` is the sum of risk values across its lines.
8. The overall system **Revenue at Risk** is the sum of all sales orders' risk values.

---

## 2. Backend API Signature & Implementation Plan

### Route Signature
`GET /api/digital-twin/graph`

**Response Schema:**
```typescript
interface DigitalTwinGraphResponse {
  nodes: Array<{
    id: string;
    type: "Customer" | "Supplier" | "SalesOrder" | "PurchaseOrder" | "ManufacturingOrder" | "Product" | "BoM" | "Warehouse" | "Shelf";
    label: string;
    status: "Red" | "Yellow" | "Green";
    data: Record<string, any>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    label?: string;
  }>;
  revenue_at_risk: number;
  critical_shortages: Array<{
    product_id: number;
    sku: string;
    name: string;
    shortage_qty: number;
    affected_so_ids: number[];
  }>;
}
```

### Proposed Backend Implementation (`backend/app/routers/digital_twin.py`)

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from collections import defaultdict

from backend.app.database import get_db
from backend.app.auth import get_current_user
from backend.app.permissions import require_module
from backend.app.models import (
    Product, SalesOrder, PurchaseOrder, ManufacturingOrder,
    BoM, BoMComponent, StockAllocation, Warehouse, Shelf, Aisle, Rack
)

router = APIRouter(prefix="/api/digital-twin", tags=["Digital Twin"])

@router.get("/graph", response_model_exclude_none=True)
def get_digital_twin_graph(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Fetch all records
    products = db.query(Product).all()
    sales_orders = db.query(SalesOrder).all()
    purchase_orders = db.query(PurchaseOrder).all()
    manufacturing_orders = db.query(ManufacturingOrder).all()
    boms = db.query(BoM).all()
    allocations = db.query(StockAllocation).all()
    warehouses = db.query(Warehouse).all()
    shelves = db.query(Shelf).all()
    aisles = db.query(Aisle).all()
    racks = db.query(Rack).all()

    # Pre-index products for quick lookups
    prod_map = {p.id: p for p in products}
    
    # 2. Status & Shortage Pre-calculation
    product_statuses = {}
    shortage_items = {}
    
    for p in products:
        free_qty = p.free_to_use_qty
        if free_qty < 0:
            product_statuses[p.id] = "Red"
            shortage_items[p.id] = -free_qty
        elif p.on_hand_qty < p.min_stock_level:
            product_statuses[p.id] = "Yellow"
        else:
            product_statuses[p.id] = "Green"

    # Trace affected orders and revenue at risk
    revenue_at_risk = 0.0
    critical_shortages_map = defaultdict(lambda: {"shortage": 0.0, "affected_so": set()})
    
    so_statuses = {}
    for so in sales_orders:
        so_status = "Green"
        if so.status in ("Draft", "Confirmed"):
            is_delayed = False
            for line in so.lines:
                p = prod_map[line.product_id]
                rem_qty = line.quantity - line.delivered_qty
                
                # Check direct FG shortage
                if p.free_to_use_qty < 0:
                    is_delayed = True
                    short_qty = min(rem_qty, -p.free_to_use_qty)
                    revenue_at_risk += short_qty * line.unit_price
                    critical_shortages_map[p.id]["shortage"] += short_qty
                    critical_shortages_map[p.id]["affected_so"].add(so.id)
                
                # Check component shortage recursively
                elif p.bom:
                    for comp in p.bom.components:
                        comp_prod = prod_map[comp.component_product_id]
                        if comp_prod.free_to_use_qty < 0:
                            is_delayed = True
                            # Proportional calculation of component shortage impact
                            comp_shortage_ratio = min(1.0, -comp_prod.free_to_use_qty / (rem_qty * comp.quantity))
                            revenue_at_risk += (rem_qty * line.unit_price) * comp_shortage_ratio
                            critical_shortages_map[comp_prod.id]["shortage"] += -comp_prod.free_to_use_qty
                            critical_shortages_map[comp_prod.id]["affected_so"].add(so.id)
            
            if is_delayed:
                so_status = "Red"
            elif so.status == "Draft":
                so_status = "Yellow"
        so_statuses[so.id] = so_status

    # 3. Build Nodes list
    nodes = []
    
    # Customer Nodes
    customers = {so.customer_name for so in sales_orders if so.customer_name}
    customer_status = {}
    for cust in customers:
        cust_sos = [so for so in sales_orders if so.customer_name == cust]
        status = "Green"
        if any(so_statuses.get(so.id) == "Red" for so in cust_sos):
            status = "Red"
        elif any(so_statuses.get(so.id) == "Yellow" for so in cust_sos):
            status = "Yellow"
        customer_status[cust] = status
        nodes.append({
            "id": f"customer_{cust}",
            "type": "Customer",
            "label": cust,
            "status": status,
            "data": {"order_count": len(cust_sos)}
        })

    # Supplier Nodes
    po_vendors = {po.vendor_name for po in purchase_orders if po.vendor_name}
    prod_vendors = {p.vendor_id for p in products if p.vendor_id}
    suppliers = po_vendors.union(prod_vendors)
    for sup in suppliers:
        nodes.append({
            "id": f"supplier_{sup}",
            "type": "Supplier",
            "label": sup,
            "status": "Green",
            "data": {"vendor_id": sup}
        })

    # Sales Order Nodes
    for so in sales_orders:
        nodes.append({
            "id": f"so_{so.id}",
            "type": "SalesOrder",
            "label": f"SO #{so.id}",
            "status": so_statuses[so.id],
            "data": {"customer": so.customer_name, "total": so.total_amount, "status": so.status}
        })

    # Product Nodes
    for p in products:
        nodes.append({
            "id": f"product_{p.id}",
            "type": "Product",
            "label": p.name,
            "status": product_statuses[p.id],
            "data": {
                "sku": p.sku,
                "category": p.category,
                "on_hand": p.on_hand_qty,
                "reserved": p.reserved_qty,
                "free": p.free_to_use_qty,
                "min_stock": p.min_stock_level
            }
        })

    # BoM Nodes
    for b in boms:
        nodes.append({
            "id": f"bom_{b.id}",
            "type": "BoM",
            "label": b.name,
            "status": product_statuses.get(b.product_id, "Green"),
            "data": {"description": b.description}
        })

    # MO Nodes
    for mo in manufacturing_orders:
        mo_status = "Green"
        if mo.status in ("Planned", "In Progress"):
            if any(product_statuses.get(c.component_product_id) == "Red" for c in mo.components):
                mo_status = "Red"
        elif mo.status == "Draft":
            mo_status = "Yellow"
        nodes.append({
            "id": f"mo_{mo.id}",
            "type": "ManufacturingOrder",
            "label": f"MO #{mo.id}",
            "status": mo_status,
            "data": {"quantity": mo.quantity, "status": mo.status}
        })

    # PO Nodes
    for po in purchase_orders:
        po_status = "Green"
        if po.status in ("Ordered", "Confirmed"):
            if (datetime.utcnow() - po.order_date).days > 7:
                po_status = "Red"
        elif po.status == "Draft":
            po_status = "Yellow"
        nodes.append({
            "id": f"po_{po.id}",
            "type": "PurchaseOrder",
            "label": f"PO #{po.id}",
            "status": po_status,
            "data": {"vendor": po.vendor_name, "status": po.status, "total": po.total_amount}
        })

    # Warehouse & Shelf Nodes
    for wh in warehouses:
        nodes.append({
            "id": f"warehouse_{wh.id}",
            "type": "Warehouse",
            "label": wh.name,
            "status": "Green",
            "data": {"location": wh.location}
        })

    for sh in shelves:
        # Calculate occupied slots / capacity
        sh_allocs = [a for a in allocations if a.shelf_id == sh.id]
        total_qty = sum(a.quantity for a in sh_allocs)
        capacity_usage = min(100.0, (total_qty / 500.0) * 100) # Assumed capacity limit of 500 units per shelf
        sh_status = "Green"
        if capacity_usage > 90:
            sh_status = "Red"
        elif capacity_usage > 75:
            sh_status = "Yellow"
        nodes.append({
            "id": f"shelf_{sh.id}",
            "type": "Shelf",
            "label": sh.name,
            "status": sh_status,
            "data": {"occupancy": total_qty, "usage_pct": capacity_usage}
        })

    # 4. Build Edges list
    edges = []
    
    # Customer -> Sales Order
    for so in sales_orders:
        if so.customer_name:
            edges.append({
                "id": f"e_cust_so_{so.id}",
                "source": f"customer_{so.customer_name}",
                "target": f"so_{so.id}",
                "type": "places"
            })
            
    # Sales Order -> Product
    for so in sales_orders:
        for line in so.lines:
            edges.append({
                "id": f"e_so_prod_{so.id}_{line.product_id}",
                "source": f"so_{so.id}",
                "target": f"product_{line.product_id}",
                "type": "demands",
                "label": f"{line.quantity} units"
            })

    # Product -> BoM
    for bom in boms:
        edges.append({
            "id": f"e_prod_bom_{bom.product_id}_{bom.id}",
            "source": f"product_{bom.product_id}",
            "target": f"bom_{bom.id}",
            "type": "produced_by"
        })

    # BoM -> Raw Materials
    for bom in boms:
        for comp in bom.components:
            edges.append({
                "id": f"e_bom_comp_{bom.id}_{comp.component_product_id}",
                "source": f"bom_{bom.id}",
                "target": f"product_{comp.component_product_id}",
                "type": "requires",
                "label": f"{comp.quantity}x"
            })

    # MO Edges
    for mo in manufacturing_orders:
        edges.append({
            "id": f"e_mo_prod_{mo.id}",
            "source": f"mo_{mo.id}",
            "target": f"product_{mo.product_id}",
            "type": "produces"
        })
        for comp in mo.components:
            edges.append({
                "id": f"e_mo_comp_{mo.id}_{comp.component_product_id}",
                "source": f"mo_{mo.id}",
                "target": f"product_{comp.component_product_id}",
                "type": "consumes"
            })

    # Raw Material -> Supplier
    for p in products:
        if p.vendor_id:
            edges.append({
                "id": f"e_prod_sup_{p.id}_{p.vendor_id}",
                "source": f"product_{p.id}",
                "target": f"supplier_{p.vendor_id}",
                "type": "supplied_by"
            })

    # Supplier -> PO
    for po in purchase_orders:
        if po.vendor_name:
            edges.append({
                "id": f"e_sup_po_{po.id}",
                "source": f"supplier_{po.vendor_name}",
                "target": f"po_{po.id}",
                "type": "delivers"
            })

    # PO -> Product
    for po in purchase_orders:
        for line in po.lines:
            edges.append({
                "id": f"e_po_prod_{po.id}_{line.product_id}",
                "source": f"po_{po.id}",
                "target": f"product_{line.product_id}",
                "type": "delivers"
            })

    # Product -> Shelf Allocation
    for alloc in allocations:
        edges.append({
            "id": f"e_prod_shelf_{alloc.product_id}_{alloc.shelf_id}",
            "source": f"product_{alloc.product_id}",
            "target": f"shelf_{alloc.shelf_id}",
            "type": "stored_in",
            "label": f"{alloc.quantity} qty"
        })

    # Physical Hierarchy
    shelf_rack = {sh.id: sh.rack_id for sh in shelves}
    rack_aisle = {r.id: r.aisle_id for r in racks}
    aisle_wh = {a.id: a.warehouse_id for a in aisles}
    
    for sh in shelves:
        edges.append({
            "id": f"e_shelf_rack_{sh.id}_{sh.rack_id}",
            "source": f"shelf_{sh.id}",
            "target": f"rack_{sh.rack_id}",
            "type": "within"
        })
    for r in racks:
        edges.append({
            "id": f"e_rack_aisle_{r.id}_{r.aisle_id}",
            "source": f"rack_{r.id}",
            "target": f"aisle_{r.aisle_id}",
            "type": "within"
        })
    for a in aisles:
        edges.append({
            "id": f"e_aisle_wh_{a.id}_{a.warehouse_id}",
            "source": f"aisle_{a.id}",
            "target": f"warehouse_{a.warehouse_id}",
            "type": "within"
        })

    # Format critical shortages output
    critical_shortages_out = []
    for pid, details in critical_shortages_map.items():
        p = prod_map[pid]
        critical_shortages_out.append({
            "product_id": pid,
            "sku": p.sku,
            "name": p.name,
            "shortage_qty": float(details["shortage"]),
            "affected_so_ids": list(details["affected_so"])
        })

    return {
        "nodes": nodes,
        "edges": edges,
        "revenue_at_risk": float(revenue_at_risk),
        "critical_shortages": critical_shortages_out
    }
```

---

## 3. Frontend Architecture: Zero-Dependency Interactive Graph Component

Since no graph packages are installed in `frontend/package.json`, we propose building a custom zoomable SVG renderer directly in React and TypeScript.

### A. Zoom and Pan Controls via SVG Matrix
SVG nodes and edges are rendered inside a `<g>` group transformed by React state representing translation `(x, y)` and zoom `scale`.

```typescript
import React, { useState, useRef } from "react";

export function CustomGraphView({ nodes, edges, onNodeClick }) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTranslate({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.08;
    const nextScale = e.deltaY < 0 ? scale + zoomFactor : scale - zoomFactor;
    setScale(Math.max(0.15, Math.min(3.0, nextScale)));
  };

  return (
    <div className="relative w-full h-[600px] border border-border rounded-lg bg-card overflow-hidden select-none">
      <svg
        width="100%"
        height="100%"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="cursor-grab active:cursor-grabbing"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="20" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>
        
        <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
          {/* 1. Render Edges (Smooth Bezier Curves) */}
          {edges.map((edge) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;
            
            const dx = targetNode.x - sourceNode.x;
            const dy = targetNode.y - sourceNode.y;
            const pathData = `M ${sourceNode.x + 80} ${sourceNode.y + 20} C ${sourceNode.x + 80 + dx/2} ${sourceNode.y + 20}, ${sourceNode.x + 80 + dx/2} ${targetNode.y + 20}, ${targetNode.x} ${targetNode.y + 20}`;
            
            return (
              <g key={edge.id}>
                <path d={pathData} fill="none" stroke="#cbd5e1" strokeWidth={1.5} markerEnd="url(#arrow)" />
                {edge.label && (
                  <text x={sourceNode.x + dx/2} y={sourceNode.y + dy/2 - 5} fontSize={9} fill="#64748b" textAnchor="middle">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* 2. Render Nodes */}
          {nodes.map((node) => (
            <g key={node.id} transform={`translate(${node.x}, ${node.y})`} onClick={() => onNodeClick(node)} className="cursor-pointer">
              <rect width={160} height={48} rx={6} fill="#ffffff" stroke={node.status === "Red" ? "#ef4444" : node.status === "Yellow" ? "#f59e0b" : "#10b981"} strokeWidth={2} filter="drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))" />
              <text x={12} y={20} fontSize={11} fontWeight="bold" fill="#0f172a">{node.label}</text>
              <text x={12} y={36} fontSize={9} fill="#64748b">{node.type}</text>
              <circle cx={145} cy={12} r={4.5} fill={node.status === "Red" ? "#ef4444" : node.status === "Yellow" ? "#f59e0b" : "#10b981"} />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

---

### B. Layered column-based layout algorithm
To ensure a readable and clean structure without requiring complex graph layout physics libraries, we propose a deterministic layered column layout where column assignments correspond directly to entity stages:

```typescript
const COLUMNS: Record<string, number> = {
  "Supplier": 0,
  "PurchaseOrder": 1,
  "RawMaterial": 2, // category === "Raw Material"
  "BoM": 3,
  "ManufacturingOrder": 4,
  "Product": 5,     // category === "Finished Good"
  "Shelf": 6,
  "Warehouse": 7,
  "SalesOrder": 8,
  "Customer": 9
};

const COLUMN_WIDTH = 240;
const ROW_HEIGHT = 70;

export function layoutNodes(apiNodes: any[]) {
  const columnNodes: Record<number, any[]> = {};
  
  // Group nodes into columns
  apiNodes.forEach(node => {
    let col = COLUMNS[node.type] ?? 5;
    if (node.type === "Product" && node.data?.category === "Raw Material") {
      col = COLUMNS["RawMaterial"];
    }
    if (!columnNodes[col]) columnNodes[col] = [];
    columnNodes[col].push(node);
  });

  // Assign X and Y coordinates
  const laidOutNodes = Object.entries(columnNodes).flatMap(([colStr, list]) => {
    const colIndex = parseInt(colStr);
    const startY = 50;
    return list.map((node, i) => ({
      ...node,
      x: colIndex * COLUMN_WIDTH + 40,
      y: startY + i * ROW_HEIGHT
    }));
  });

  return laidOutNodes;
}
```

---

### C. Details Drawer Sidebar Panel
Clicking a node opens a sidebar detail view with customized cards:
1. **Product (Finished Good)**: Displays Demand (active sales orders count), On-hand vs Reserved stock, Minimum Stock levels, and linked active Manufacturing Orders.
2. **Raw Material (BOM Component)**: Displays Stock balance, location details (Warehouse, Aisle, Rack, Shelf where allocated), and linked open Purchase Orders from Suppliers.
3. **Supplier**: Displays supplier status, open Purchase Orders list, performance rating, and lead times.

---

## 4. Virtual Simulation Engine (Frontend-Only)

The simulation engine allows users to test the impact of a finished good volume (e.g. "Simulate 5000 Chairs") on inventory, warehouse capacity, and sales order revenue without altering the DB.

### Simulation Logic Steps:
1. **Initial Clone**: Clone the original `nodes` and `edges` list returned from the `/api/digital-twin/graph` endpoint.
2. **Virtual Sales Order Insertion**:
   - Insert a virtual Sales Order node: `id: "virtual_so"`, `label: "Simulated SO (5000x)"`, `type: "SalesOrder"`.
   - Link it to the Finished Good product node.
3. **BOM Explosion Recursion**:
   - Trace the Finished Good's BoM to calculate component requirements:
     $$Q_{req}(C_i) = 5000 \times \text{component\_quantity}_i$$
   - Store requirements in a virtual map: `simulatedDemand: Record<number, number>`.
4. **Virtual Inventory Update**:
   - For every product node, calculate virtual availability:
     $$QTY_{virtual\_free} = \text{original\_free} - (\text{simulatedDemand}[P_{id}] \parallel 0)$$
   - If $QTY_{virtual\_free} < 0$, update node status to **Red** (Virtual Shortage) and calculate shortage.
5. **Trace Path Highlight**:
   - Trace edges from the virtual Sales Order through BoM nodes to the affected Raw Materials.
   - Set these edges to `stroke: "#ef4444"` (Red highlight) in the UI to display the critical bottleneck path.
6. **Warehouse Capacity Calculation**:
   - Retrieve all shelves storing the simulated components (mapped via `StockAllocation` edges).
   - Decrement the allocated shelf stock virtually (simulating raw material consumption):
     $$QTY_{shelf\_virtual} = QTY_{shelf} - Q_{consumed}$$
   - Increment the shelf stock of the finished good virtually (simulating completed product storage):
     $$QTY_{shelf\_virtual} = QTY_{shelf} + Q_{produced}$$
   - Recalculate shelf occupancy percentage. If occupancy $> 100\%$, set Shelf status to **Red** (Capacity Overflow).
7. **Virtual Revenue at Risk Delta**:
   - Perform a pass over all *actual* Sales Orders in the graph using the new virtual free stock levels.
   - Any actual Sales Order that now experiences a shortage due to the virtual order's consumption of raw materials will have its unfulfillable portion marked as **At Risk**.
   - Show the total delta value in the Simulation HUD: `+$120,000 additional revenue at risk`.

---

## 5. Automated Testing Plan (`backend/test_digital_twin.py`)

A standalone test script `backend/test_digital_twin.py` will be designed to verify API behavior, shortage propagation, and revenue-at-risk logic using the `TestClient`.

```python
import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import Product, SalesOrder, SalesOrderLine

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("Starting Shiv Furniture Works - Digital Twin Test")
    print("==================================================")

    # 1. Seeding Database
    print("\n[Step 1] Seeding database to fresh state...")
    seed_db()
    
    # 2. Login
    print("\n[Step 2] Authenticating as Admin...")
    login_resp = client.post("/api/auth/login", data={"username": "admin", "password": "admin123"})
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Retrieve Graph
    print("\n[Step 3] Fetching initial Digital Twin Graph...")
    graph_resp = client.get("/api/digital-twin/graph", headers=headers)
    assert graph_resp.status_code == 200
    graph_data = graph_resp.json()
    
    # Assert nodes and edges are populated
    assert "nodes" in graph_data
    assert "edges" in graph_data
    assert len(graph_data["nodes"]) > 0
    assert len(graph_data["edges"]) > 0
    assert graph_data["revenue_at_risk"] == 0.0
    print(f"[PASS] Successfully retrieved {len(graph_data['nodes'])} nodes and {len(graph_data['edges'])} edges.")

    # Check for presence of Customer & Supplier nodes
    node_types = {n["type"] for n in graph_data["nodes"]}
    assert "Customer" in node_types, "No Customer node found in graph response"
    assert "Supplier" in node_types, "No Supplier node found in graph response"
    print("[PASS] Verified Customer and Supplier node extraction.")

    # 4. Induce Shortage and Verify Path Highlight / Revenue at Risk
    print("\n[Step 4] Inducing shortage by creating Sales Order exceeding stock levels...")
    db = SessionLocal()
    try:
        # Get Teak Wood Table (FG001) & Teak Wood Plank (RM001)
        fg_prod = db.query(Product).filter(Product.sku == "FG001").first()
        rm_prod = db.query(Product).filter(Product.sku == "RM001").first()
        
        # Create Sales Order for 15 Tables (stock has 5, creates shortage of 10)
        # Needs 10 * 4 = 40 Teak Wood Planks. RM001 has only 20 on hand -> shortage of 20 planks.
        so_payload = {
            "customer_name": "Test Customer Inc",
            "lines": [
                {
                    "product_id": fg_prod.id,
                    "quantity": 15.0,
                    "unit_price": 500.0 # 500 * 10 = 5000 at risk
                }
            ]
        }
        so_resp = client.post("/api/sales-orders", json=so_payload, headers=headers)
        assert so_resp.status_code == 201
        so_id = so_resp.json()["id"]
        
        # Confirm sales order to lock reservations and trigger procurement
        confirm_resp = client.post(f"/api/sales-orders/{so_id}/confirm", headers=headers)
        assert confirm_resp.status_code == 200
        
        # Query Graph API to verify shortage is tracked
        graph_resp = client.get("/api/digital-twin/graph", headers=headers)
        assert graph_resp.status_code == 200
        graph_data = graph_resp.json()
        
        # Verify Product FG001 is Red
        fg_node = next(n for n in graph_data["nodes"] if n["id"] == f"product_{fg_prod.id}")
        assert fg_node["status"] == "Red", f"Expected FG001 to be Red, got {fg_node['status']}"
        
        # Verify Sales Order is Red
        so_node = next(n for n in graph_data["nodes"] if n["id"] == f"so_{so_id}")
        assert so_node["status"] == "Red", f"Expected SO {so_id} to be Red, got {so_node['status']}"
        
        # Verify Customer is Red
        cust_node = next(n for n in graph_data["nodes"] if n["id"] == f"customer_Test Customer Inc")
        assert cust_node["status"] == "Red"
        
        # Verify Revenue at Risk is calculated
        # Shortage of 10 tables * 500 = 5000.
        assert graph_data["revenue_at_risk"] >= 5000.0
        
        # Verify critical shortages contains RM001 (Teak Wood Plank)
        shortage_skus = {s["sku"] for s in graph_data["critical_shortages"]}
        assert "RM001" in shortage_skus, f"Expected RM001 in critical shortages, got {shortage_skus}"
        
        print(f"[PASS] Successfully verified Red alert propagation and Revenue at Risk tracking. Current risk: INR {graph_data['revenue_at_risk']}")
        
    finally:
        db.close()

    print("\n==================================================")
    print("ALL DIGITAL TWIN TESTS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
```

---

## 6. Implementation Summary

To implement the Company Digital Twin requirements:
1. **Backend Integration**: Create `backend/app/routers/digital_twin.py` with the `GET /api/digital-twin/graph` route, register it in `backend/app/main.py`, and protect it using `Depends(require_module("dashboard"))`.
2. **Frontend Navigation**: Add `"Digital Twin"` link in `AppShell.tsx` under `"Warehouse Mapping"`. Update `ROUTE_ROLES` in `permissions.ts` to grant access, and add the route in `App.tsx`.
3. **Frontend Page**: Implement the interactive dashboard in `frontend/src/pages/digital-twin/DigitalTwin.tsx` containing the custom SVG zoomable graph renderer, layout algorithm, details drawer, and simulation control panel.
4. **Verification**: Write `backend/test_digital_twin.py` and run it via Python CLI to verify complete end-to-end correctness.
