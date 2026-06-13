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
    
    if so.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update Sales Orders in 'Draft' status"
        )
        
    update_data = so_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(so, field, value)
        
    db.commit()
    db.refresh(so)
    return so

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
        
    if so.status != "Confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only deliver 'Confirmed' Sales Orders"
        )
        
    # Check if stock is available
    for line in so.lines:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        if not product or product.on_hand_qty < line.quantity:
            product_sku = product.sku if product else f"ID {line.product_id}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock on hand for product '{product_sku}' to complete delivery."
            )
            
    so.status = "Completed"
    
    # Decrement on hand and reserved stock
    for line in so.lines:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        if product:
            product.on_hand_qty -= line.quantity
            product.reserved_qty -= line.quantity
            
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
        
    if so.status == "Completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a completed Sales Order"
        )
    if so.status == "Cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sales Order is already cancelled"
        )
        
    prev_status = so.status
    so.status = "Cancelled"
    
    # Release reservation if it was confirmed
    if prev_status == "Confirmed":
        for line in so.lines:
            product = db.query(Product).filter(Product.id == line.product_id).first()
            if product:
                product.reserved_qty -= line.quantity
                
    db.commit()
    db.refresh(so)
    return so
