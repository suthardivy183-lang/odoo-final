from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from backend.app.database import get_db
from backend.app.models import ManufacturingOrder, ManufacturingOrderComponent, ManufacturingOrderOperation, Product, BoM, StockAllocation, WarehouseActivity
from backend.app.schemas import ManufacturingOrderCreate, ManufacturingOrderUpdate, ManufacturingOrderResponse, ComponentStorageLocation
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/manufacturing", tags=["Manufacturing Orders"])

@router.post("", response_model=ManufacturingOrderResponse, status_code=status.HTTP_201_CREATED)
def create_manufacturing_order(
    mo_in: ManufacturingOrderCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == mo_in.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {mo_in.product_id} not found"
        )
        
    bom = db.query(BoM).filter(BoM.id == mo_in.bom_id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BoM with ID {mo_in.bom_id} not found"
        )
        
    if bom.product_id != product.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The specified BoM does not belong to the specified product"
        )

    mo = ManufacturingOrder(
        product_id=mo_in.product_id,
        bom_id=mo_in.bom_id,
        quantity=mo_in.quantity,
        status="Draft"
    )
    db.add(mo)
    db.flush()

    # Copy BoM components
    for comp in bom.components:
        req_qty = comp.quantity * mo_in.quantity
        mo_comp = ManufacturingOrderComponent(
            manufacturing_order_id=mo.id,
            component_product_id=comp.component_product_id,
            required_quantity=req_qty,
            consumed_quantity=0.0,
            status="Pending"
        )
        db.add(mo_comp)

    # Copy BoM operations
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

    db.commit()
    db.refresh(mo)
    return mo

@router.get("", response_model=List[ManufacturingOrderResponse])
def list_manufacturing_orders(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(ManufacturingOrder).all()

@router.get("/{mo_id}", response_model=ManufacturingOrderResponse)
def get_manufacturing_order(
    mo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    mo = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == mo_id).first()
    if not mo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturing Order with ID {mo_id} not found"
        )
    # Attach component storage locations
    for comp in mo.components:
        allocations = db.query(StockAllocation).filter(
            StockAllocation.product_id == comp.component_product_id
        ).all()
        locs = []
        for alloc in allocations:
            shelf = alloc.shelf
            rack = shelf.rack if shelf else None
            aisle = rack.aisle if rack else None
            warehouse = aisle.warehouse if aisle else None
            locs.append(ComponentStorageLocation(
                shelf_id=alloc.shelf_id,
                shelf_name=shelf.name if shelf else "",
                quantity=alloc.quantity,
                warehouse_name=warehouse.name if warehouse else "",
                aisle_name=aisle.name if aisle else "",
                rack_name=rack.name if rack else ""
            ))
        comp.storage_locations = locs
    return mo

@router.put("/{mo_id}", response_model=ManufacturingOrderResponse)
def update_manufacturing_order(
    mo_id: int,
    mo_in: ManufacturingOrderUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    mo = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == mo_id).first()
    if not mo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturing Order with ID {mo_id} not found"
        )
    
    if mo.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only update Manufacturing Orders in 'Draft' status"
        )
        
    update_data = mo_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(mo, field, value)
        
    db.commit()
    db.refresh(mo)
    return mo

@router.delete("/{mo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_manufacturing_order(
    mo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    mo = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == mo_id).first()
    if not mo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturing Order with ID {mo_id} not found"
        )
    if mo.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only delete Manufacturing Orders in 'Draft' status"
        )
    db.delete(mo)
    db.commit()
    return None

@router.post("/{mo_id}/confirm", response_model=ManufacturingOrderResponse)
def confirm_manufacturing_order(
    mo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    mo = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == mo_id).first()
    if not mo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturing Order with ID {mo_id} not found"
        )
        
    if mo.status != "Draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm Manufacturing Order in status '{mo.status}'"
        )
        
    mo.status = "Planned"
    
    # Reserve component stock
    for comp in mo.components:
        comp_product = db.query(Product).filter(Product.id == comp.component_product_id).first()
        if comp_product:
            comp_product.reserved_qty += comp.required_quantity
            
    db.commit()
    db.refresh(mo)
    return mo

@router.post("/{mo_id}/start", response_model=ManufacturingOrderResponse)
def start_manufacturing_order(
    mo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    mo = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == mo_id).first()
    if not mo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturing Order with ID {mo_id} not found"
        )
        
    if mo.status != "Planned":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only start 'Planned' Manufacturing Orders"
        )
        
    mo.status = "In Progress"
    mo.start_date = datetime.utcnow()
    
    for op in mo.operations:
        op.status = "In Progress"
        
    db.commit()
    db.refresh(mo)
    return mo

@router.post("/{mo_id}/produce", response_model=ManufacturingOrderResponse)
def produce_manufacturing_order(
    mo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    mo = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == mo_id).first()
    if not mo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturing Order with ID {mo_id} not found"
        )
        
    if mo.status != "In Progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only complete 'In Progress' Manufacturing Orders"
        )
        
    # Check if stock of components is available on hand
    for comp in mo.components:
        comp_product = db.query(Product).filter(Product.id == comp.component_product_id).first()
        if not comp_product or comp_product.on_hand_qty < comp.required_quantity:
            prod_sku = comp_product.sku if comp_product else f"ID {comp.component_product_id}"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient stock on hand for raw material '{prod_sku}' to complete manufacturing."
            )
            
    mo.status = "Completed"
    mo.end_date = datetime.utcnow()
    
    # Consume components and release reservations
    for comp in mo.components:
        comp_product = db.query(Product).filter(Product.id == comp.component_product_id).first()
        if comp_product:
            comp_product.on_hand_qty -= comp.required_quantity
            comp_product.reserved_qty -= comp.required_quantity
            comp.consumed_quantity = comp.required_quantity
            comp.status = "Consumed"

            # Deduct from StockAllocation sequentially and log activities
            remaining_to_deduct = comp.required_quantity
            allocations = db.query(StockAllocation).filter(
                StockAllocation.product_id == comp.component_product_id
            ).order_by(StockAllocation.created_at.asc()).all()

            for alloc in allocations:
                if remaining_to_deduct <= 0:
                    break
                if alloc.quantity <= remaining_to_deduct:
                    deducted = alloc.quantity
                    remaining_to_deduct -= deducted
                    activity = WarehouseActivity(
                        product_id=comp.component_product_id,
                        activity_type="Consumed",
                        quantity=deducted,
                        source_shelf_id=alloc.shelf_id
                    )
                    db.add(activity)
                    db.delete(alloc)
                else:
                    deducted = remaining_to_deduct
                    alloc.quantity -= deducted
                    remaining_to_deduct = 0.0
                    activity = WarehouseActivity(
                        product_id=comp.component_product_id,
                        activity_type="Consumed",
                        quantity=deducted,
                        source_shelf_id=alloc.shelf_id
                    )
                    db.add(activity)

            if remaining_to_deduct > 0:
                activity = WarehouseActivity(
                    product_id=comp.component_product_id,
                    activity_type="Consumed",
                    quantity=remaining_to_deduct,
                    source_shelf_id=None
                )
                db.add(activity)
            
    # Produce finished good
    fg_product = db.query(Product).filter(Product.id == mo.product_id).first()
    if fg_product:
        fg_product.on_hand_qty += mo.quantity
        
    # Update operations to completed
    for op in mo.operations:
        op.status = "Completed"
        op.actual_time_minutes = op.standard_time_minutes
        
    db.commit()
    db.refresh(mo)
    return mo

@router.post("/{mo_id}/cancel", response_model=ManufacturingOrderResponse)
def cancel_manufacturing_order(
    mo_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    mo = db.query(ManufacturingOrder).filter(ManufacturingOrder.id == mo_id).first()
    if not mo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Manufacturing Order with ID {mo_id} not found"
        )
        
    if mo.status == "Completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a completed Manufacturing Order"
        )
    if mo.status == "Cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Manufacturing Order is already cancelled"
        )
        
    prev_status = mo.status
    mo.status = "Cancelled"
    
    # Release component reservations if it was Planned or In Progress
    if prev_status in ["Planned", "In Progress"]:
        for comp in mo.components:
            comp_product = db.query(Product).filter(Product.id == comp.component_product_id).first()
            if comp_product:
                comp_product.reserved_qty -= comp.required_quantity
                
    db.commit()
    db.refresh(mo)
    return mo
