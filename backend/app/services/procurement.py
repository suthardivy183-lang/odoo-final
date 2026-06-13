from sqlalchemy.orm import Session
from backend.app.models import Product, PurchaseOrder, PurchaseOrderLine, ManufacturingOrder, ManufacturingOrderComponent, ManufacturingOrderOperation, BoM
import logging

logger = logging.getLogger(__name__)

def trigger_procurement_for_product(db: Session, product_id: int, demand_qty: float) -> None:
    """
    Recursively triggers procurement (Purchase Order or Manufacturing Order) for a product shortage.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        logger.warning(f"Product {product_id} not found during procurement check.")
        return

    # Shortage is demand minus free_to_use_qty
    # free_to_use_qty = on_hand_qty - reserved_qty
    free_qty = product.free_to_use_qty
    shortage = demand_qty - free_qty

    if shortage <= 0:
        logger.info(f"Product {product.sku} has sufficient free stock ({free_qty}) to cover demand ({demand_qty}).")
        return

    if not product.procure_on_demand:
        logger.info(f"Product {product.sku} has shortage of {shortage} but procure_on_demand is False.")
        return

    logger.info(f"Triggering procurement for {shortage} units of {product.sku} (Type: {product.procurement_type}).")

    if product.procurement_type == "purchase":
        # Create Purchase Order in Draft
        vendor_name = product.vendor_id if product.vendor_id else "Default Vendor"
        
        po = PurchaseOrder(
            vendor_name=vendor_name,
            status="Draft",
            total_amount=shortage * product.cost_price
        )
        db.add(po)
        db.flush()  # Populate po.id

        po_line = PurchaseOrderLine(
            purchase_order_id=po.id,
            product_id=product.id,
            quantity=shortage,
            unit_price=product.cost_price,
            total_price=shortage * product.cost_price
        )
        db.add(po_line)
        db.flush()
        logger.info(f"Created Draft PO {po.id} for {shortage} units of {product.sku}.")

    elif product.procurement_type == "manufacturing":
        # Look up BoM
        bom = db.query(BoM).filter(BoM.product_id == product.id).first()
        if not bom:
            logger.error(f"Cannot trigger manufacturing for {product.sku}: BoM not found.")
            return

        mo = ManufacturingOrder(
            product_id=product.id,
            bom_id=bom.id,
            quantity=shortage,
            status="Draft"
        )
        db.add(mo)
        db.flush()  # Populate mo.id

        # Copy Components and recursively check for shortages
        for comp in bom.components:
            required_qty = comp.quantity * shortage
            mo_comp = ManufacturingOrderComponent(
                manufacturing_order_id=mo.id,
                component_product_id=comp.component_product_id,
                required_quantity=required_qty,
                consumed_quantity=0.0,
                status="Pending"
            )
            db.add(mo_comp)
            
            # Recursive call for components
            trigger_procurement_for_product(db, comp.component_product_id, required_qty)

        # Copy Operations
        for op in bom.operations:
            mo_op = ManufacturingOrderOperation(
                manufacturing_order_id=mo.id,
                sequence=op.sequence,
                operation_name=op.operation_name,
                work_center=op.work_center,
                standard_time_minutes=op.standard_time_minutes,
                status="Pending"
            )
            db.add(mo_op)

        db.flush()
        logger.info(f"Created Draft MO {mo.id} for {shortage} units of {product.sku}.")
