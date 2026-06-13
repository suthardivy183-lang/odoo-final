from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Set
from backend.app.database import get_db
from backend.app.auth import get_current_user
from backend.app.models import (
    Product, SalesOrder, SalesOrderLine, PurchaseOrder, PurchaseOrderLine,
    BoM, BoMComponent, ManufacturingOrder, Warehouse, Shelf, StockAllocation
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
        po_query = po_query.filter(PurchaseOrder.status.in_(["Draft", "Ordered", "Confirmed"]))
        
    sales_orders = so_query.all()
    mfg_orders = mo_query.all()
    purchase_orders = po_query.all()
    warehouses = db.query(Warehouse).all()
    shelves = db.query(Shelf).all()
    allocations = db.query(StockAllocation).all()

    # 2. Map structures for faster lookup
    product_map = {p.id: p for p in products}
    bom_map = {b.product_id: b for b in boms}
    bom_by_id = {b.id: b for b in boms}
    
    # 3. Perform inventory and shortage calculations
    # Initial available free stock for each product
    avail_stock = {p.id: p.free_to_use_qty for p in products}
    
    # We will accumulate virtual demands representing the orders' requirements.
    total_demand: Dict[int, float] = {p.id: 0.0 for p in products}
    
    # Track which raw materials are in critical shortage specifically due to Sales Orders
    root_cause_shortages: Set[int] = set()
    
    # Recursive allocation function mimicking MRP
    def allocate_and_trace(prod_id: int, qty: float) -> float:
        """
        Attempts to satisfy demand for `qty` of `prod_id` from current virtual inventory.
        Returns the shortage quantity (amount that could not be satisfied/produced).
        """
        if qty <= 0:
            return 0.0
            
        current_avail = avail_stock.get(prod_id, 0.0)
        if current_avail >= qty:
            # Fully covered by stock
            avail_stock[prod_id] -= qty
            return 0.0
        else:
            # Consume whatever is available
            allocated = max(0.0, current_avail)
            avail_stock[prod_id] = 0.0
            shortage = qty - allocated
            
            # Can we manufacture the shortage?
            bom = bom_map.get(prod_id)
            if bom and bom.components:
                # Yes, try to manufacture. Check and allocate components recursively
                component_shortage_detected = False
                for comp in bom.components:
                    req_comp_qty = comp.quantity * shortage
                    # Accumulate component demand
                    total_demand[comp.component_product_id] += req_comp_qty
                    comp_shortage = allocate_and_trace(comp.component_product_id, req_comp_qty)
                    if comp_shortage > 0:
                        component_shortage_detected = True
                        root_cause_shortages.add(comp.component_product_id)
                if component_shortage_detected:
                    return shortage
                else:
                    # Successfully manufactured in-memory
                    return 0.0
            else:
                # Cannot manufacture (Raw Material or no BoM)
                root_cause_shortages.add(prod_id)
                return shortage

    # Process Sales Orders to compute demand and identify revenue at risk
    total_revenue_at_risk = 0.0
    sales_order_revenue_at_risk: Dict[int, float] = {}
    
    # Sort by date/ID to ensure deterministic allocation
    sorted_sales_orders = sorted(sales_orders, key=lambda so: so.id)
    
    for so in sorted_sales_orders:
        so_at_risk = False
        so_risk_amount = 0.0
        for line in so.lines:
            unfulfilled = line.quantity - line.delivered_qty
            if unfulfilled > 0:
                # Accumulate finished good demand
                total_demand[line.product_id] += unfulfilled
                # Run the allocation tracer
                shortage = allocate_and_trace(line.product_id, unfulfilled)
                if shortage > 0:
                    so_at_risk = True
                    so_risk_amount += shortage * line.unit_price
        
        if so_at_risk and so.status != "Cancelled":
            sales_order_revenue_at_risk[so.id] = so_risk_amount
            total_revenue_at_risk += so_risk_amount

    # 4. Determine Statuses for Products
    product_status: Dict[int, str] = {}
    for p in products:
        free_stock = p.free_to_use_qty
        demand = total_demand.get(p.id, 0.0)
        
        if free_stock < 0 or (demand > 0 and free_stock < demand):
            product_status[p.id] = "red"
        elif free_stock < p.min_stock_level:
            product_status[p.id] = "yellow"
        else:
            product_status[p.id] = "green"

    # Extract Customers and Suppliers
    customer_names = {so.customer_name for so in sales_orders if so.customer_name}
    
    # Suppliers from Purchase Orders or Product vendor_id
    supplier_names = {po.vendor_name for po in purchase_orders if po.vendor_name}
    for p in products:
        if p.vendor_id:
            supplier_names.add(str(p.vendor_id))

    # Initialize nodes and edges list
    nodes = []
    edges = []
    node_map = {}

    # Helper to add node
    def add_node(node_id: str, node_type: str, label: str, status: str, details: Dict[str, Any]):
        node = {
            "id": node_id,
            "type": node_type,
            "label": label,
            "status": status,
            "details": details
        }
        nodes.append(node)
        node_map[node_id] = node

    # A. Customers
    for name in sorted(customer_names):
        # Customer status: Red if they have a Red sales order, Green otherwise
        cust_so = [so for so in sales_orders if so.customer_name == name]
        status = "green"
        if any(so.id in sales_order_revenue_at_risk for so in cust_so):
            status = "red"
        elif any(so.status == "Draft" for so in cust_so):
            status = "yellow"
        add_node(f"customer:{name}", "customer", name, status, {"name": name})

    # B. Sales Orders
    for so in sales_orders:
        status = "green"
        risk_amount = sales_order_revenue_at_risk.get(so.id, 0.0)
        if risk_amount > 0:
            status = "red"
        elif so.status == "Draft":
            status = "yellow"
        add_node(
            f"sales_order:{so.id}",
            "sales_order",
            f"SO-{so.id}",
            status,
            {
                "customer": so.customer_name,
                "status": so.status,
                "total_amount": so.total_amount,
                "revenue_at_risk": risk_amount,
                "date": so.order_date.isoformat() if so.order_date else None
            }
        )

    # C. Products
    for p in products:
        status = product_status.get(p.id, "green")
        add_node(
            f"product:{p.id}",
            "product",
            p.name,
            status,
            {
                "sku": p.sku,
                "category": p.category,
                "on_hand": p.on_hand_qty,
                "reserved": p.reserved_qty,
                "free_to_use": p.free_to_use_qty,
                "min_stock": p.min_stock_level,
                "sales_price": p.sales_price,
                "cost_price": p.cost_price,
                "procurement_type": p.procurement_type,
                "vendor_id": p.vendor_id
            }
        )

    # D. BOMs
    for bom in boms:
        # BoM inherits status of its finished good product
        p_status = product_status.get(bom.product_id, "green")
        add_node(
            f"bom:{bom.id}",
            "bom",
            f"BOM - {bom.name}",
            p_status,
            {"name": bom.name, "description": bom.description}
        )

    # E. Manufacturing Orders
    for mo in mfg_orders:
        # MO status: Red if any component is in critical shortage
        mo_status = "green"
        if mo.status == "Completed":
            mo_status = "green"
        elif mo.status == "Cancelled":
            mo_status = "green"
        else:
            # Check components
            has_red = False
            for comp in mo.components:
                comp_status = product_status.get(comp.component_product_id, "green")
                if comp_status == "red":
                    has_red = True
                    break
            if has_red:
                mo_status = "red"
            elif mo.status == "Draft":
                mo_status = "yellow"
        
        add_node(
            f"manufacturing_order:{mo.id}",
            "manufacturing_order",
            f"MO-{mo.id}",
            mo_status,
            {
                "quantity": mo.quantity,
                "status": mo.status,
                "start_date": mo.start_date.isoformat() if mo.start_date else None,
                "end_date": mo.end_date.isoformat() if mo.end_date else None
            }
        )

    # F. Purchase Orders
    for po in purchase_orders:
        status = "green"
        if po.status == "Draft":
            status = "yellow"
        elif po.status == "Cancelled":
            status = "green"
        add_node(
            f"purchase_order:{po.id}",
            "purchase_order",
            f"PO-{po.id}",
            status,
            {
                "vendor": po.vendor_name,
                "status": po.status,
                "total_amount": po.total_amount,
                "date": po.order_date.isoformat() if po.order_date else None
            }
        )

    # G. Suppliers
    for name in sorted(supplier_names):
        # Supplier status: Red if they supply any product that is Red
        status = "green"
        sup_products = [p for p in products if str(p.vendor_id) == name]
        if any(product_status.get(p.id) == "red" for p in sup_products):
            status = "red"
        elif any(product_status.get(p.id) == "yellow" for p in sup_products):
            status = "yellow"
        add_node(f"supplier:{name}", "supplier", name, status, {"name": name})

    # H. Warehouses and Shelves
    warehouse_map = {w.id: w for w in warehouses}
    # Trace shelf relationships
    shelf_warehouse_id = {}
    
    # We will build shelf -> rack -> aisle -> warehouse path
    # First get aisles, racks, shelves mapping
    for w in warehouses:
        add_node(
            f"warehouse:{w.id}",
            "warehouse",
            w.name,
            "green",
            {"name": w.name, "location": w.location}
        )
        
    for sh in shelves:
        # Find warehouse by traversing rack -> aisle -> warehouse
        wh_id = None
        rack = sh.rack
        if rack:
            aisle = rack.aisle
            if aisle:
                wh_id = aisle.warehouse_id
        
        # Shelf status: Red if it stores any product in critical shortage
        shelf_status = "green"
        sh_allocations = [a for a in allocations if a.shelf_id == sh.id and a.quantity > 0]
        if any(product_status.get(a.product_id) == "red" for a in sh_allocations):
            shelf_status = "red"
        elif any(product_status.get(a.product_id) == "yellow" for a in sh_allocations):
            shelf_status = "yellow"
            
        add_node(
            f"shelf:{sh.id}",
            "shelf",
            sh.name,
            shelf_status,
            {"name": sh.name}
        )
        if wh_id:
            shelf_warehouse_id[sh.id] = wh_id

    # 5. Build Edges (Relationships)
    # Helper to add edge
    def add_edge(edge_id: str, source: str, target: str, edge_type: str, qty: float = None):
        edges.append({
            "id": edge_id,
            "source": source,
            "target": target,
            "type": edge_type,
            "quantity": qty
        })

    # Customer -> Sales Order
    for so in sales_orders:
        if so.customer_name:
            add_edge(
                f"edge-cust-so-{so.id}",
                f"customer:{so.customer_name}",
                f"sales_order:{so.id}",
                "places"
            )

    # Sales Order -> Finished Good
    for so in sales_orders:
        for line in so.lines:
            add_edge(
                f"edge-so-prod-{so.id}-{line.product_id}",
                f"sales_order:{so.id}",
                f"product:{line.product_id}",
                "contains",
                line.quantity
            )

    # Finished Good -> BoM
    for bom in boms:
        add_edge(
            f"edge-prod-bom-{bom.product_id}-{bom.id}",
            f"product:{bom.product_id}",
            f"bom:{bom.id}",
            "manufactured_via"
        )
        # BoM -> Raw Material
        for comp in bom.components:
            add_edge(
                f"edge-bom-comp-{bom.id}-{comp.component_product_id}",
                f"bom:{bom.id}",
                f"product:{comp.component_product_id}",
                "requires",
                comp.quantity
            )

    # Product -> Shelf (stored_at)
    for alloc in allocations:
        if alloc.quantity > 0:
            add_edge(
                f"edge-prod-shelf-{alloc.product_id}-{alloc.shelf_id}",
                f"product:{alloc.product_id}",
                f"shelf:{alloc.shelf_id}",
                "stored_at",
                alloc.quantity
            )

    # Shelf -> Warehouse
    for shelf_id, wh_id in shelf_warehouse_id.items():
        add_edge(
            f"edge-shelf-wh-{shelf_id}-{wh_id}",
            f"shelf:{shelf_id}",
            f"warehouse:{wh_id}",
            "located_in"
        )

    # Supplier -> Purchase Order
    for po in purchase_orders:
        if po.vendor_name:
            add_edge(
                f"edge-supp-po-{po.vendor_name}-{po.id}",
                f"supplier:{po.vendor_name}",
                f"purchase_order:{po.id}",
                "fulfills"
            )

    # Purchase Order -> Raw Material
    for po in purchase_orders:
        for line in po.lines:
            add_edge(
                f"edge-po-prod-{po.id}-{line.product_id}",
                f"purchase_order:{po.id}",
                f"product:{line.product_id}",
                "replenishes",
                line.quantity
            )

    # Product -> Supplier
    for p in products:
        if p.vendor_id:
            add_edge(
                f"edge-prod-supp-{p.id}-{p.vendor_id}",
                f"product:{p.id}",
                f"supplier:{p.vendor_id}",
                "supplied_by"
            )

    # Manufacturing Order Edges:
    # MO -> Finished Good (produces)
    # Raw Material -> MO (input_for)
    for mo in mfg_orders:
        add_edge(
            f"edge-mo-prod-{mo.id}-{mo.product_id}",
            f"manufacturing_order:{mo.id}",
            f"product:{mo.product_id}",
            "produces"
        )
        for comp in mo.components:
            add_edge(
                f"edge-mo-comp-{mo.id}-{comp.component_product_id}",
                f"product:{comp.component_product_id}",
                f"manufacturing_order:{mo.id}",
                "input_for",
                comp.required_quantity
            )

    # Output payload
    return {
        "nodes": nodes,
        "edges": edges,
        "summary": {
            "total_revenue_at_risk": total_revenue_at_risk,
            "critical_shortages_count": len(root_cause_shortages),
            "delayed_orders_count": len(sales_order_revenue_at_risk)
        }
    }
