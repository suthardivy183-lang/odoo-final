from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import SalesOrder, SalesOrderLine, Product
from backend.app.schemas import SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse
from backend.app.auth import get_current_user
from backend.app.services.procurement import trigger_procurement_for_product

router = APIRouter(prefix="/api/sales-orders", tags=["Sales Orders"])

@router.post("", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
def create_sales_order(
    so_in: SalesOrderCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Calculate totals
    total_amount = 0.0
    lines = []
    
    for line_in in so_in.lines:
        product = db.query(Product).filter(Product.id == line_in.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {line_in.product_id} not found"
            )
        
        total_price = line_in.quantity * line_in.unit_price
        total_amount += total_price
        
        line = SalesOrderLine(
            product_id=line_in.product_id,
            quantity=line_in.quantity,
            unit_price=line_in.unit_price,
            total_price=total_price
        )
        lines.append(line)
        
    so = SalesOrder(
        customer_name=so_in.customer_name,
        status="Draft",
        total_amount=total_amount,
        lines=lines
    )
    db.add(so)
    db.commit()
    db.refresh(so)
    return so

@router.get("", response_model=List[SalesOrderResponse])
def list_sales_orders(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(SalesOrder).all()

@router.get("/{so_id}", response_model=SalesOrderResponse)
def get_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sales Order with ID {so_id} not found"
        )
    return so

@router.put("/{so_id}", response_model=SalesOrderResponse)
def update_sales_order(
    so_id: int,
    so_in: SalesOrderUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sales Order with ID {so_id} not found"
        )
    
    if so.status == "Draft":
        if so_in.lines is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Line updates are not supported in 'Draft' status via PUT."
            )
        
        update_data = so_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(so, field, value)
            
        db.commit()
        db.refresh(so)
        return so
        
    elif so.status == "Partially Delivered":
        # Check if customer_name or status is being modified to a different value
        if so_in.customer_name is not None and so_in.customer_name != so.customer_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only Delivered Qty is editable when 'Partially Delivered'."
            )
        if so_in.status is not None and so_in.status != so.status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only Delivered Qty is editable when 'Partially Delivered'."
            )
            
        if so_in.lines:
            for line_update in so_in.lines:
                # Find the corresponding SalesOrderLine
                line = db.query(SalesOrderLine).filter(
                    SalesOrderLine.sales_order_id == so.id,
                    SalesOrderLine.id == line_update.id
                ).first()
                
                if not line:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Sales Order Line with ID {line_update.id} not found."
                    )
                
                if line_update.delivered_qty < 0 or line_update.delivered_qty > line.quantity:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Delivered quantity must be between 0 and the ordered quantity ({line.quantity})."
                    )
                    
                product = db.query(Product).filter(Product.id == line.product_id).first()
                if not product:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Product not found for line ID {line.id}."
                    )
                    
                diff = line_update.delivered_qty - line.delivered_qty
                if diff > 0:
                    if product.on_hand_qty < diff:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Insufficient stock on hand for product '{product.sku}' to deliver {diff} more units."
                        )
                    product.on_hand_qty -= diff
                    product.reserved_qty -= diff
                elif diff < 0:
                    product.on_hand_qty += abs(diff)
                    product.reserved_qty += abs(diff)
                    
                line.delivered_qty = line_update.delivered_qty
                db.flush()
                
            # Recalculate status based on all lines
            if all(l.delivered_qty == l.quantity for l in so.lines):
                so.status = "Fully Delivered"
            else:
                so.status = "Partially Delivered"
                
            db.commit()
            db.refresh(so)
            return so
        else:
            return so
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update Sales Order in status '{so.status}'"
        )

@router.delete("/{so_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sales Order with ID {so_id} not found"
        )
    if so.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete Sales Orders in 'Draft' status"
        )
    db.delete(so)
    db.commit()
    return None

@router.post("/{so_id}/confirm", response_model=SalesOrderResponse)
def confirm_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sales Order with ID {so_id} not found"
        )
    
    if so.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm Sales Order in status '{so.status}'"
        )
        
    so.status = "Confirmed"
    # 1. Trigger auto procurement
    # 2. Reserve quantities
    for line in so.lines:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        if product:
            trigger_procurement_for_product(db, product.id, line.quantity)
            product.reserved_qty += line.quantity
            db.flush()
            
    db.commit()
    db.refresh(so)
    return so

@router.post("/{so_id}/deliver", response_model=SalesOrderResponse)
def deliver_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sales Order with ID {so_id} not found"
        )
        
    if so.status not in ["Confirmed", "Partially Delivered"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only deliver 'Confirmed' or 'Partially Delivered' Sales Orders"
        )
        
    any_delivered = False
    
    # Process each line and deliver as much as possible
    for line in so.lines:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        if product:
            remaining = line.quantity - line.delivered_qty
            if remaining > 0:
                deliverable = min(remaining, product.on_hand_qty)
                if deliverable > 0:
                    line.delivered_qty += deliverable
                    product.on_hand_qty -= deliverable
                    product.reserved_qty -= deliverable
                    any_delivered = True
                    db.flush()
                    
    if not any_delivered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock on hand to perform any delivery."
        )
        
    # Check if fully delivered
    if all(line.delivered_qty == line.quantity for line in so.lines):
        so.status = "Fully Delivered"
    else:
        so.status = "Partially Delivered"
        
    db.commit()
    db.refresh(so)
    return so

@router.post("/{so_id}/cancel", response_model=SalesOrderResponse)
def cancel_sales_order(
    so_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    so = db.query(SalesOrder).filter(SalesOrder.id == so_id).first()
    if not so:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sales Order with ID {so_id} not found"
        )
        
    if so.status in ["Completed", "Fully Delivered"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a completed or fully delivered Sales Order"
        )
    if so.status == "Cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sales Order is already cancelled"
        )
        
    prev_status = so.status
    so.status = "Cancelled"
    
    # Release remaining reservation if it was confirmed or partially delivered
    if prev_status in ["Confirmed", "Partially Delivered"]:
        for line in so.lines:
            product = db.query(Product).filter(Product.id == line.product_id).first()
            if product:
                remaining = line.quantity - line.delivered_qty
                if remaining > 0:
                    product.reserved_qty -= remaining
                    
    db.commit()
    db.refresh(so)
    return so
