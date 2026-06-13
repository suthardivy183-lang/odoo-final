from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database import get_db
from backend.app.models import Warehouse, Aisle, Rack, Shelf, StockAllocation, WarehouseActivity, Product
from backend.app.schemas import (
    WarehouseCreate, WarehouseResponse,
    AisleCreate, AisleResponse,
    RackCreate, RackResponse,
    ShelfCreate, ShelfResponse,
    StockAllocationResponse, WarehouseActivityResponse,
    AllocateStockPayload, TransferStockPayload
)
from backend.app.auth import get_current_user

router = APIRouter(tags=["Warehouse Mapping"])

def validate_non_empty_fields(payload):
    for field in ["name", "code"]:
        if hasattr(payload, field):
            val = getattr(payload, field)
            if val is not None and isinstance(val, str):
                if not val or val.strip() == "":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"{field.capitalize()} cannot be empty"
                    )

# --- Warehouse CRUD ---

@router.post("/api/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(
    wh_in: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    validate_non_empty_fields(wh_in)
    # Check if name unique
    existing = db.query(Warehouse).filter(Warehouse.name == wh_in.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Warehouse with name '{wh_in.name}' already exists"
        )
    wh = Warehouse(name=wh_in.name, location=wh_in.location)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh

@router.get("/api/warehouses", response_model=List[WarehouseResponse])
def list_warehouses(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(Warehouse).all()

@router.get("/api/warehouses/{wh_id}", response_model=WarehouseResponse)
def get_warehouse(
    wh_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {wh_id} not found"
        )
    return wh

@router.put("/api/warehouses/{wh_id}", response_model=WarehouseResponse)
def update_warehouse(
    wh_id: int,
    wh_in: WarehouseCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    validate_non_empty_fields(wh_in)
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {wh_id} not found"
        )
    # Check name unique if changed
    if wh.name != wh_in.name:
        existing = db.query(Warehouse).filter(Warehouse.name == wh_in.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Warehouse with name '{wh_in.name}' already exists"
            )
    wh.name = wh_in.name
    wh.location = wh_in.location
    db.commit()
    db.refresh(wh)
    return wh

@router.delete("/api/warehouses/{wh_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(
    wh_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {wh_id} not found"
        )
    # Check for active stock allocations
    active_alloc = db.query(StockAllocation).join(Shelf).join(Rack).join(Aisle).filter(
        Aisle.warehouse_id == wh_id,
        StockAllocation.quantity > 0
    ).first()
    if active_alloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location containing active stock allocations. Transfer or consume stock first."
        )
    db.delete(wh)
    db.commit()
    return None


# --- Aisle CRUD ---

@router.post("/api/aisles", response_model=AisleResponse, status_code=status.HTTP_201_CREATED)
def create_aisle(
    aisle_in: AisleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    validate_non_empty_fields(aisle_in)
    # Verify warehouse exists
    wh = db.query(Warehouse).filter(Warehouse.id == aisle_in.warehouse_id).first()
    if not wh:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Warehouse with ID {aisle_in.warehouse_id} not found"
        )
    aisle = Aisle(warehouse_id=aisle_in.warehouse_id, name=aisle_in.name)
    db.add(aisle)
    db.commit()
    db.refresh(aisle)
    return aisle

@router.get("/api/aisles", response_model=List[AisleResponse])
def list_aisles(
    warehouse_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Aisle)
    if warehouse_id is not None:
        query = query.filter(Aisle.warehouse_id == warehouse_id)
    return query.all()

@router.get("/api/aisles/{aisle_id}", response_model=AisleResponse)
def get_aisle(
    aisle_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    aisle = db.query(Aisle).filter(Aisle.id == aisle_id).first()
    if not aisle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aisle with ID {aisle_id} not found"
        )
    return aisle

@router.put("/api/aisles/{aisle_id}", response_model=AisleResponse)
def update_aisle(
    aisle_id: int,
    aisle_in: AisleCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    validate_non_empty_fields(aisle_in)
    aisle = db.query(Aisle).filter(Aisle.id == aisle_id).first()
    if not aisle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aisle with ID {aisle_id} not found"
        )
    # Verify warehouse exists if changed
    if aisle.warehouse_id != aisle_in.warehouse_id:
        wh = db.query(Warehouse).filter(Warehouse.id == aisle_in.warehouse_id).first()
        if not wh:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Warehouse with ID {aisle_in.warehouse_id} not found"
            )
    aisle.warehouse_id = aisle_in.warehouse_id
    aisle.name = aisle_in.name
    db.commit()
    db.refresh(aisle)
    return aisle

@router.delete("/api/aisles/{aisle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_aisle(
    aisle_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    aisle = db.query(Aisle).filter(Aisle.id == aisle_id).first()
    if not aisle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aisle with ID {aisle_id} not found"
        )
    # Check for active stock allocations
    active_alloc = db.query(StockAllocation).join(Shelf).join(Rack).filter(
        Rack.aisle_id == aisle_id,
        StockAllocation.quantity > 0
    ).first()
    if active_alloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location containing active stock allocations. Transfer or consume stock first."
        )
    db.delete(aisle)
    db.commit()
    return None


# --- Rack CRUD ---

@router.post("/api/racks", response_model=RackResponse, status_code=status.HTTP_201_CREATED)
def create_rack(
    rack_in: RackCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    validate_non_empty_fields(rack_in)
    # Verify aisle exists
    aisle = db.query(Aisle).filter(Aisle.id == rack_in.aisle_id).first()
    if not aisle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Aisle with ID {rack_in.aisle_id} not found"
        )
    rack = Rack(aisle_id=rack_in.aisle_id, name=rack_in.name)
    db.add(rack)
    db.commit()
    db.refresh(rack)
    return rack

@router.get("/api/racks", response_model=List[RackResponse])
def list_racks(
    aisle_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Rack)
    if aisle_id is not None:
        query = query.filter(Rack.aisle_id == aisle_id)
    return query.all()

@router.get("/api/racks/{rack_id}", response_model=RackResponse)
def get_rack(
    rack_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rack with ID {rack_id} not found"
        )
    return rack

@router.put("/api/racks/{rack_id}", response_model=RackResponse)
def update_rack(
    rack_id: int,
    rack_in: RackCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    validate_non_empty_fields(rack_in)
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rack with ID {rack_id} not found"
        )
    if rack.aisle_id != rack_in.aisle_id:
        aisle = db.query(Aisle).filter(Aisle.id == rack_in.aisle_id).first()
        if not aisle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Aisle with ID {rack_in.aisle_id} not found"
            )
    rack.aisle_id = rack_in.aisle_id
    rack.name = rack_in.name
    db.commit()
    db.refresh(rack)
    return rack

@router.delete("/api/racks/{rack_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rack(
    rack_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rack with ID {rack_id} not found"
        )
    # Check for active stock allocations
    active_alloc = db.query(StockAllocation).join(Shelf).filter(
        Shelf.rack_id == rack_id,
        StockAllocation.quantity > 0
    ).first()
    if active_alloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location containing active stock allocations. Transfer or consume stock first."
        )
    db.delete(rack)
    db.commit()
    return None


# --- Shelf CRUD ---

@router.post("/api/shelves", response_model=ShelfResponse, status_code=status.HTTP_201_CREATED)
def create_shelf(
    shelf_in: ShelfCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    validate_non_empty_fields(shelf_in)
    # Verify rack exists
    rack = db.query(Rack).filter(Rack.id == shelf_in.rack_id).first()
    if not rack:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rack with ID {shelf_in.rack_id} not found"
        )
    shelf = Shelf(rack_id=shelf_in.rack_id, name=shelf_in.name)
    db.add(shelf)
    db.commit()
    db.refresh(shelf)
    return shelf

@router.get("/api/shelves", response_model=List[ShelfResponse])
def list_shelves(
    rack_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(Shelf)
    if rack_id is not None:
        query = query.filter(Shelf.rack_id == rack_id)
    return query.all()

@router.get("/api/shelves/{shelf_id}", response_model=ShelfResponse)
def get_shelf(
    shelf_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shelf with ID {shelf_id} not found"
        )
    return shelf

@router.put("/api/shelves/{shelf_id}", response_model=ShelfResponse)
def update_shelf(
    shelf_id: int,
    shelf_in: ShelfCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    validate_non_empty_fields(shelf_in)
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shelf with ID {shelf_id} not found"
        )
    if shelf.rack_id != shelf_in.rack_id:
        rack = db.query(Rack).filter(Rack.id == shelf_in.rack_id).first()
        if not rack:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Rack with ID {shelf_in.rack_id} not found"
            )
    shelf.rack_id = shelf_in.rack_id
    shelf.name = shelf_in.name
    db.commit()
    db.refresh(shelf)
    return shelf

@router.delete("/api/shelves/{shelf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shelf(
    shelf_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shelf with ID {shelf_id} not found"
        )
    # Check for active stock allocations
    active_alloc = db.query(StockAllocation).filter(
        StockAllocation.shelf_id == shelf_id,
        StockAllocation.quantity > 0
    ).first()
    if active_alloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete location containing active stock allocations. Transfer or consume stock first."
        )
    db.delete(shelf)
    db.commit()
    return None


# --- Stock Allocation and Transfer ---

@router.post("/api/warehouse/allocate", response_model=StockAllocationResponse)
def allocate_stock(
    payload: AllocateStockPayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Verify product
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {payload.product_id} not found"
        )
    # Verify shelf
    shelf = db.query(Shelf).filter(Shelf.id == payload.shelf_id).first()
    if not shelf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shelf with ID {payload.shelf_id} not found"
        )

    # Upsert stock allocation
    alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == payload.product_id,
        StockAllocation.shelf_id == payload.shelf_id
    ).first()

    if alloc:
        alloc.quantity += payload.quantity
    else:
        alloc = StockAllocation(
            product_id=payload.product_id,
            shelf_id=payload.shelf_id,
            quantity=payload.quantity
        )
        db.add(alloc)

    # Add to product on-hand qty
    product.on_hand_qty += payload.quantity

    # Log activity
    activity = WarehouseActivity(
        product_id=payload.product_id,
        activity_type="Allocated",
        quantity=payload.quantity,
        target_shelf_id=payload.shelf_id
    )
    db.add(activity)

    db.commit()
    db.refresh(alloc)
    return alloc

@router.post("/api/warehouse/transfer", status_code=status.HTTP_200_OK)
def transfer_stock(
    payload: TransferStockPayload,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if payload.source_shelf_id == payload.target_shelf_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Source and target shelves must be different"
        )
    # Verify product
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {payload.product_id} not found"
        )
    # Verify source shelf
    source_shelf = db.query(Shelf).filter(Shelf.id == payload.source_shelf_id).first()
    if not source_shelf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source Shelf with ID {payload.source_shelf_id} not found"
        )
    # Verify target shelf
    target_shelf = db.query(Shelf).filter(Shelf.id == payload.target_shelf_id).first()
    if not target_shelf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target Shelf with ID {payload.target_shelf_id} not found"
        )

    # Find source allocation
    src_alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == payload.product_id,
        StockAllocation.shelf_id == payload.source_shelf_id
    ).first()

    if not src_alloc or src_alloc.quantity < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock in source shelf allocation"
        )

    # Deduct from source
    src_alloc.quantity -= payload.quantity
    if src_alloc.quantity <= 0:
        db.delete(src_alloc)

    # Upsert target allocation
    tgt_alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == payload.product_id,
        StockAllocation.shelf_id == payload.target_shelf_id
    ).first()

    if tgt_alloc:
        tgt_alloc.quantity += payload.quantity
    else:
        tgt_alloc = StockAllocation(
            product_id=payload.product_id,
            shelf_id=payload.target_shelf_id,
            quantity=payload.quantity
        )
        db.add(tgt_alloc)

    # Log activity
    activity = WarehouseActivity(
        product_id=payload.product_id,
        activity_type="Transferred",
        quantity=payload.quantity,
        source_shelf_id=payload.source_shelf_id,
        target_shelf_id=payload.target_shelf_id
    )
    db.add(activity)

    db.commit()
    return {"message": "Stock transferred successfully"}

@router.get("/api/warehouse/activity", response_model=List[WarehouseActivityResponse])
def get_warehouse_activities(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return db.query(WarehouseActivity).order_by(WarehouseActivity.timestamp.desc()).all()


@router.get("/api/warehouse/allocations", response_model=List[StockAllocationResponse])
def get_stock_allocations(
    shelf_id: Optional[int] = None,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    query = db.query(StockAllocation)
    if shelf_id is not None:
        query = query.filter(StockAllocation.shelf_id == shelf_id)
    if product_id is not None:
        query = query.filter(StockAllocation.product_id == product_id)
    return query.all()
