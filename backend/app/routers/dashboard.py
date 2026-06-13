from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models import Product, SalesOrder, PurchaseOrder, ManufacturingOrder
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Product counts
    total_products = db.query(Product).count()
    finished_goods = db.query(Product).filter(Product.category == "Finished Good").count()
    raw_materials = db.query(Product).filter(Product.category == "Raw Material").count()
    
    # Low stock warning (stock < min level)
    low_stock = db.query(Product).filter(Product.on_hand_qty < Product.min_stock_level).count()
    
    # Inventory valuation
    valuation_query = db.query(func.sum(Product.on_hand_qty * Product.cost_price)).scalar()

    inventory_valuation = float(valuation_query) if valuation_query is not None else 0.0

    # Sales Orders
    so_draft = db.query(SalesOrder).filter(SalesOrder.status == "Draft").count()
    so_confirmed = db.query(SalesOrder).filter(SalesOrder.status == "Confirmed").count()
    so_completed = db.query(SalesOrder).filter(SalesOrder.status == "Completed").count()
    
    # Purchase Orders
    po_draft = db.query(PurchaseOrder).filter(PurchaseOrder.status == "Draft").count()
    po_ordered = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_(["Ordered", "Confirmed"])).count()
    po_received = db.query(PurchaseOrder).filter(PurchaseOrder.status.in_(["Received", "Fully Received", "Partially Received"])).count()

    # Manufacturing Orders
    mo_draft = db.query(ManufacturingOrder).filter(ManufacturingOrder.status == "Draft").count()
    mo_planned = db.query(ManufacturingOrder).filter(ManufacturingOrder.status == "Planned").count()
    mo_in_progress = db.query(ManufacturingOrder).filter(ManufacturingOrder.status == "In Progress").count()
    mo_completed = db.query(ManufacturingOrder).filter(ManufacturingOrder.status == "Completed").count()

    return {
        "products": {
            "total": total_products,
            "finished_goods": finished_goods,
            "raw_materials": raw_materials,
            "low_stock_alerts": low_stock,
            "total_valuation": inventory_valuation
        },
        "sales_orders": {
            "draft": so_draft,
            "confirmed": so_confirmed,
            "completed": so_completed,
            "total": so_draft + so_confirmed + so_completed
        },
        "purchase_orders": {
            "draft": po_draft,
            "ordered": po_ordered,
            "received": po_received,
            "total": po_draft + po_ordered + po_received
        },
        "manufacturing_orders": {
            "draft": mo_draft,
            "planned": mo_planned,
            "in_progress": mo_in_progress,
            "completed": mo_completed,
            "total": mo_draft + mo_planned + mo_in_progress + mo_completed
        }
    }
