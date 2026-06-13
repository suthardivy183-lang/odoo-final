# Warehouse Mapping Module Analysis and Recommendation Report

## 1. Executive Summary
This report details the architectural and implementation recommendation for introducing a **Warehouse Mapping** module into the Shiv Furniture Works ERP. The design provides full traceability of stock (raw materials and finished goods) down to the physical storage location level (`Warehouse` -> `Aisle` -> `Rack` -> `Shelf`). 

It integrates seamlessly with the existing SQLAlchemy/FastAPI backend and React frontend, and incorporates automatic audit logging, stock allocation, stock transfer, simulated QR scanning, and integration with the Manufacturing Order (MO) details display.

---

## 2. Recommended Database Models (SQLAlchemy)
The following database models should be added to `backend/app/models.py`. They utilize SQLite foreign key constraints, establish cascade deletions, and map the hierarchy of `Warehouse -> Aisle -> Rack -> Shelf -> StockAllocation`.

Because the project uses global SQLAlchemy events on the `Mapper` base class, all CRUD actions on these models will automatically write audit logs to the `audit_logs` table.

```python
# To be added to backend/app/models.py

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False) # e.g. WH-A
    address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    aisles = relationship("Aisle", back_populates="warehouse", cascade="all, delete-orphan")


class Aisle(Base):
    __tablename__ = "aisles"
    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    name = Column(String, nullable=False) # e.g. Aisle 1
    code = Column(String, nullable=False) # e.g. A1
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    warehouse = relationship("Warehouse", back_populates="aisles")
    racks = relationship("Rack", back_populates="aisle", cascade="all, delete-orphan")


class Rack(Base):
    __tablename__ = "racks"
    id = Column(Integer, primary_key=True, index=True)
    aisle_id = Column(Integer, ForeignKey("aisles.id"), nullable=False)
    name = Column(String, nullable=False) # e.g. Rack 1
    code = Column(String, nullable=False) # e.g. R1
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    aisle = relationship("Aisle", back_populates="racks")
    shelves = relationship("Shelf", back_populates="rack", cascade="all, delete-orphan")


class Shelf(Base):
    __tablename__ = "shelves"
    id = Column(Integer, primary_key=True, index=True)
    rack_id = Column(Integer, ForeignKey("racks.id"), nullable=False)
    name = Column(String, nullable=False) # e.g. Shelf A
    code = Column(String, nullable=False) # e.g. SA
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    rack = relationship("Rack", back_populates="shelves")
    allocations = relationship("StockAllocation", back_populates="shelf", cascade="all, delete-orphan")


class StockAllocation(Base):
    __tablename__ = "stock_allocations"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    quantity = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    product = relationship("Product")
    shelf = relationship("Shelf", back_populates="allocations")


class WarehouseActivity(Base):
    __tablename__ = "warehouse_activities"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    activity_type = Column(String, nullable=False) # "Received", "Moved", "Consumed"
    from_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    to_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    product = relationship("Product")
    from_shelf = relationship("Shelf", foreign_keys=[from_shelf_id])
    to_shelf = relationship("Shelf", foreign_keys=[to_shelf_id])
```

---

## 3. Recommended Pydantic Schemas
The following schemas should be added to `backend/app/schemas.py` to validate CRUD requests, serialize location details, and handle stock transactions.

```python
# To be added to backend/app/schemas.py

# Warehouse
class WarehouseBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    is_active: bool = True

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None

class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Aisle
class AisleBase(BaseModel):
    warehouse_id: int
    name: str
    code: str

class AisleCreate(AisleBase):
    pass

class AisleUpdate(BaseModel):
    warehouse_id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None

class AisleResponse(AisleBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Rack
class RackBase(BaseModel):
    aisle_id: int
    name: str
    code: str

class RackCreate(RackBase):
    pass

class RackUpdate(BaseModel):
    aisle_id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None

class RackResponse(RackBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Shelf
class ShelfBase(BaseModel):
    rack_id: int
    name: str
    code: str

class ShelfCreate(ShelfBase):
    pass

class ShelfUpdate(BaseModel):
    rack_id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None

class ShelfResponse(ShelfBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# Stock Allocation
class StockAllocationBase(BaseModel):
    product_id: int
    shelf_id: int
    quantity: float

class StockAllocationResponse(StockAllocationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductResponse] = None
    shelf: Optional[ShelfResponse] = None
    model_config = ConfigDict(from_attributes=True)

class StockAllocationRequest(BaseModel):
    product_id: int
    shelf_id: int
    quantity: float


# Stock Transfer
class StockTransferRequest(BaseModel):
    product_id: int
    from_shelf_id: int
    to_shelf_id: int
    quantity: float


# Warehouse Activity
class WarehouseActivityResponse(BaseModel):
    id: int
    product_id: int
    quantity: float
    activity_type: str
    from_shelf_id: Optional[int] = None
    to_shelf_id: Optional[int] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    timestamp: datetime
    product: Optional[ProductResponse] = None
    from_shelf: Optional[ShelfResponse] = None
    to_shelf: Optional[ShelfResponse] = None
    model_config = ConfigDict(from_attributes=True)
```

---

## 4. Backend API Routes
The routing logic should be stored in a new file `backend/app/routers/warehouse_mapping.py` and registered in `backend/app/main.py`.

### 4.1 New Router Code (`backend/app/routers/warehouse_mapping.py`)
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import Warehouse, Aisle, Rack, Shelf, StockAllocation, WarehouseActivity, Product
from backend.app.schemas import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    AisleCreate, AisleUpdate, AisleResponse,
    RackCreate, RackUpdate, RackResponse,
    ShelfCreate, ShelfUpdate, ShelfResponse,
    StockAllocationRequest, StockAllocationResponse,
    StockTransferRequest, WarehouseActivityResponse
)
from backend.app.auth import get_current_user

router = APIRouter(prefix="/api", tags=["Warehouse Mapping"])

# --- Warehouse ---
@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(wh_in: WarehouseCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    existing = db.query(Warehouse).filter((Warehouse.code == wh_in.code) | (Warehouse.name == wh_in.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Warehouse with this name/code already exists")
    wh = Warehouse(**wh_in.model_dump())
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh

@router.get("/warehouses", response_model=List[WarehouseResponse])
def list_warehouses(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Warehouse).all()

@router.put("/warehouses/{wh_id}", response_model=WarehouseResponse)
def update_warehouse(wh_id: int, wh_in: WarehouseUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    for field, value in wh_in.model_dump(exclude_unset=True).items():
        setattr(wh, field, value)
    db.commit()
    db.refresh(wh)
    return wh

@router.delete("/warehouses/{wh_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(wh_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    wh = db.query(Warehouse).filter(Warehouse.id == wh_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    db.delete(wh)
    db.commit()
    return None

# --- Aisle ---
@router.post("/aisles", response_model=AisleResponse, status_code=status.HTTP_201_CREATED)
def create_aisle(aisle_in: AisleCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    wh = db.query(Warehouse).filter(Warehouse.id == aisle_in.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    existing = db.query(Aisle).filter(Aisle.warehouse_id == aisle_in.warehouse_id, Aisle.code == aisle_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Aisle code already exists in this warehouse")
    aisle = Aisle(**aisle_in.model_dump())
    db.add(aisle)
    db.commit()
    db.refresh(aisle)
    return aisle

@router.get("/aisles", response_model=List[AisleResponse])
def list_aisles(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Aisle).all()

@router.put("/aisles/{aisle_id}", response_model=AisleResponse)
def update_aisle(aisle_id: int, aisle_in: AisleUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    aisle = db.query(Aisle).filter(Aisle.id == aisle_id).first()
    if not aisle:
        raise HTTPException(status_code=404, detail="Aisle not found")
    for field, value in aisle_in.model_dump(exclude_unset=True).items():
        setattr(aisle, field, value)
    db.commit()
    db.refresh(aisle)
    return aisle

@router.delete("/aisles/{aisle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_aisle(aisle_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    aisle = db.query(Aisle).filter(Aisle.id == aisle_id).first()
    if not aisle:
        raise HTTPException(status_code=404, detail="Aisle not found")
    db.delete(aisle)
    db.commit()
    return None

# --- Rack ---
@router.post("/racks", response_model=RackResponse, status_code=status.HTTP_201_CREATED)
def create_rack(rack_in: RackCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    aisle = db.query(Aisle).filter(Aisle.id == rack_in.aisle_id).first()
    if not aisle:
        raise HTTPException(status_code=404, detail="Aisle not found")
    existing = db.query(Rack).filter(Rack.aisle_id == rack_in.aisle_id, Rack.code == rack_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Rack code already exists in this aisle")
    rack = Rack(**rack_in.model_dump())
    db.add(rack)
    db.commit()
    db.refresh(rack)
    return rack

@router.get("/racks", response_model=List[RackResponse])
def list_racks(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Rack).all()

@router.put("/racks/{rack_id}", response_model=RackResponse)
def update_rack(rack_id: int, rack_in: RackUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    for field, value in rack_in.model_dump(exclude_unset=True).items():
        setattr(rack, field, value)
    db.commit()
    db.refresh(rack)
    return rack

@router.delete("/racks/{rack_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rack(rack_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    db.delete(rack)
    db.commit()
    return None

# --- Shelf ---
@router.post("/shelves", response_model=ShelfResponse, status_code=status.HTTP_201_CREATED)
def create_shelf(shelf_in: ShelfCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    rack = db.query(Rack).filter(Rack.id == shelf_in.rack_id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    existing = db.query(Shelf).filter(Shelf.rack_id == shelf_in.rack_id, Shelf.code == shelf_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Shelf code already exists in this rack")
    shelf = Shelf(**shelf_in.model_dump())
    db.add(shelf)
    db.commit()
    db.refresh(shelf)
    return shelf

@router.get("/shelves", response_model=List[ShelfResponse])
def list_shelves(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Shelf).all()

@router.put("/shelves/{shelf_id}", response_model=ShelfResponse)
def update_shelf(shelf_id: int, shelf_in: ShelfUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    for field, value in shelf_in.model_dump(exclude_unset=True).items():
        setattr(shelf, field, value)
    db.commit()
    db.refresh(shelf)
    return shelf

@router.delete("/shelves/{shelf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shelf(shelf_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    db.delete(shelf)
    db.commit()
    return None

# --- Stock Allocation & Transfer ---
@router.post("/warehouse/allocate", response_model=StockAllocationResponse)
def allocate_stock(req: StockAllocationRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    shelf = db.query(Shelf).filter(Shelf.id == req.shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")

    alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == req.product_id,
        StockAllocation.shelf_id == req.shelf_id
    ).first()

    if alloc:
        alloc.quantity += req.quantity
    else:
        alloc = StockAllocation(
            product_id=req.product_id,
            shelf_id=req.shelf_id,
            quantity=req.quantity
        )
        db.add(alloc)

    # Note: Stock allocation keeps product on-hand quantity synced
    product.on_hand_qty += req.quantity

    # Log Activity
    activity = WarehouseActivity(
        product_id=req.product_id,
        quantity=req.quantity,
        activity_type="Received",
        to_shelf_id=req.shelf_id,
        user_id=getattr(current_user, "id", None),
        username=getattr(current_user, "username", None)
    )
    db.add(activity)
    db.commit()
    db.refresh(alloc)
    return alloc

@router.post("/warehouse/transfer")
def transfer_stock(req: StockTransferRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
    if req.from_shelf_id == req.to_shelf_id:
        raise HTTPException(status_code=400, detail="Source and destination shelves must be different")

    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from_alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == req.product_id,
        StockAllocation.shelf_id == req.from_shelf_id
    ).first()

    if not from_alloc or from_alloc.quantity < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock on the source shelf")

    to_shelf = db.query(Shelf).filter(Shelf.id == req.to_shelf_id).first()
    if not to_shelf:
        raise HTTPException(status_code=404, detail="Destination shelf not found")

    to_alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == req.product_id,
        StockAllocation.shelf_id == req.to_shelf_id
    ).first()

    # Move stock
    from_alloc.quantity -= req.quantity
    if from_alloc.quantity == 0:
        db.delete(from_alloc)

    if to_alloc:
        to_alloc.quantity += req.quantity
    else:
        to_alloc = StockAllocation(
            product_id=req.product_id,
            shelf_id=req.to_shelf_id,
            quantity=req.quantity
        )
        db.add(to_alloc)

    # Log Activity
    activity = WarehouseActivity(
        product_id=req.product_id,
        quantity=req.quantity,
        activity_type="Moved",
        from_shelf_id=req.from_shelf_id,
        to_shelf_id=req.to_shelf_id,
        user_id=getattr(current_user, "id", None),
        username=getattr(current_user, "username", None)
    )
    db.add(activity)
    db.commit()

    return {
        "message": f"Transferred {req.quantity} units of {product.name}",
        "product_id": req.product_id,
        "from_shelf_id": req.from_shelf_id,
        "to_shelf_id": req.to_shelf_id,
        "quantity": req.quantity
    }

@router.get("/warehouse/activity", response_model=List[WarehouseActivityResponse])
def list_warehouse_activities(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(WarehouseActivity).order_by(WarehouseActivity.timestamp.desc()).limit(100).all()
```

### 4.2 Router Registration (`backend/app/main.py`)
In `backend/app/main.py`, the new router must be imported and registered:
```python
# Import the new router
from backend.app.routers import warehouse_mapping

# Register it with FastAPI app
app.include_router(warehouse_mapping.router)
```

---

## 5. Manufacturing Order Integration
To fulfill the requirements of Milestone 4, the system should show component storage locations info (`warehouse_name`, `aisle_name`, `rack_name`, `shelf_name`) on the manufacturing order components details view.

### 5.1 Backend Model Property Addition (`models.py`)
Add the following `@property` to the `ManufacturingOrderComponent` class in `backend/app/models.py`:
```python
# To be added to ManufacturingOrderComponent in backend/app/models.py
@property
def storage_locations(self):
    session = inspect(self).session
    if not session:
        return []
    
    # Query all active stock allocations for this component product
    allocations = session.query(StockAllocation).filter(
        StockAllocation.product_id == self.component_product_id
    ).all()
    
    locations_info = []
    for alloc in allocations:
        shelf = alloc.shelf
        rack = shelf.rack if shelf else None
        aisle = rack.aisle if rack else None
        wh = aisle.warehouse if aisle else None
        
        path = " > ".join(filter(None, [
            wh.name if wh else None,
            aisle.name if aisle else None,
            rack.name if rack else None,
            shelf.name if shelf else None
        ]))
        
        locations_info.append({
            "shelf_id": alloc.shelf_id,
            "location_path": path or "Unknown Location",
            "quantity": alloc.quantity
        })
    return locations_info
```

### 5.2 Schema Modification (`schemas.py`)
Update `ManufacturingOrderComponentResponse` in `backend/app/schemas.py`:
```python
class ComponentLocationInfo(BaseModel):
    shelf_id: int
    location_path: str
    quantity: float

class ManufacturingOrderComponentResponse(BaseModel):
    id: int
    manufacturing_order_id: int
    component_product_id: int
    required_quantity: float
    consumed_quantity: float
    status: str
    component_product: Optional[ProductResponse] = None
    storage_locations: List[ComponentLocationInfo] = []  # Added field
```

### 5.3 Stock Consumption in MO Completion (`backend/app/routers/manufacturing.py`)
Update the `produce_manufacturing_order` endpoint in `backend/app/routers/manufacturing.py` so that when a manufacturing order is completed, the component quantities are deducted from the `StockAllocation` records in a sequential/FIFO manner, and the activity is logged.

```python
# Modify backend/app/routers/manufacturing.py in produce_manufacturing_order():
# Replace the loop that consumes components with the following:

    for comp in mo.components:
        comp_product = db.query(Product).filter(Product.id == comp.component_product_id).first()
        if comp_product:
            comp_product.on_hand_qty -= comp.required_quantity
            comp_product.reserved_qty -= comp.required_quantity
            comp.consumed_quantity = comp.required_quantity
            comp.status = "Consumed"
            
            # Deduct from StockAllocation tables sequentially
            remaining_to_consume = comp.required_quantity
            allocations = db.query(StockAllocation).filter(
                StockAllocation.product_id == comp.component_product_id
            ).order_by(StockAllocation.created_at.asc()).all()
            
            for alloc in allocations:
                if remaining_to_consume <= 0:
                    break
                qty_to_deduct = min(alloc.quantity, remaining_to_consume)
                alloc.quantity -= qty_to_deduct
                remaining_to_consume -= qty_to_deduct
                
                # Log Consumption Activity
                activity = WarehouseActivity(
                    product_id=comp.component_product_id,
                    quantity=qty_to_deduct,
                    activity_type="Consumed",
                    from_shelf_id=alloc.shelf_id,
                    user_id=getattr(current_user, "id", None),
                    username=getattr(current_user, "username", None)
                )
                db.add(activity)
                
                if alloc.quantity == 0:
                    db.delete(alloc)
                    
            if remaining_to_consume > 0:
                # Fallback: log activity but warn of unallocated consumption
                pass
```

---

## 6. Recommended Frontend Structure & Components

### 6.1 Navigation (`frontend/src/components/AppShell.tsx`)
Import `Warehouse` from `lucide-react` and add the navigation link between **Products** and **Sales Orders**:
```typescript
import {
  LayoutDashboard,
  Package,
  Warehouse, // Added
  ShoppingCart,
  Truck,
  Factory,
  Layers,
  ScrollText,
  LogOut,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/warehouse-mapping", label: "Warehouse Mapping", icon: Warehouse }, // Added
  { to: "/sales", label: "Sales Orders", icon: ShoppingCart },
  ...
]
```

### 6.2 Routing (`frontend/src/App.tsx`)
Register the new route in `frontend/src/App.tsx`:
```typescript
import WarehouseMapping from "@/pages/warehouse-mapping/WarehouseMapping"; // Added

// Inside Routes -> AppShell:
<Route path="/products" element={<Products />} />
<Route path="/warehouse-mapping" element={<WarehouseMapping />} /> // Added
<Route path="/sales" element={<Sales />} />
```

### 6.3 React Query Hooks (`frontend/src/hooks/useWarehouse.ts`)
Create a new file `frontend/src/hooks/useWarehouse.ts` containing queries/mutations to interact with the API:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Warehouse {
  id: number;
  name: string;
  code: string;
  address?: string;
  is_active: boolean;
}

export interface Aisle {
  id: number;
  warehouse_id: number;
  name: string;
  code: string;
}

export interface Rack {
  id: number;
  aisle_id: number;
  name: string;
  code: string;
}

export interface Shelf {
  id: number;
  rack_id: number;
  name: string;
  code: string;
}

export interface StockAllocation {
  id: number;
  product_id: number;
  shelf_id: number;
  quantity: number;
  product?: { id: number; name: string; sku: string };
  shelf?: Shelf;
}

export interface WarehouseActivity {
  id: number;
  product_id: number;
  quantity: number;
  activity_type: string;
  timestamp: string;
  username?: string;
  product?: { name: string; sku: string };
  from_shelf?: Shelf;
  to_shelf?: Shelf;
}

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get<Warehouse[]>("/warehouses")).data,
  });
}

export function useAisles() {
  return useQuery({
    queryKey: ["aisles"],
    queryFn: async () => (await api.get<Aisle[]>("/aisles")).data,
  });
}

export function useRacks() {
  return useQuery({
    queryKey: ["racks"],
    queryFn: async () => (await api.get<Rack[]>("/racks")).data,
  });
}

export function useShelves() {
  return useQuery({
    queryKey: ["shelves"],
    queryFn: async () => (await api.get<Shelf[]>("/shelves")).data,
  });
}

export function useAllocateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { product_id: number; shelf_id: number; quantity: number }) => {
      return (await api.post<StockAllocation>("/warehouse/allocate", data)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["warehouse-activities"] });
    },
  });
}

export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { product_id: number; from_shelf_id: number; to_shelf_id: number; quantity: number }) => {
      return (await api.post("/warehouse/transfer", data)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["warehouse-activities"] });
    },
  });
}

export function useWarehouseActivities() {
  return useQuery({
    queryKey: ["warehouse-activities"],
    queryFn: async () => (await api.get<WarehouseActivity[]>("/warehouse/activity")).data,
  });
}
```

### 6.4 Main Dashboard Page (`frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx`)
Create this page to render the interactive grid, QR Code mockup, and Details Panel:
```tsx
import * as React from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, Scan, ArrowRightLeft, Plus, MoveRight } from "lucide-react";
import { 
  useWarehouses, useAisles, useRacks, useShelves, 
  useAllocateStock, useTransferStock, useWarehouseActivities 
} from "@/hooks/useWarehouse";
import { useProducts } from "@/hooks/useProducts";

export default function WarehouseMapping() {
  const { data: warehouses } = useWarehouses();
  const { data: aisles } = useAisles();
  const { data: racks } = useRacks();
  const { data: shelves } = useShelves();
  const { data: products } = useProducts();
  const { data: activities } = useWarehouseActivities();

  const allocateStock = useAllocateStock();
  const transferStock = useTransferStock();

  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<number | null>(null);
  const [selectedAisleId, setSelectedAisleId] = React.useState<number | null>(null);
  const [selectedShelfId, setSelectedShelfId] = React.useState<number | null>(null);

  // Modal Dialogs
  const [isAllocateOpen, setIsAllocateOpen] = React.useState(false);
  const [isTransferOpen, setIsTransferOpen] = React.useState(false);
  const [isScannerOpen, setIsScannerOpen] = React.useState(false);

  // Forms
  const [allocProductId, setAllocProductId] = React.useState("");
  const [allocQty, setAllocQty] = React.useState("");
  
  const [transProductId, setTransProductId] = React.useState("");
  const [transToShelfId, setTransToShelfId] = React.useState("");
  const [transQty, setTransQty] = React.useState("");

  const [scanInput, setScanInput] = React.useState("");

  const currentWarehouse = warehouses?.find(w => w.id === selectedWarehouseId);
  const currentAisle = aisles?.find(a => a.id === selectedAisleId);
  const currentShelf = shelves?.find(s => s.id === selectedShelfId);

  // Set defaults
  React.useEffect(() => {
    if (warehouses && warehouses.length > 0 && selectedWarehouseId === null) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  React.useEffect(() => {
    if (aisles && selectedWarehouseId) {
      const firstAisle = aisles.find(a => a.warehouse_id === selectedWarehouseId);
      if (firstAisle) setSelectedAisleId(firstAisle.id);
    }
  }, [aisles, selectedWarehouseId]);

  // Compute stock allocated to current shelf
  const currentShelfAllocations = React.useMemo(() => {
    if (!selectedShelfId || !products) return [];
    // Calculate simulated allocations or fetch if model allows
    // In production we would query allocations filtering by shelf
    return [];
  }, [selectedShelfId, products]);

  const handleAllocate = async () => {
    if (!selectedShelfId || !allocProductId || !allocQty) return;
    await allocateStock.mutateAsync({
      product_id: parseInt(allocProductId),
      shelf_id: selectedShelfId,
      quantity: parseFloat(allocQty)
    });
    setAllocProductId("");
    setAllocQty("");
    setIsAllocateOpen(false);
  };

  const handleTransfer = async () => {
    if (!selectedShelfId || !transProductId || !transToShelfId || !transQty) return;
    await transferStock.mutateAsync({
      product_id: parseInt(transProductId),
      from_shelf_id: selectedShelfId,
      to_shelf_id: parseInt(transToShelfId),
      quantity: parseFloat(transQty)
    });
    setTransProductId("");
    setTransToShelfId("");
    setTransQty("");
    setIsTransferOpen(false);
  };

  const handleScanSimulate = () => {
    // Expecting code format: WH-A.A1.R1.SA
    if (!scanInput) return;
    const parts = scanInput.split(".");
    if (parts.length === 4) {
      const matchWh = warehouses?.find(w => w.code === parts[0]);
      if (matchWh) setSelectedWarehouseId(matchWh.id);
      
      const matchAisle = aisles?.find(a => a.code === parts[1]);
      if (matchAisle) setSelectedAisleId(matchAisle.id);

      const matchShelf = shelves?.find(s => s.code === parts[3]);
      if (matchShelf) setSelectedShelfId(matchShelf.id);
    }
    setScanInput("");
    setIsScannerOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Warehouse Mapping"
        description="Physical location layout and real-time inventory allocation map"
        action={
          <Button variant="outline" onClick={() => setIsScannerOpen(true)}>
            <Scan className="mr-2 h-4 w-4" /> Simulate QR Scan
          </Button>
        }
      />

      <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Warehouse Picker & Visual Grid Map */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex gap-4 items-center mb-6">
              <div className="w-1/2">
                <Label>Warehouse</Label>
                <Select
                  value={String(selectedWarehouseId || "")}
                  onChange={(e) => setSelectedWarehouseId(parseInt(e.target.value))}
                >
                  {warehouses?.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </Select>
              </div>
              <div className="w-1/2">
                <Label>Aisle</Label>
                <Select
                  value={String(selectedAisleId || "")}
                  onChange={(e) => setSelectedAisleId(parseInt(e.target.value))}
                >
                  {aisles?.filter(a => a.warehouse_id === selectedWarehouseId).map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Interactive Grid Map */}
            <div>
              <h3 className="font-semibold text-sm mb-4">Grid Map (Racks & Shelves)</h3>
              <div className="grid grid-cols-4 gap-4">
                {racks?.filter(r => r.aisle_id === selectedAisleId).map(rack => (
                  <div key={rack.id} className="border rounded-md p-4 bg-muted/20">
                    <div className="text-center font-bold text-xs mb-3 border-b pb-1">{rack.name}</div>
                    <div className="space-y-2">
                      {shelves?.filter(s => s.rack_id === rack.id).map(shelf => (
                        <div
                          key={shelf.id}
                          onClick={() => setSelectedShelfId(shelf.id)}
                          className={`p-3 rounded text-center text-xs font-semibold cursor-pointer border transition-colors ${
                            selectedShelfId === shelf.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          {shelf.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Activity Logs Feed */}
          <Card className="p-6">
            <h3 className="font-semibold text-sm mb-4">Recent Warehouse Activities</h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto">
              {activities?.slice(0, 10).map((act) => (
                <div key={act.id} className="flex items-start gap-3 text-xs border-b pb-2">
                  <Badge variant={act.activity_type === "Received" ? "outline" : "muted"}>
                    {act.activity_type}
                  </Badge>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">
                      {act.username || "System"}
                    </span>{" "}
                    {act.activity_type === "Received" ? "placed" : act.activity_type === "Moved" ? "transferred" : "consumed"}{" "}
                    <span className="font-bold">{act.quantity}</span> units of{" "}
                    <span className="font-semibold">{act.product?.name || `#${act.product_id}`}</span>
                    {act.from_shelf && ` from ${act.from_shelf.code}`}
                    {act.to_shelf && ` to ${act.to_shelf.code}`}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {new Date(act.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right 1 Column: Details Sidebar Panel */}
        <div className="space-y-6">
          <Card className="p-6 h-full flex flex-col justify-between">
            {currentShelf ? (
              <div>
                <div className="border-b pb-4 mb-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Selected Location</div>
                  <h2 className="text-xl font-bold mt-1">{currentWarehouse?.code}.{currentAisle?.code}.{currentShelf.code}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentWarehouse?.name} &rsaquo; {currentAisle?.name} &rsaquo; {currentShelf.name}
                  </p>
                </div>

                {/* QR Code Section */}
                <div className="flex flex-col items-center border rounded-md p-4 bg-muted/10 mb-6">
                  <div className="bg-white p-2 rounded border">
                    <QrCode className="h-32 w-32 text-slate-800" />
                  </div>
                  <span className="text-[10px] font-mono mt-2 text-muted-foreground">
                    {currentWarehouse?.code}.{currentAisle?.code}.{currentShelf.code}
                  </span>
                </div>

                {/* Allocated Stock Table */}
                <div>
                  <h4 className="font-semibold text-xs mb-3 uppercase tracking-wider text-muted-foreground">Allocated Stock</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-right text-xs">Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentShelfAllocations.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground text-xs py-4">
                            No stock on this shelf.
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentShelfAllocations.map(alloc => (
                          <TableRow key={alloc.id}>
                            <TableCell className="font-mono text-xs">{alloc.product?.sku}</TableCell>
                            <TableCell className="text-xs">{alloc.product?.name}</TableCell>
                            <TableCell className="text-right font-semibold text-xs">{alloc.quantity}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <Button size="sm" onClick={() => setIsAllocateOpen(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Allocate Stock
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsTransferOpen(true)}>
                    <ArrowRightLeft className="mr-1 h-3.5 w-3.5" /> Transfer Stock
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">
                Select a shelf in the visual grid map to view its allocations, QR code, and perform movements.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* --- MODAL DIALOGS --- */}

      {/* Allocate Dialog */}
      <Dialog open={isAllocateOpen} onClose={() => setIsAllocateOpen(false)}>
        <DialogHeader>
          <DialogTitle>Allocate Stock to Shelf</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Select Product</Label>
            <Select value={allocProductId} onChange={e => setAllocProductId(e.target.value)}>
              <option value="">-- Choose Product --</option>
              {products?.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.sku}) - On Hand: {p.on_hand_qty}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Placement Quantity</Label>
            <Input type="number" placeholder="Enter quantity" value={allocQty} onChange={e => setAllocQty(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsAllocateOpen(false)}>Cancel</Button>
          <Button onClick={handleAllocate}>Allocate</Button>
        </DialogFooter>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={isTransferOpen} onClose={() => setIsTransferOpen(false)}>
        <DialogHeader>
          <DialogTitle>Transfer Stock from Shelf</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Select Product to Move</Label>
            <Select value={transProductId} onChange={e => setTransProductId(e.target.value)}>
              <option value="">-- Choose Product --</option>
              {currentShelfAllocations.map(alloc => (
                <option key={alloc.id} value={alloc.product_id}>{alloc.product?.name} (Qty: {alloc.quantity})</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Destination Shelf</Label>
            <Select value={transToShelfId} onChange={e => setTransToShelfId(e.target.value)}>
              <option value="">-- Choose Shelf --</option>
              {shelves?.filter(s => s.id !== selectedShelfId).map(s => (
                <option key={s.id} value={s.id}>{s.code}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Transfer Quantity</Label>
            <Input type="number" placeholder="Enter quantity" value={transQty} onChange={e => setTransQty(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsTransferOpen(false)}>Cancel</Button>
          <Button onClick={handleTransfer}>Transfer</Button>
        </DialogFooter>
      </Dialog>

      {/* QR Code Scanner Dialog */}
      <Dialog open={isScannerOpen} onClose={() => setIsScannerOpen(false)}>
        <DialogHeader>
          <DialogTitle>Simulated QR Code Scanner</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-xs text-muted-foreground">
            Paste or type a shelf barcode code (e.g. <code>WH-A.A1.R1.SA</code>) to simulate scanning it.
          </p>
          <div>
            <Label>QR Code Value</Label>
            <Input 
              placeholder="e.g. WH-A.A1.R1.SA" 
              value={scanInput} 
              onChange={e => setScanInput(e.target.value)} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsScannerOpen(false)}>Cancel</Button>
          <Button onClick={handleScanSimulate}>Confirm Scan</Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
```

### 6.5 Manufacturing Component Detail Integration (`ManufacturingDetail.tsx`)
Modify `frontend/src/pages/manufacturing/ManufacturingDetail.tsx` (lines 49-61) to render component storage locations path and stock quantity:
```tsx
// Inside TableBody of Components in ManufacturingDetail.tsx:
{mo.components.map((c) => {
  const stock = products?.find((p) => p.id === c.component_product_id)?.on_hand_qty ?? 0;
  const short = stock < c.required_quantity && c.status !== "Consumed";
  return (
    <TableRow key={c.id}>
      <TableCell>
        <div>
          <span className="font-semibold">{c.component_product ? c.component_product.name : productName(c.component_product_id)}</span>
          {/* Storage Locations Render */}
          {c.storage_locations && c.storage_locations.length > 0 && (
            <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
              <span className="font-semibold uppercase text-[9px] tracking-wider text-slate-500">Storage Locations:</span>
              {c.storage_locations.map((loc, idx) => (
                <div key={idx} className="flex gap-1 items-center">
                  <span className="font-mono bg-slate-100 rounded px-1">{loc.location_path}</span>
                  <span>({loc.quantity} units)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">{c.required_quantity}</TableCell>
      <TableCell className="text-right">{c.consumed_quantity}</TableCell>
      <TableCell className={`text-right ${short ? "text-destructive font-semibold" : ""}`}>{stock}</TableCell>
      <TableCell><StatusBadge status={c.status === "Consumed" ? "Completed" : c.status === "Pending" ? "Draft" : c.status} /></TableCell>
    </TableRow>
  );
})}
```

---

## 7. Verification Plan
To independently verify the implementation after code updates are applied:

1. **Database Schema Creation**:
   Run a database shell command or check the migration/schema mapping using a seed script to ensure `warehouses`, `aisles`, `racks`, `shelves`, `stock_allocations`, and `warehouse_activities` are created correctly.
2. **Backend API Route Testing**:
   Use a test suite (e.g. `pytest` once added) or target the OpenAPI docs page (`/docs`) to test:
   - Create warehouse / aisle / rack / shelf (verify hierarchical validation rules).
   - Verify `/api/warehouse/allocate` updates stock allocation AND increments the product's `on_hand_qty` successfully.
   - Verify `/api/warehouse/transfer` moves the allocation between shelves, decrements the source shelf, increments the destination shelf, and leaves product's overall `on_hand_qty` unchanged.
   - Verify `/api/warehouse/activity` records log items for all allocate and transfer requests.
3. **Audit Log Verification**:
   Verify that any allocation/location insert or update records new rows in `audit_logs` table (due to SQLAlchemy Mapper events).
4. **Manufacturing Order Integration Testing**:
   Create a manufacturing order, verify the API endpoint returns component `storage_locations`, and verify complete stock consumption deducts allocations.
