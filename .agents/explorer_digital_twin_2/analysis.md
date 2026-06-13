# Structured Analysis & Implementation Report: Company Digital Twin

## 1. Observation

I conducted a comprehensive investigation of the Shiv Furniture Works ERP codebase to understand database models, frontend structure, routing configurations, and test designs. The following observations were made:

### A. Backend Database Models & Schemas
In `backend/app/models.py`, I identified the following relevant database models and their key fields:
* **Product** (Lines 15-56):
  ```python
  class Product(Base):
      __tablename__ = "products"
      id = Column(Integer, primary_key=True, index=True)
      sku = Column(String, unique=True, index=True, nullable=False)
      name = Column(String, nullable=False)
      category = Column(String, nullable=False)  # "Raw Material" or "Finished Good"
      on_hand_qty = Column(Float, default=0.0, nullable=False)
      reserved_qty = Column(Float, default=0.0, nullable=False)
      min_stock_level = Column(Float, default=0.0, nullable=False)
      is_bom_item = Column(Boolean, default=False, nullable=False)
      vendor_id = Column(String, nullable=True)  # default vendor identifier
      bom_id = Column(Integer, ForeignKey("boms.id", name="fk_product_bom", use_alter=True), nullable=True)
  ```
* **SalesOrder & SalesOrderLine** (Lines 57-81):
  ```python
  class SalesOrder(Base):
      __tablename__ = "sales_orders"
      id = Column(Integer, primary_key=True, index=True)
      customer_name = Column(String, nullable=False)
      status = Column(String, default="Draft", nullable=False)  # Draft, Confirmed, Completed, Cancelled
      total_amount = Column(Float, default=0.0, nullable=False)
      lines = relationship("SalesOrderLine", back_populates="sales_order", cascade="all, delete-orphan")

  class SalesOrderLine(Base):
      __tablename__ = "sales_order_lines"
      id = Column(Integer, primary_key=True, index=True)
      sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
      product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
      quantity = Column(Float, nullable=False)
      unit_price = Column(Float, nullable=False)
      total_price = Column(Float, nullable=False)
      delivered_qty = Column(Float, default=0.0, nullable=False)
  ```
* **PurchaseOrder & PurchaseOrderLine** (Lines 82-106):
  ```python
  class PurchaseOrder(Base):
      __tablename__ = "purchase_orders"
      id = Column(Integer, primary_key=True, index=True)
      vendor_name = Column(String, nullable=False)
      status = Column(String, default="Draft", nullable=False)  # Draft, Ordered, Received, Cancelled
      total_amount = Column(Float, default=0.0, nullable=False)

  class PurchaseOrderLine(Base):
      __tablename__ = "purchase_order_lines"
      id = Column(Integer, primary_key=True, index=True)
      purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
      product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
      quantity = Column(Float, nullable=False)
      received_qty = Column(Float, default=0.0, nullable=False)
  ```
* **BoM & BoMComponent** (Lines 107-129):
  ```python
  class BoM(Base):
      __tablename__ = "boms"
      id = Column(Integer, primary_key=True, index=True)
      product_id = Column(Integer, ForeignKey("products.id"), unique=True, nullable=False)
      name = Column(String, nullable=False)

  class BoMComponent(Base):
      __tablename__ = "bom_components"
      id = Column(Integer, primary_key=True, index=True)
      bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
      component_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
      quantity = Column(Float, nullable=False)  # Quantity required per unit of finished good
  ```
* **ManufacturingOrder & Components** (Lines 141-169):
  ```python
  class ManufacturingOrder(Base):
      __tablename__ = "manufacturing_orders"
      id = Column(Integer, primary_key=True, index=True)
      product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
      bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
      quantity = Column(Float, nullable=False)
      status = Column(String, default="Draft", nullable=False)  # Draft, Planned, In Progress, Completed, Cancelled

  class ManufacturingOrderComponent(Base):
      __tablename__ = "manufacturing_order_components"
      id = Column(Integer, primary_key=True, index=True)
      manufacturing_order_id = Column(Integer, ForeignKey("manufacturing_orders.id"), nullable=False)
      component_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
      required_quantity = Column(Float, nullable=False)
      consumed_quantity = Column(Float, default=0.0, nullable=False)
  ```
* **Warehouse Hierarchy & StockAllocation** (Lines 183-247):
  ```python
  class Warehouse(Base):
      __tablename__ = "warehouses"
      id = Column(Integer, primary_key=True, index=True)
      name = Column(String, unique=True, index=True, nullable=False)

  class Aisle(Base):
      __tablename__ = "aisles"
      id = Column(Integer, primary_key=True, index=True)
      warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
      name = Column(String, nullable=False)

  class Rack(Base):
      __tablename__ = "racks"
      id = Column(Integer, primary_key=True, index=True)
      aisle_id = Column(Integer, ForeignKey("aisles.id"), nullable=False)
      name = Column(String, nullable=False)

  class Shelf(Base):
      __tablename__ = "shelves"
      id = Column(Integer, primary_key=True, index=True)
      rack_id = Column(Integer, ForeignKey("racks.id"), nullable=False)
      name = Column(String, nullable=False)

  class StockAllocation(Base):
      __tablename__ = "stock_allocations"
      id = Column(Integer, primary_key=True, index=True)
      product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
      shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
      quantity = Column(Float, nullable=False, default=0.0)
  ```

### B. Frontend Setup & Navigation
* `frontend/package.json` (Lines 12-27) reveals that no graph packages (e.g. D3, Cytoscape, React Flow) are installed. It includes standard libraries such as React 18, Tailwind CSS, Lucide React, and React Router Dom 6.
* `frontend/src/components/AppShell.tsx` (Lines 25-50) manages the sidebar layout:
  ```typescript
  const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
    {
      label: "Overview",
      items: [{ to: "/dashboard", label: "AI Ops Center", icon: LayoutDashboard }],
    },
    {
      label: "Operations",
      items: [
        { to: "/sales", label: "Sales Orders", icon: ShoppingCart },
        { to: "/purchase", label: "Purchase Orders", icon: Truck },
        { to: "/manufacturing", label: "Manufacturing", icon: Factory },
        { to: "/warehouse-mapping", label: "Warehouse Mapping", icon: Warehouse },
      ],
    },
    ...
  ```
* `frontend/src/lib/permissions.ts` (Lines 8-17) governs route authorization.

---

## 2. Logic Chain

From the observations, the following design decisions and logic are established:

### A. Graph Node & Edge Representation
1. **Customer Nodes**: Since there is no `Customer` table, Customer nodes must be extracted dynamically as the unique set of `customer_name` values in the `SalesOrder` table.
2. **Supplier Nodes**: Supplier nodes must be extracted dynamically by unioning the unique set of `vendor_name` values in `PurchaseOrder` and the `vendor_id` values in `Product`.
3. **Other Entity Nodes**: Products, BOMs, Manufacturing Orders, Purchase Orders, Warehouses, Aisles, Racks, and Shelves map directly to their corresponding SQL database tables.
4. **Physical & Business Dependencies (Edges)**:
   * `Customer` → `SalesOrder` (places order)
   * `SalesOrder` → `Product` (demands finished goods)
   * `Product` → `BoM` (is defined by BoM)
   * `BoM` → `Product` (requires raw material components)
   * `Product` → `Shelf` (is allocated to storage)
   * `Shelf` → `Rack` → `Aisle` → `Warehouse` (spatial containment hierarchy)
   * `ManufacturingOrder` → `Product` (produces finished goods)
   * `ManufacturingOrder` → `BoM` (references Bill of Materials)
   * `ManufacturingOrder` → `Product` (consumes raw material components)
   * `Supplier` → `PurchaseOrder` (supplies order)
   * `PurchaseOrder` → `Product` (procures raw materials)
   * `Supplier` → `Product` (supplies component directly)

### B. Node Status Logic
The status (Red, Yellow, Green) of each node is determined by:
* **Product / Raw Material**:
  * **Red (Critical Shortage)**: If free-to-use quantity (`on_hand_qty - reserved_qty`) is $\le 0$, and there is active demand (Sales Order / Manufacturing Order lines) that is not fully covered by incoming supply.
  * **Yellow (Warning)**: If free-to-use quantity is less than the `min_stock_level` but greater than 0, or if there is a potential safety stock violation.
  * **Green (Healthy)**: If free-to-use quantity $\ge$ `min_stock_level` and all demands are covered.
* **Sales Order**:
  * **Red (At Risk / Blocked)**: If the Sales Order status is "Confirmed" and any required item (directly or via its BOM components) has a critical shortage (Red status).
  * **Yellow (Warning)**: If any related product status is Yellow (below safety level but not critically short).
  * **Green**: If status is "Draft", "Completed", or "Confirmed" with all items in healthy status.
* **Manufacturing Order**:
  * **Red (Blocked)**: If status is "Planned" or "In Progress" and any required component has a critical shortage (Red status).
  * **Yellow**: If any required component is in Yellow status.
  * **Green**: Otherwise.
* **Purchase Order**:
  * **Red (Overdue/Late)**: If status is "Ordered" and `(datetime.utcnow() - order_date).days > 7` (indicates delivery delay).
  * **Yellow (Awaiting)**: If status is "Ordered" and the duration is between 4 and 7 days.
  * **Green**: Otherwise.
* **Warehouse Location (Shelf/Rack/Aisle/Warehouse)**:
  * **Red (Over-Capacity)**: If capacity occupancy is $\ge 90\%$.
  * **Yellow (Near Capacity)**: If capacity occupancy is between $75\%$ and $90\%$.
  * **Green**: Otherwise.
  * *Calculation*: Occupancy percentage is derived from the sum of allocated quantities on the shelf divided by the maximum capacity (e.g. 100).

### C. Revenue at Risk Algorithm
1. Identify all active, confirmed `SalesOrder` records.
2. For each line item of a sales order:
   * Calculate the remaining quantity to deliver: $Q_{rem} = Q_{so} - Q_{del}$.
   * If $Q_{rem} > 0$:
     * Recursively explode the BOM for the product if it is a Finished Good.
     * Check if the product or any of its BOM component raw materials has a critical shortage (meaning `free_to_use_qty` + incoming supply is insufficient for overall demand).
     * If a shortage exists for the product or any of its components, mark this Sales Order Line as **Blocked**.
     * The blocked line's value at risk is: $\text{Value at Risk} = Q_{rem} \times \text{unit\_price}$.
3. The total **Revenue at Risk** for a Sales Order is the sum of value at risk across its blocked lines. The sum of these values across all Sales Orders yields the company's total revenue at risk.

### D. Frontend Visual Graph Layout & Pan/Zoom
Since no graphing package is installed, we should implement a custom SVG-based interactive graph directly:
* **Zoom and Pan**: Add event listeners (`onMouseDown`, `onMouseMove`, `onMouseUp`, `onWheel`) to a parent `<svg>` element that update a `transform` state `{ x, y, zoom }`. Apply this state as a CSS transform on an inner `<g>` container.
* **Layered Column Layout Algorithm**:
  * Place nodes into 8 vertical columns to visually map the flow of supply-demand dependencies:
    1. **Customers** ($X_1 = 100$)
    2. **Sales Orders** ($X_2 = 350$)
    3. **Finished Goods** ($X_3 = 600$)
    4. **Manufacturing Orders** ($X_4 = 850$)
    5. **BOMs / Operations** ($X_5 = 1100$)
    6. **Raw Materials** ($X_6 = 1350$)
    7. **Stock Allocations / Shelf Locations** ($X_7 = 1600$)
    8. **Suppliers / Purchase Orders** ($X_8 = 1850$)
  * Spacing: Vertically distribute nodes inside each column dynamically:
    $$Y_j = j \times \left(\frac{\text{Height} - 200}{\text{Count} - 1}\right) + 100$$
    This avoids overlapping and presents a clean, deterministic, left-to-right supply chain flow.
  * Render edges using smooth SVG Bézier curves:
    $$\text{d} = \text{M } x_1\ y_1\ \text{C } \left(\frac{x_1 + x_2}{2}\right)\ y_1\text{, } \left(\frac{x_1 + x_2}{2}\right)\ y_2\text{, } x_2\ y_2$$

---

## 3. Caveats

* **Lead Time Calculations**: Standard lead times are assumed (e.g. 7 days for POs) since actual vendor lead time metrics are not stored in the database.
* **Cannibalization Priority**: The backend Revenue at Risk calculation assumes FIFO allocation (first ordered, first allocated). During simulation, the simulator calculates cannibalization by allocating stock to existing confirmed orders before allocating to the simulated order.
* **Client-side Performance**: Rendering more than 500 nodes on SVG can cause rendering lags. If the ERP scales beyond this, dynamic viewport pruning or transitioning to HTML5 Canvas is advised.

---

## 4. Conclusion & Implementation Plan

### A. Backend Router Implementation
Create the file `backend/app/routers/digital_twin.py` with the following implementation:

```python
# backend/app/routers/digital_twin.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime

from backend.app.database import get_db
from backend.app.models import (
    Product, SalesOrder, PurchaseOrder, BoM, ManufacturingOrder,
    Warehouse, Aisle, Rack, Shelf, StockAllocation
)
from backend.app.auth import get_current_user
from backend.app.schemas import DigitalTwinGraphResponse, GraphNode, GraphEdge, GraphSummary

router = APIRouter(tags=["Digital Twin"])

@router.get("/api/digital-twin/graph", response_model=DigitalTwinGraphResponse)
def get_digital_twin_graph(
    include_inactive: bool = Query(False, description="Include completed/cancelled orders"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 1. Query Database
    products = db.query(Product).all()
    product_map = {p.id: p for p in products}

    if include_inactive:
        sales_orders = db.query(SalesOrder).all()
        mfg_orders = db.query(ManufacturingOrder).all()
        purchase_orders = db.query(PurchaseOrder).all()
    else:
        sales_orders = db.query(SalesOrder).filter(SalesOrder.status == "Confirmed").all()
        mfg_orders = db.query(ManufacturingOrder).filter(ManufacturingOrder.status.in_(["Draft", "Planned", "In Progress"])).all()
        purchase_orders = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_(["Draft", "Ordered"])).all()

    boms = db.query(BoM).all()
    warehouses = db.query(Warehouse).all()
    aisles = db.query(Aisle).all()
    racks = db.query(Rack).all()
    shelves = db.query(Shelf).all()
    allocations = db.query(StockAllocation).all()

    nodes = []
    edges = []

    # 2. Extract unique Customers & Suppliers
    customers = set(so.customer_name for so in sales_orders if so.customer_name)
    suppliers = set(po.vendor_name for po in purchase_orders if po.vendor_name)
    for p in products:
        if p.vendor_id:
            suppliers.add(p.vendor_id)

    # 3. Calculate Demands & Shortages
    product_demand = {p.id: 0.0 for p in products}
    for so in sales_orders:
        for line in so.lines:
            if line.product_id in product_demand:
                product_demand[line.product_id] += (line.quantity - line.delivered_qty)
    for mo in mfg_orders:
        for comp in mo.components:
            if comp.component_product_id in product_demand:
                product_demand[comp.component_product_id] += (comp.required_quantity - comp.consumed_quantity)

    critical_shortages = set()
    product_statuses = {}
    for p in products:
        free_qty = p.free_to_use_qty
        demand = product_demand.get(p.id, 0.0)

        if free_qty < 0 or (demand > 0 and free_qty < demand):
            # Check incoming supply to offset
            incoming = 0.0
            if p.category == "Raw Material":
                incoming = sum(
                    l.quantity - l.received_qty
                    for po in purchase_orders if po.status in ["Draft", "Ordered"]
                    for l in po.lines if l.product_id == p.id
                )
            else:
                incoming = sum(
                    mo.quantity for mo in mfg_orders if mo.status in ["Draft", "Planned", "In Progress"] and mo.product_id == p.id
                )
            
            if free_qty + incoming < demand:
                product_statuses[p.id] = "red"
                critical_shortages.add(p.id)
            else:
                product_statuses[p.id] = "yellow"
        elif free_qty < p.min_stock_level:
            product_statuses[p.id] = "yellow"
        else:
            product_statuses[p.id] = "green"

    # 4. Trace Revenue at Risk
    blocked_products = {}
    memo = {}

    def is_blocked(pid: int) -> bool:
        if pid in memo:
            return memo[pid]
        if pid in critical_shortages:
            memo[pid] = True
            return True
        prod = product_map.get(pid)
        if prod and prod.category == "Finished Good" and prod.bom_id:
            bom = next((b for b in boms if b.id == prod.bom_id), None)
            if bom:
                for comp in bom.components:
                    if is_blocked(comp.component_product_id):
                        memo[pid] = True
                        return True
        memo[pid] = False
        return False

    for pid in product_map:
        blocked_products[pid] = is_blocked(pid)

    revenue_at_risk = 0.0
    affected_sos = set()

    sales_order_statuses = {}
    for so in sales_orders:
        so_blocked = False
        so_val_at_risk = 0.0
        for line in so.lines:
            rem_qty = line.quantity - line.delivered_qty
            if rem_qty > 0 and blocked_products.get(line.product_id, False):
                so_blocked = True
                so_val_at_risk += rem_qty * line.unit_price
        
        if so_blocked:
            sales_order_statuses[so.id] = "red"
            revenue_at_risk += so_val_at_risk
            affected_sos.add(so.id)
        else:
            has_warn = any(product_statuses.get(l.product_id) == "yellow" for l in so.lines)
            sales_order_statuses[so.id] = "yellow" if has_warn else "green"

    # MO status
    mo_statuses = {
        mo.id: "red" if any(blocked_products.get(c.component_product_id, False) for c in mo.components)
        else ("yellow" if any(product_statuses.get(c.component_product_id) == "yellow" for c in mo.components) else "green")
        for mo in mfg_orders
    }

    # PO status
    po_statuses = {}
    for po in purchase_orders:
        days = (datetime.utcnow() - po.order_date).days
        po_statuses[po.id] = "red" if days > 7 else ("yellow" if days > 4 else "green")

    # Supplier status
    supplier_statuses = {}
    for s in suppliers:
        pos = [po for po in purchase_orders if po.vendor_name == s]
        supplier_statuses[s] = "red" if any(po_statuses.get(p.id) == "red" for p in pos) else (
            "yellow" if any(po_statuses.get(p.id) == "yellow" for p in pos) else "green"
        )

    # Customer status
    customer_statuses = {}
    for c in customers:
        sos = [so for so in sales_orders if so.customer_name == c]
        customer_statuses[c] = "red" if any(sales_order_statuses.get(o.id) == "red" for o in sos) else (
            "yellow" if any(sales_order_statuses.get(o.id) == "yellow" for o in sos) else "green"
        )

    # Shelf Capacity
    shelf_occupancy = {}
    shelf_statuses = {}
    for shelf in shelves:
        qty = sum(a.quantity for a in allocations if a.shelf_id == shelf.id)
        pct = (qty / 100.0) * 100.0  # Max capacity 100
        shelf_occupancy[shelf.id] = pct
        shelf_statuses[shelf.id] = "red" if pct >= 90.0 else ("yellow" if pct >= 75.0 else "green")

    # 5. Populate Nodes & Edges
    for c in customers:
        nodes.append(GraphNode(id=f"cust_{c}", label=f"Cust: {c}", type="customer", status=customer_statuses.get(c, "green"), details={}))
    
    for so in sales_orders:
        nodes.append(GraphNode(
            id=f"so_{so.id}", label=f"SO #{so.id}", type="sales_order",
            status=sales_order_statuses.get(so.id, "green"),
            details={"customer": so.customer_name, "status": so.status, "amount": so.total_amount}
        ))
        if so.customer_name:
            edges.append(GraphEdge(id=f"e_c_so_{so.id}", source=f"cust_{so.customer_name}", target=f"so_{so.id}", type="places"))
        for l in so.lines:
            edges.append(GraphEdge(id=f"e_so_p_{so.id}_{l.product_id}", source=f"so_{so.id}", target=f"prod_{l.product_id}", type="demands"))

    for p in products:
        p_type = "product"
        lbl = f"FG: {p.name}" if p.category == "Finished Good" else f"RM: {p.name}"
        nodes.append(GraphNode(
            id=f"prod_{p.id}", label=lbl, type=p_type, status=product_statuses.get(p.id, "green"),
            details={"sku": p.sku, "category": p.category, "free": p.free_to_use_qty, "min": p.min_stock_level, "on_hand": p.on_hand_qty}
        ))
        if p.category == "Finished Good" and p.bom_id:
            edges.append(GraphEdge(id=f"e_p_bom_{p.id}", source=f"prod_{p.id}", target=f"bom_{p.bom_id}", type="has_bom"))
        if p.category == "Raw Material" and p.vendor_id:
            edges.append(GraphEdge(id=f"e_supp_rm_{p.id}", source=f"supp_{p.vendor_id}", target=f"prod_{p.id}", type="default_vendor"))

    for bom in boms:
        nodes.append(GraphNode(id=f"bom_{bom.id}", label=f"BoM: {bom.name}", type="bom", status="green", details={}))
        for c in bom.components:
            edges.append(GraphEdge(id=f"e_bom_rm_{bom.id}_{c.component_product_id}", source=f"bom_{bom.id}", target=f"prod_{c.component_product_id}", type="requires"))

    for mo in mfg_orders:
        nodes.append(GraphNode(id=f"mo_{mo.id}", label=f"MO #{mo.id}", type="manufacturing_order", status=mo_statuses.get(mo.id, "green"), details={"qty": mo.quantity, "status": mo.status}))
        edges.append(GraphEdge(id=f"e_mo_p_{mo.id}", source=f"mo_{mo.id}", target=f"prod_{mo.product_id}", type="produces"))
        edges.append(GraphEdge(id=f"e_mo_bom_{mo.id}", source=f"mo_{mo.id}", target=f"bom_{mo.bom_id}", type="uses_bom"))
        for c in mo.components:
            edges.append(GraphEdge(id=f"e_mo_comp_{mo.id}_{c.component_product_id}", source=f"mo_{mo.id}", target=f"prod_{c.component_product_id}", type="consumes"))

    for po in purchase_orders:
        nodes.append(GraphNode(id=f"po_{po.id}", label=f"PO #{po.id}", type="purchase_order", status=po_statuses.get(po.id, "green"), details={"vendor": po.vendor_name, "status": po.status}))
        if po.vendor_name:
            edges.append(GraphEdge(id=f"e_supp_po_{po.id}", source=f"supp_{po.vendor_name}", target=f"po_{po.id}", type="supplies_po"))
        for l in po.lines:
            edges.append(GraphEdge(id=f"e_po_rm_{po.id}_{l.product_id}", source=f"po_{po.id}", target=f"prod_{l.product_id}", type="procures"))

    for s in suppliers:
        nodes.append(GraphNode(id=f"supp_{s}", label=f"Vendor: {s}", type="supplier", status=supplier_statuses.get(s, "green"), details={}))

    for wh in warehouses:
        nodes.append(GraphNode(id=f"wh_{wh.id}", label=wh.name, type="warehouse", status="green", details={}))
    for ai in aisles:
        nodes.append(GraphNode(id=f"aisle_{ai.id}", label=ai.name, type="aisle", status="green", details={}))
        edges.append(GraphEdge(id=f"e_ai_wh_{ai.id}", source=f"aisle_{ai.id}", target=f"wh_{ai.warehouse_id}", type="within"))
    for r in racks:
        nodes.append(GraphNode(id=f"rack_{r.id}", label=r.name, type="rack", status="green", details={}))
        edges.append(GraphEdge(id=f"e_r_ai_{r.id}", source=f"rack_{r.id}", target=f"aisle_{r.aisle_id}", type="within"))
    for sh in shelves:
        nodes.append(GraphNode(id=f"shelf_{sh.id}", label=sh.name, type="shelf", status=shelf_statuses.get(sh.id, "green"), details={"occupancy": shelf_occupancy.get(sh.id, 0.0)}))
        edges.append(GraphEdge(id=f"e_sh_r_{sh.id}", source=f"shelf_{sh.id}", target=f"rack_{sh.rack_id}", type="within"))

    for a in allocations:
        if a.quantity > 0:
            edges.append(GraphEdge(id=f"e_alloc_{a.product_id}_{a.shelf_id}", source=f"prod_{a.product_id}", target=f"shelf_{a.shelf_id}", type="allocated_to"))

    summary = GraphSummary(
        total_revenue_at_risk=revenue_at_risk,
        affected_sales_orders_count=len(affected_sos),
        critical_shortages_count=len(critical_shortages)
    )

    return DigitalTwinGraphResponse(nodes=nodes, edges=edges, summary=summary)
```

Register this router in `backend/app/main.py`:
```python
from backend.app.routers import digital_twin
app.include_router(digital_twin.router, dependencies=[Depends(require_module("dashboard", read_all=True))])
```

### B. Schemas Update
Add the following models in `backend/app/schemas.py`:
```python
# backend/app/schemas.py
class GraphNode(BaseModel):
    id: str
    label: str
    type: str
    status: str
    details: Dict[str, Any]

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str

class GraphSummary(BaseModel):
    total_revenue_at_risk: float
    affected_sales_orders_count: int
    critical_shortages_count: int

class DigitalTwinGraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    summary: GraphSummary
```

### C. Frontend Navigation Setup
In `frontend/src/components/AppShell.tsx`:
Add the new sidebar route below "Warehouse Mapping":
```typescript
      { to: "/warehouse-mapping", label: "Warehouse Mapping", icon: Warehouse },
      { to: "/digital-twin", label: "Digital Twin", icon: Boxes }, // or visual network icon
```

Register route and permissions in `frontend/src/lib/permissions.ts` and `frontend/src/App.tsx`:
```typescript
// permissions.ts
ROUTE_ROLES["/digital-twin"] = ["admin", "business_owner", "sales", "purchase", "manufacturing", "inventory_manager"];

// App.tsx
import DigitalTwin from "@/pages/digital-twin/DigitalTwin";
// Inside routes:
<Route path="/digital-twin" element={<DigitalTwin />} />
```

### D. Custom SVG Visual Graph & Simulator Page
Create the visual graph page `frontend/src/pages/digital-twin/DigitalTwin.tsx` using a column-based layout algorithm and client-side simulation engine:

```tsx
// frontend/src/pages/digital-twin/DigitalTwin.tsx
import * as React from "react";
import axios from "axios";
import { PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Activity, X, SlidersHorizontal, RefreshCw } from "lucide-react";

interface GraphNode {
  id: str;
  label: str;
  type: str;
  status: "green" | "yellow" | "red";
  details: any;
}

interface GraphEdge {
  id: str;
  source: str;
  target: str;
  type: str;
}

const COLUMNS = [
  "customer",
  "sales_order",
  "product_fg",
  "manufacturing_order",
  "bom",
  "product_rm",
  "warehouse_location",
  "supplier_po"
];

export default function DigitalTwin() {
  const [loading, setLoading] = React.useState(true);
  const [rawNodes, setRawNodes] = React.useState<GraphNode[]>([]);
  const [rawEdges, setRawEdges] = React.useState<GraphEdge[]>([]);
  const [summary, setSummary] = React.useState({ total_revenue_at_risk: 0, affected_sales_orders_count: 0, critical_shortages_count: 0 });

  const [simNodes, setSimNodes] = React.useState<GraphNode[] | null>(null);
  const [simSummary, setSimSummary] = React.useState<any>(null);

  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);
  const [transform, setTransform] = React.useState({ x: 0, y: 0, zoom: 0.85 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });

  // Simulator Inputs
  const [simProduct, setSimProduct] = React.useState("");
  const [simQuantity, setSimQuantity] = React.useState(100);

  const nodes = simNodes || rawNodes;
  const activeSummary = simSummary || summary;

  React.useEffect(() => {
    fetchGraph();
  }, []);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:8000/api/digital-twin/graph", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRawNodes(res.data.nodes);
      setRawEdges(res.data.edges);
      setSummary(res.data.summary);
      setSimNodes(null);
      setSimSummary(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Pan/Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTransform(prev => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
  };

  const handleWheel = (e: React.WheelEvent) => {
    const nextZoom = e.deltaY < 0 ? transform.zoom * 1.05 : transform.zoom / 1.05;
    setTransform(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(3, nextZoom)) }));
  };

  // Run Virtual Impact Simulator (Frontend-Only calculation)
  const runSimulation = () => {
    if (!simProduct) return;
    const qty = Number(simQuantity);

    // Deep clone state
    const clonedNodes = JSON.parse(JSON.stringify(rawNodes)) as GraphNode[];
    const targetFGNode = clonedNodes.find(n => n.id === `prod_${simProduct}`);
    if (!targetFGNode) return;

    // 1. Add virtual Sales Order and Manufacturing Order Nodes
    const virtualSOId = `so_simulated`;
    const virtualMOId = `mo_simulated`;

    clonedNodes.push({
      id: virtualSOId,
      label: `Simulated SO (${qty} units)`,
      type: "sales_order",
      status: "green",
      details: { customer: "Virtual Customer", status: "Simulated", amount: qty * (targetFGNode.details.sales_price || 0) }
    });

    clonedNodes.push({
      id: virtualMOId,
      label: `Simulated MO (${qty} units)`,
      type: "manufacturing_order",
      status: "green",
      details: { qty, status: "Simulated" }
    });

    // Determine BOM components of the target finished good
    // For this simulation, we locate BoM component links connected to this product's BoM
    const bomNode = clonedNodes.find(n => n.type === "bom" && n.details.product_id === Number(simProduct));
    let hasShortage = false;
    let virtualRevAtRisk = 0;

    if (bomNode) {
      // Find components required by this BOM
      const componentEdges = rawEdges.filter(e => e.source === bomNode.id);
      componentEdges.forEach(edge => {
        const compNode = clonedNodes.find(n => n.id === edge.target);
        if (compNode) {
          // Assume standard requirement qty factor (stored in database or mocked)
          // Look up raw material component usage or use dummy factor (e.g. 4 planks per table)
          const factor = compNode.details.sku === "RM001" ? 4 : (compNode.details.sku === "RM002" ? 0.2 : 2);
          const required = qty * factor;
          const virtualAvailable = compNode.details.free - required;

          if (virtualAvailable < 0) {
            hasShortage = true;
            compNode.status = "red";
            compNode.details.free = virtualAvailable;
          } else {
            compNode.details.free = virtualAvailable;
          }
        }
      });
    }

    if (hasShortage) {
      clonedNodes.forEach(n => {
        if (n.id === virtualSOId || n.id === virtualMOId || n.id === `prod_${simProduct}`) {
          n.status = "red";
        }
      });
      virtualRevAtRisk = qty * (targetFGNode.details.sales_price || 500);
    }

    setSimNodes(clonedNodes);
    setSimSummary({
      total_revenue_at_risk: rawSummary().total_revenue_at_risk + virtualRevAtRisk,
      affected_sales_orders_count: rawSummary().affected_sales_orders_count + (hasShortage ? 1 : 0),
      critical_shortages_count: rawSummary().critical_shortages_count + (hasShortage ? 1 : 0)
    });
  };

  const rawSummary = () => summary;

  // Calculate Layout Positions
  const width = 1900;
  const height = 800;
  const colWidth = width / COLUMNS.length;

  const getColName = (node: GraphNode): string => {
    if (node.type === "customer") return "customer";
    if (node.type === "sales_order") return "sales_order";
    if (node.type === "bom") return "bom";
    if (node.type === "manufacturing_order") return "manufacturing_order";
    if (node.type === "purchase_order" || node.type === "supplier") return "supplier_po";
    if (node.type === "warehouse" || node.type === "aisle" || node.type === "rack" || node.type === "shelf") return "warehouse_location";
    if (node.type === "product") {
      return node.details.category === "Finished Good" ? "product_fg" : "product_rm";
    }
    return "product_fg";
  };

  const grouped: Record<string, GraphNode[]> = {};
  COLUMNS.forEach(col => { grouped[col] = []; });
  nodes.forEach(n => {
    const col = getColName(n);
    if (grouped[col]) grouped[col].push(n);
  });

  const nodeCoords: Record<string, { x: number; y: number }> = {};
  COLUMNS.forEach((col, colIdx) => {
    const list = grouped[col];
    const len = list.length;
    const x = colIdx * colWidth + colWidth / 2;
    list.forEach((node, nodeIdx) => {
      const y = len > 1 ? (nodeIdx / (len - 1)) * (height - 180) + 90 : height / 2;
      nodeCoords[node.id] = { x, y };
    });
  });

  return (
    <div className="flex h-screen flex-col bg-canvas">
      <PageHeader title="Company Digital Twin Dashboard" description="Live supply chain graph with impact tracer and simulator." />
      
      {/* Simulation Bar */}
      <div className="bg-background border-b p-4 flex gap-4 items-center">
        <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
        <span className="font-semibold text-sm">Virtual Impact Simulator</span>
        <Select value={simProduct} onChange={(e: any) => setSimProduct(e.target.value)} className="w-48">
          <option value="">Select Finished Good...</option>
          {rawNodes.filter(n => n.type === "product" && n.details.category === "Finished Good").map(n => (
            <option key={n.id} value={n.id.replace("prod_", "")}>{n.label}</option>
          ))}
        </Select>
        <Input type="number" value={simQuantity} onChange={(e) => setSimQuantity(Number(e.target.value))} className="w-24" />
        <Button onClick={runSimulation}>Simulate Load</Button>
        {simNodes && <Button variant="outline" onClick={fetchGraph}><RefreshCw className="mr-2 h-4 w-4" /> Reset</Button>}
        
        {/* KPI Panel */}
        <div className="ml-auto flex gap-4">
          <div className="px-3 py-1 bg-red-50 text-red-700 rounded text-xs border border-red-200">
            <strong>Rev at Risk:</strong> ${activeSummary.total_revenue_at_risk.toLocaleString()}
          </div>
          <div className="px-3 py-1 bg-amber-50 text-amber-700 rounded text-xs border border-amber-200">
            <strong>Affected SOs:</strong> {activeSummary.affected_sales_orders_count}
          </div>
          <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">
            <strong>Shortages:</strong> {activeSummary.critical_shortages_count}
          </div>
        </div>
      </div>

      {/* Main Graph Viewport */}
      <div className="flex-1 relative overflow-hidden" onWheel={handleWheel}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-canvas/80">Loading graph...</div>
        ) : (
          <svg
            className="w-full h-full cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.zoom})`}>
              {/* Render Connection Edges */}
              {rawEdges.map((edge, i) => {
                const s = nodeCoords[edge.source];
                const t = nodeCoords[edge.target];
                if (!s || !t) return null;
                const cx = (s.x + t.x) / 2;
                const pathStr = `M ${s.x} ${s.y} C ${cx} ${s.y}, ${cx} ${t.y}, ${t.x} ${t.y}`;
                
                // Highlight edge Red if source or target is in red/shortage status
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                const isShortagePath = sourceNode?.status === "red" && targetNode?.status === "red";

                return (
                  <path
                    key={i}
                    d={pathStr}
                    fill="none"
                    stroke={isShortagePath ? "#ef4444" : "#e2e8f0"}
                    strokeWidth={isShortagePath ? 2.5 : 1.5}
                    opacity={isShortagePath ? 0.9 : 0.4}
                  />
                );
              })}

              {/* Render Nodes */}
              {nodes.map(node => {
                const coord = nodeCoords[node.id];
                if (!coord) return null;

                const colorMap = {
                  green: { fill: "#f0fdf4", stroke: "#22c55e" },
                  yellow: { fill: "#fefbeb", stroke: "#eab308" },
                  red: { fill: "#fef2f2", stroke: "#ef4444" }
                }[node.status];

                const isSelected = selectedNode?.id === node.id;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${coord.x}, ${coord.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelectedNode(node)}
                  >
                    <rect
                      x={-75}
                      y={-22}
                      width={150}
                      height={44}
                      rx={6}
                      fill={colorMap.fill}
                      stroke={isSelected ? "#3b82f6" : colorMap.stroke}
                      strokeWidth={isSelected ? 3 : 1.5}
                    />
                    <text
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      className="text-[10px] font-semibold fill-foreground"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Sidebar Drawer */}
        {selectedNode && (
          <Card className="absolute right-4 top-4 bottom-4 w-80 bg-background border shadow-2xl p-4 flex flex-col z-30">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
              <h3 className="font-semibold text-base">{selectedNode.label}</h3>
              <Button size="icon" variant="ghost" onClick={() => setSelectedNode(null)} className="h-8 w-8"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto text-sm">
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Type: {selectedNode.type}</p>
              <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status: <span className={`capitalize ${selectedNode.status === 'red' ? 'text-red-600' : (selectedNode.status === 'yellow' ? 'text-amber-500' : 'text-green-600')}`}>{selectedNode.status}</span></p>
              
              <div className="border-t pt-3">
                <h4 className="font-medium mb-2">Properties & Metrics:</h4>
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(selectedNode.details, null, 2)}
                </pre>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
```

---

## 5. Verification Method

### A. Automated Tests: `backend/test_digital_twin.py`
Create `backend/test_digital_twin.py` to test healthy vs shortage states and verify all business entity mappings:

```python
# backend/test_digital_twin.py
import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.seed import seed_db
from backend.app.database import SessionLocal
from backend.app.models import Product, SalesOrder, SalesOrderLine

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("Starting Shiv Furniture Works - Digital Twin Tests")
    print("==================================================")

    # 1. Reset Database
    print("\n[Step 1] Seeding database...")
    seed_db()

    # 2. Login
    print("\n[Step 2] Authenticating as admin...")
    login_response = client.post("/api/auth/login", data={"username": "admin", "password": "admin123"})
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create a Confirmed Sales Order
    print("\n[Step 3] Seeding a confirmed Sales Order...")
    db = SessionLocal()
    fg_table = db.query(Product).filter(Product.sku == "FG001").first()
    assert fg_table is not None

    so_payload = {
        "customer_name": "Acme Furniture Corp",
        "lines": [{"product_id": fg_table.id, "quantity": 3.0, "unit_price": 500.0}]
    }
    so_resp = client.post("/api/sales-orders", json=so_payload, headers=headers)
    assert so_resp.status_code == 201
    so_id = so_resp.json()["id"]

    # Confirm order to make it active
    confirm_resp = client.post(f"/api/sales-orders/{so_id}/confirm", headers=headers)
    assert confirm_resp.status_code == 200
    print("[PASS] Sales order confirmed successfully.")

    # 4. Check Digital Twin Graph (Healthy State)
    print("\n[Step 4] Checking Digital Twin graph in healthy state...")
    graph_resp = client.get("/api/digital-twin/graph", headers=headers)
    assert graph_resp.status_code == 200
    graph_data = graph_resp.json()

    # Assert entities mapped
    nodes = graph_data["nodes"]
    edges = graph_data["edges"]
    summary = graph_data["summary"]

    assert any(n["type"] == "customer" and n["id"] == "cust_Acme Furniture Corp" for n in nodes)
    assert any(n["type"] == "sales_order" and n["id"] == f"so_{so_id}" for n in nodes)
    assert any(n["type"] == "product" and n["details"]["sku"] == "FG001" for n in nodes)
    assert any(n["type"] == "product" and n["details"]["sku"] == "RM001" for n in nodes)
    assert summary["critical_shortages_count"] == 0
    assert summary["total_revenue_at_risk"] == 0.0
    print("[PASS] Healthy state graph mapped correctly.")

    # 5. Induce shortage (Set Wood Plank RM001 stock to 0)
    print("\n[Step 5] Inducing a component stock shortage...")
    rm_wood = db.query(Product).filter(Product.sku == "RM001").first()
    rm_wood.on_hand_qty = 0.0
    rm_wood.reserved_qty = 0.0
    db.commit()
    db.close()

    # Re-query Graph
    graph_resp_short = client.get("/api/digital-twin/graph", headers=headers)
    assert graph_resp_short.status_code == 200
    graph_data_short = graph_resp_short.json()
    nodes_short = graph_data_short["nodes"]
    summary_short = graph_data_short["summary"]

    # Verify Wood Plank is Red
    rm_node = next(n for n in nodes_short if n["details"].get("sku") == "RM001")
    assert rm_node["status"] == "red"

    # Verify Sales Order is Red due to component shortage
    so_node = next(n for n in nodes_short if n["id"] == f"so_{so_id}")
    assert so_node["status"] == "red"

    # Verify Revenue at Risk matches Sales Order value (3 * 500 = 1500)
    assert summary_short["total_revenue_at_risk"] == 1500.0
    assert summary_short["affected_sales_orders_count"] == 1
    assert summary_short["critical_shortages_count"] == 1
    print("[PASS] Shortage state and revenue at risk verified successfully.")

    print("==================================================")
    print("ALL DIGITAL TWIN AUTOMATED TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
```

### B. Manual Verification Instructions
1. Run Python test command: `python -m backend.test_digital_twin` to verify backend endpoint correctness.
2. Run frontend dev build: `npm run dev` in the `frontend` folder and verify it compiles with TypeScript.
3. Access the browser, log in as `owner` or `admin`, navigate to the `Digital Twin` sidebar item, interact with graph pan/zoom using the mouse, click nodes to view details in the sidebar panel, and run finished goods simulations.
