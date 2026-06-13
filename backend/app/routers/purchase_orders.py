from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import PurchaseOrder, PurchaseOrderLine, Product
from backend.app.schemas import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse, PurchaseOrderReceive
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/purchase-orders", tags=["Purchase Orders"])

@router.post("", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    po_in: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    total_amount = 0.0
    lines = []
    
    for line_in in po_in.lines:
        product = db.query(Product).filter(Product.id == line_in.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with ID {line_in.product_id} not found"
            )
        
        total_price = line_in.quantity * line_in.unit_price
        total_amount += total_price
        
        line = PurchaseOrderLine(
            product_id=line_in.product_id,
            quantity=line_in.quantity,
            unit_price=line_in.unit_price,
            total_price=total_price
        )
        lines.append(line)
        
    po = PurchaseOrder(
        vendor_name=po_in.vendor_name,
        status="Draft",
        total_amount=total_amount,
        lines=lines
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return po

@router.get("", response_model=List[PurchaseOrderResponse])
def list_purchase_orders(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(PurchaseOrder).all()

@router.get("/{po_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Order with ID {po_id} not found"
        )
    return po

@router.put("/{po_id}", response_model=PurchaseOrderResponse)
def update_purchase_order(
    po_id: int,
    po_in: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Order with ID {po_id} not found"
        )
    
    if po.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update Purchase Orders in 'Draft' status"
        )
        
    update_data = po_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(po, field, value)
        
    db.commit()
    db.refresh(po)
    return po

@router.delete("/{po_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Order with ID {po_id} not found"
        )
    if po.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete Purchase Orders in 'Draft' status"
        )
    db.delete(po)
    db.commit()
    return None

@router.post("/{po_id}/confirm", response_model=PurchaseOrderResponse)
def confirm_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Order with ID {po_id} not found"
        )
    
    if po.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm Purchase Order in status '{po.status}'"
        )
        
    po.status = "Confirmed"
    db.commit()
    db.refresh(po)
    return po

@router.post("/{po_id}/receive", response_model=PurchaseOrderResponse)
def receive_purchase_order(
    po_id: int,
    po_receive_in: PurchaseOrderReceive = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Order with ID {po_id} not found"
        )
        
    if po.status not in ["Confirmed", "Partially Received"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only receive 'Confirmed' or 'Partially Received' Purchase Orders"
        )
        
    # Build a map of product_id -> quantity to receive
    receive_map = {}
    if po_receive_in and po_receive_in.items is not None:
        for item in po_receive_in.items:
            if item.received_qty < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Received quantity cannot be negative"
                )
            receive_map[item.product_id] = receive_map.get(item.product_id, 0.0) + item.received_qty
            
    # Process each line
    for line in po.lines:
        remaining_qty = line.quantity - line.received_qty
        
        if po_receive_in and po_receive_in.items is not None:
            qty_to_receive = receive_map.get(line.product_id, 0.0)
            if qty_to_receive > remaining_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot receive {qty_to_receive} for product {line.product_id}. Only {remaining_qty} remaining."
                )
        else:
            qty_to_receive = remaining_qty
            
        if qty_to_receive > 0:
            product = db.query(Product).filter(Product.id == line.product_id).first()
            if product:
                product.on_hand_qty += qty_to_receive
            line.received_qty += qty_to_receive
            
    # Update PO status
    all_fully_received = True
    any_received = False
    
    for line in po.lines:
        if line.received_qty < line.quantity:
            all_fully_received = False
        if line.received_qty > 0:
            any_received = True
            
    if all_fully_received:
        po.status = "Fully Received"
    elif any_received:
        po.status = "Partially Received"
        
    db.commit()
    db.refresh(po)
    return po

@router.post("/{po_id}/cancel", response_model=PurchaseOrderResponse)
def cancel_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase Order with ID {po_id} not found"
        )
        
    if po.status in ["Fully Received", "Partially Received"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a received Purchase Order"
        )
    if po.status == "Cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Purchase Order is already cancelled"
        )
        
    po.status = "Cancelled"
    db.commit()
    db.refresh(po)
    return po
