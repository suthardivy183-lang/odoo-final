from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import BoM, BoMComponent, BoMOperation, Product
from backend.app.schemas import BoMCreate, BoMUpdate, BoMResponse
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api/boms", tags=["Bills of Materials"])

@router.post("", response_model=BoMResponse, status_code=status.HTTP_201_CREATED)
def create_bom(
    bom_in: BoMCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Check if product exists
    product = db.query(Product).filter(Product.id == bom_in.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {bom_in.product_id} not found"
        )
    
    # Check if product already has a BoM
    existing = db.query(BoM).filter(BoM.product_id == bom_in.product_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with ID {bom_in.product_id} already has a BoM"
        )

    # Create BoM
    bom = BoM(
        product_id=bom_in.product_id,
        name=bom_in.name,
        description=bom_in.description
    )
    db.add(bom)
    db.flush()  # Populate bom.id

    # Create components
    for comp_in in bom_in.components:
        comp_prod = db.query(Product).filter(Product.id == comp_in.component_product_id).first()
        if not comp_prod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Component product with ID {comp_in.component_product_id} not found"
            )
        
        comp = BoMComponent(
            bom_id=bom.id,
            component_product_id=comp_in.component_product_id,
            quantity=comp_in.quantity
        )
        db.add(comp)

    # Create operations
    for op_in in bom_in.operations:
        op = BoMOperation(
            bom_id=bom.id,
            sequence=op_in.sequence,
            operation_name=op_in.operation_name,
            work_center=op_in.work_center,
            standard_time_minutes=op_in.standard_time_minutes
        )
        db.add(op)

    db.commit()
    db.refresh(bom)
    
    # Update product.bom_id to link back
    product.bom_id = bom.id
    db.commit()
    db.refresh(bom)
    
    return bom

@router.get("", response_model=List[BoMResponse])
def list_boms(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(BoM).all()

@router.get("/{bom_id}", response_model=BoMResponse)
def get_bom(
    bom_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    bom = db.query(BoM).filter(BoM.id == bom_id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BoM with ID {bom_id} not found"
        )
    return bom

@router.put("/{bom_id}", response_model=BoMResponse)
def update_bom(
    bom_id: int,
    bom_in: BoMUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    bom = db.query(BoM).filter(BoM.id == bom_id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BoM with ID {bom_id} not found"
        )
        
    update_data = bom_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bom, field, value)
        
    db.commit()
    db.refresh(bom)
    return bom

@router.delete("/{bom_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bom(
    bom_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    bom = db.query(BoM).filter(BoM.id == bom_id).first()
    if not bom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BoM with ID {bom_id} not found"
        )
    
    # Unlink from product if needed
    product = db.query(Product).filter(Product.bom_id == bom.id).first()
    if product:
        product.bom_id = None
        db.flush()
        
    db.delete(bom)
    db.commit()
    return None
