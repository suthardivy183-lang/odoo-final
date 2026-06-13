# Technical Design & Analysis Report: Warehouse Mapping Module
**Project**: Shiv Furniture Works ERP  
**Module**: Warehouse Mapping (Milestones 1–7)  
**Status**: Recommendation / Read-Only Analysis

---

## 1. Executive Summary
The Warehouse Mapping module enables structured physical mapping of the Shiv Furniture Works warehouse. It implements a hierarchical location model (`Warehouse -> Aisle -> Rack -> Shelf`), tracks product quantities residing on specific shelves via `StockAllocation`, logs movements using `WarehouseActivity`, and integrates with the Manufacturing Order (MO) system to show production teams exactly where to retrieve components. 

All recommendations in this report strictly adhere to the existing design patterns (FastAPI + SQLAlchemy + Pydantic on the backend, and React + Tailwind CSS + Lucide Icons + React Query on the frontend).

---

## 2. Database Models (`backend/app/models.py`)

To implement the hierarchical storage layout, we define six new SQLAlchemy models. These will be added to `backend/app/models.py`.

```python
# ==============================================================================
# WAREHOUSE MAPPING MODULE MODELS
# ==============================================================================

class Warehouse(Base):
    __tablename__ = "warehouses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False)  # e.g., 'WH-01'
    description = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    aisles = relationship("Aisle", back_populates="warehouse", cascade="all, delete-orphan")


class Aisle(Base):
    __tablename__ = "aisles"
    
    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, index=True, nullable=False)  # e.g., 'A1'
    description = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    warehouse = relationship("Warehouse", back_populates="aisles")
    racks = relationship("Rack", back_populates="aisle", cascade="all, delete-orphan")


class Rack(Base):
    __tablename__ = "racks"
    
    id = Column(Integer, primary_key=True, index=True)
    aisle_id = Column(Integer, ForeignKey("aisles.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, index=True, nullable=False)  # e.g., 'R1'
    description = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    aisle = relationship("Aisle", back_populates="racks")
    shelves = relationship("Shelf", back_populates="rack", cascade="all, delete-orphan")


class Shelf(Base):
    __tablename__ = "shelves"
    
    id = Column(Integer, primary_key=True, index=True)
    rack_id = Column(Integer, ForeignKey("racks.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, index=True, nullable=False)  # e.g., 'S1'
    description = Column(String, nullable=True)
    
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
    product = relationship("Product", back_populates="allocations")
    shelf = relationship("Shelf", back_populates="allocations")

    # Add Unique Constraint so a product has exactly one allocation record per shelf
    __table_args__ = (
        UniqueConstraint("product_id", "shelf_id", name="uq_product_shelf_allocation"),
    )


class WarehouseActivity(Base):
    __tablename__ = "warehouse_activities"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String, nullable=True)
    activity_type = Column(String, nullable=False)  # "Allocated", "Moved", "Consumed", "Received"
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    from_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    to_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    product = relationship("Product")
    from_shelf = relationship("Shelf", foreign_keys=[from_shelf_id])
    to_shelf = relationship("Shelf", foreign_keys=[to_shelf_id])
```

### Updates to Existing Models
In `Product` model class, add the inverse relationship:
```python
    allocations = relationship("StockAllocation", back_populates="product", cascade="all, delete-orphan")
```

---

## 3. Pydantic Schemas (`backend/app/schemas.py`)

Add the following schemas to `backend/app/schemas.py` to structure the API payloads and responses.

```python
# ==============================================================================
# WAREHOUSE MAPPING MODULE SCHEMAS
# ==============================================================================

# Location CRUD
class WarehouseBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AisleBase(BaseModel):
    warehouse_id: int
    name: str
    code: str
    description: Optional[str] = None

class AisleCreate(AisleBase):
    pass

class AisleUpdate(BaseModel):
    warehouse_id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

class AisleResponse(AisleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RackBase(BaseModel):
    aisle_id: int
    name: str
    code: str
    description: Optional[str] = None

class RackCreate(RackBase):
    pass

class RackUpdate(BaseModel):
    aisle_id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

class RackResponse(RackBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShelfBase(BaseModel):
    rack_id: int
    name: str
    code: str
    description: Optional[str] = None

class ShelfCreate(ShelfBase):
    pass

class ShelfUpdate(BaseModel):
    rack_id: Optional[int] = None
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None

class ShelfResponse(ShelfBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Stock Allocation & Transfer
class StockAllocationBase(BaseModel):
    product_id: int
    shelf_id: int
    quantity: float

class StockAllocationCreate(StockAllocationBase):
    pass

class StockAllocationResponse(StockAllocationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    location_path: Optional[str] = None  # Formatted path (e.g. WH-01 / A1 / R1 / S1)
    product_sku: Optional[str] = None
    product_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StockTransferRequest(BaseModel):
    product_id: int
    from_shelf_id: int
    to_shelf_id: int
    quantity: float


class WarehouseActivityResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    activity_type: str  # Allocated, Moved, Consumed, Received
    product_id: int
    product_sku: Optional[str] = None
    product_name: Optional[str] = None
    quantity: float
    from_shelf_id: Optional[int] = None
    from_shelf_path: Optional[str] = None
    to_shelf_id: Optional[int] = None
    to_shelf_path: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


# Manufacturing Order Integration Schema Updates
class ComponentStorageLocation(BaseModel):
    warehouse_name: str
    warehouse_code: str
    aisle_name: str
    aisle_code: str
    rack_name: str
    rack_code: str
    shelf_name: str
    shelf_code: str
    quantity: float
```

### Updates to Existing Schemas
Update `ManufacturingOrderComponentResponse` to include the storage locations:
```python
class ManufacturingOrderComponentResponse(BaseModel):
    id: int
    manufacturing_order_id: int
    component_product_id: int
    required_quantity: float
    consumed_quantity: float
    status: str
    component_product: Optional[ProductResponse] = None
    # NEW: Storage locations list showing where component product is allocated
    storage_locations: List[ComponentStorageLocation] = []

    model_config = ConfigDict(from_attributes=True)
```

---

## 4. Backend Routers

### New Router: `backend/app/routers/warehouse_mapping.py`
Create this file and implement the routers for Location CRUD and Stock Allocation/Transfer.

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.app.database import get_db
from backend.app.models import Warehouse, Aisle, Rack, Shelf, StockAllocation, WarehouseActivity, Product
from backend.app.schemas import (
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    AisleCreate, AisleUpdate, AisleResponse,
    RackCreate, RackUpdate, RackResponse,
    ShelfCreate, ShelfUpdate, ShelfResponse,
    StockAllocationCreate, StockAllocationResponse,
    StockTransferRequest, WarehouseActivityResponse
)
from backend.app.auth import get_current_user
from backend.app.utils.context import current_user_id, current_username

router = APIRouter(prefix="/api", tags=["Warehouse Mapping"])

# Helper function to construct full location path
def get_shelf_path(shelf: Shelf) -> str:
    rack = shelf.rack
    aisle = rack.aisle
    wh = aisle.warehouse
    return f"{wh.code} / {aisle.code} / {rack.code} / {shelf.code}"

# --- WAREHOUSE ENDPOINTS ---
@router.get("/warehouses", response_model=List[WarehouseResponse])
def get_warehouses(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Warehouse).all()

@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(wh_in: WarehouseCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    existing = db.query(Warehouse).filter(Warehouse.code == wh_in.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Warehouse code already exists")
    wh = Warehouse(**wh_in.model_dump())
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh

@router.put("/warehouses/{id}", response_model=WarehouseResponse)
def update_warehouse(id: int, wh_in: WarehouseUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    wh = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    for k, v in wh_in.model_dump(exclude_unset=True).items():
        setattr(wh, k, v)
    db.commit()
    db.refresh(wh)
    return wh

@router.delete("/warehouses/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse(id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    wh = db.query(Warehouse).filter(Warehouse.id == id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    db.delete(wh)
    db.commit()
    return None

# --- AISLE ENDPOINTS ---
@router.get("/aisles", response_model=List[AisleResponse])
def get_aisles(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Aisle).all()

@router.post("/aisles", response_model=AisleResponse, status_code=status.HTTP_201_CREATED)
def create_aisle(aisle_in: AisleCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    wh = db.query(Warehouse).filter(Warehouse.id == aisle_in.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    aisle = Aisle(**aisle_in.model_dump())
    db.add(aisle)
    db.commit()
    db.refresh(aisle)
    return aisle

@router.put("/aisles/{id}", response_model=AisleResponse)
def update_aisle(id: int, aisle_in: AisleUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    aisle = db.query(Aisle).filter(Aisle.id == id).first()
    if not aisle:
        raise HTTPException(status_code=404, detail="Aisle not found")
    for k, v in aisle_in.model_dump(exclude_unset=True).items():
        setattr(aisle, k, v)
    db.commit()
    db.refresh(aisle)
    return aisle

@router.delete("/aisles/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_aisle(id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    aisle = db.query(Aisle).filter(Aisle.id == id).first()
    if not aisle:
        raise HTTPException(status_code=404, detail="Aisle not found")
    db.delete(aisle)
    db.commit()
    return None

# --- RACK ENDPOINTS ---
@router.get("/racks", response_model=List[RackResponse])
def get_racks(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Rack).all()

@router.post("/racks", response_model=RackResponse, status_code=status.HTTP_201_CREATED)
def create_rack(rack_in: RackCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    aisle = db.query(Aisle).filter(Aisle.id == rack_in.aisle_id).first()
    if not aisle:
        raise HTTPException(status_code=404, detail="Aisle not found")
    rack = Rack(**rack_in.model_dump())
    db.add(rack)
    db.commit()
    db.refresh(rack)
    return rack

@router.put("/racks/{id}", response_model=RackResponse)
def update_rack(id: int, rack_in: RackUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    rack = db.query(Rack).filter(Rack.id == id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    for k, v in rack_in.model_dump(exclude_unset=True).items():
        setattr(rack, k, v)
    db.commit()
    db.refresh(rack)
    return rack

@router.delete("/racks/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rack(id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    rack = db.query(Rack).filter(Rack.id == id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    db.delete(rack)
    db.commit()
    return None

# --- SHELF ENDPOINTS ---
@router.get("/shelves", response_model=List[ShelfResponse])
def get_shelves(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Shelf).all()

@router.post("/shelves", response_model=ShelfResponse, status_code=status.HTTP_201_CREATED)
def create_shelf(shelf_in: ShelfCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    rack = db.query(Rack).filter(Rack.id == shelf_in.rack_id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    shelf = Shelf(**shelf_in.model_dump())
    db.add(shelf)
    db.commit()
    db.refresh(shelf)
    return shelf

@router.put("/shelves/{id}", response_model=ShelfResponse)
def update_shelf(id: int, shelf_in: ShelfUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    shelf = db.query(Shelf).filter(Shelf.id == id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    for k, v in shelf_in.model_dump(exclude_unset=True).items():
        setattr(shelf, k, v)
    db.commit()
    db.refresh(shelf)
    return shelf

@router.delete("/shelves/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shelf(id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    shelf = db.query(Shelf).filter(Shelf.id == id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    db.delete(shelf)
    db.commit()
    return None

# --- ALLOCATE STOCK ---
@router.post("/warehouse/allocate", response_model=StockAllocationResponse)
def allocate_stock(alloc_in: StockAllocationCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Verify product and shelf exist
    prod = db.query(Product).filter(Product.id == alloc_in.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    shelf = db.query(Shelf).filter(Shelf.id == alloc_in.shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=404, detail="Shelf not found")
    if alloc_in.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")

    # Find existing allocation
    alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == alloc_in.product_id,
        StockAllocation.shelf_id == alloc_in.shelf_id
    ).first()

    if alloc:
        alloc.quantity = alloc_in.quantity
    else:
        alloc = StockAllocation(
            product_id=alloc_in.product_id,
            shelf_id=alloc_in.shelf_id,
            quantity=alloc_in.quantity
        )
        db.add(alloc)

    # Log Activity
    uid = current_user_id.get(None)
    uname = current_username.get(None)
    act = WarehouseActivity(
        user_id=uid,
        username=uname,
        activity_type="Allocated",
        product_id=alloc_in.product_id,
        quantity=alloc_in.quantity,
        to_shelf_id=alloc_in.shelf_id,
        timestamp=datetime.utcnow()
    )
    db.add(act)
    db.commit()
    db.refresh(alloc)

    # Map details to response
    res = StockAllocationResponse.model_validate(alloc)
    res.location_path = get_shelf_path(shelf)
    res.product_sku = prod.sku
    res.product_name = prod.name
    return res

# --- TRANSFER STOCK ---
@router.post("/warehouse/transfer")
def transfer_stock(req: StockTransferRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if req.quantity <= 0:
        raise HTTPException(status_code=400, detail="Transfer quantity must be greater than zero")

    # Find source allocation
    src_alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == req.product_id,
        StockAllocation.shelf_id == req.from_shelf_id
    ).first()

    if not src_alloc or src_alloc.quantity < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock on source shelf")

    # Verify target shelf exists
    dest_shelf = db.query(Shelf).filter(Shelf.id == req.to_shelf_id).first()
    if not dest_shelf:
        raise HTTPException(status_code=404, detail="Destination shelf not found")

    # Deduct from source
    src_alloc.quantity -= req.quantity
    if src_alloc.quantity == 0:
        db.delete(src_alloc)

    # Add to target
    dest_alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == req.product_id,
        StockAllocation.shelf_id == req.to_shelf_id
    ).first()

    if dest_alloc:
        dest_alloc.quantity += req.quantity
    else:
        dest_alloc = StockAllocation(
            product_id=req.product_id,
            shelf_id=req.to_shelf_id,
            quantity=req.quantity
        )
        db.add(dest_alloc)

    # Log Activity
    uid = current_user_id.get(None)
    uname = current_username.get(None)
    act = WarehouseActivity(
        user_id=uid,
        username=uname,
        activity_type="Moved",
        product_id=req.product_id,
        quantity=req.quantity,
        from_shelf_id=req.from_shelf_id,
        to_shelf_id=req.to_shelf_id,
        timestamp=datetime.utcnow()
    )
    db.add(act)
    db.commit()

    return {"message": "Stock transferred successfully"}

# --- ACTIVITY TIMELINE ---
@router.get("/warehouse/activity", response_model=List[WarehouseActivityResponse])
def get_warehouse_activities(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    activities = db.query(WarehouseActivity).order_by(WarehouseActivity.timestamp.desc()).limit(100).all()
    res_list = []
    for act in activities:
        res = WarehouseActivityResponse.model_validate(act)
        res.product_sku = act.product.sku
        res.product_name = act.product.name
        if act.from_shelf:
            res.from_shelf_path = get_shelf_path(act.from_shelf)
        if act.to_shelf:
            res.to_shelf_path = get_shelf_path(act.to_shelf)
        res_list.append(res)
    return res_list
```

### Integration with Manufacturing Orders (`backend/app/routers/manufacturing.py`)
In `backend/app/routers/manufacturing.py`, update `get_manufacturing_order` (and `list_manufacturing_orders` if applicable) to map components and retrieve their current storage locations.

```python
# Modified segment in backend/app/routers/manufacturing.py
# Inside get_manufacturing_order / response mapping:

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
    
    # Retrieve storage location info for all components dynamically
    for comp in mo.components:
        allocations = db.query(StockAllocation).filter(
            StockAllocation.product_id == comp.component_product_id
        ).all()
        
        storage_locations = []
        for alloc in allocations:
            shelf = alloc.shelf
            rack = shelf.rack
            aisle = rack.aisle
            wh = aisle.warehouse
            storage_locations.append({
                "warehouse_name": wh.name,
                "warehouse_code": wh.code,
                "aisle_name": aisle.name,
                "aisle_code": aisle.code,
                "rack_name": rack.name,
                "rack_code": rack.code,
                "shelf_name": shelf.name,
                "shelf_code": shelf.code,
                "quantity": alloc.quantity
            })
        
        # Inject dynamically into transient response schema
        comp.storage_locations = storage_locations

    return mo
```

### Registering Router in `backend/app/main.py`
Add the router import and registry call in `backend/app/main.py`:
```python
# In main.py
from backend.app.routers import warehouse_mapping

# Register router
app.include_router(warehouse_mapping.router)
```

---

## 5. Frontend Architecture & Page Structure

### 5.1. Registration & Routing
1. **Sidebar Navigation Link** (`frontend/src/components/AppShell.tsx`):
   Import `MapPin` from `lucide-react` and add to the `NAV` array:
   ```typescript
   { to: "/warehouse-mapping", label: "Warehouse Mapping", icon: MapPin }
   ```
2. **React App Router** (`frontend/src/App.tsx`):
   Import `WarehouseMapping` and map path `/warehouse-mapping`:
   ```typescript
   import WarehouseMapping from "@/pages/warehouse-mapping/WarehouseMapping";
   
   // In routes inside AppShell
   <Route path="/warehouse-mapping" element={<WarehouseMapping />} />
   ```

### 5.2. Page Structure: `WarehouseMapping.tsx`
Create `frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx` with a dual-pane layout:
- **Left Panel (Interactive Map & Search)**: Tabs for exploring "Visual Map", "Allocate Stock", "Transfer Stock", and "Activity Feed".
- **Right Panel (Details Sidebar / Inspector)**: Displays context-aware metadata about the selected Warehouse, Aisle, Rack, or Shelf, along with QR codes and inventory allocations.

Here is the exact page structure and code layout recommendation:

```tsx
import * as React from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MapPin, QrCode, ScanLine, ArrowRightLeft, Plus, Trash2 } from "lucide-react";

// Types
interface Warehouse { id: number; name: string; code: string; description?: string }
interface Aisle { id: number; warehouse_id: number; name: string; code: string }
interface Rack { id: number; aisle_id: number; name: string; code: string }
interface Shelf { id: number; rack_id: number; name: string; code: string }
interface Allocation { id: number; product_id: number; shelf_id: number; quantity: number; location_path: string; product_sku: string; product_name: string }
interface Activity { id: number; activity_type: string; product_sku: string; product_name: string; quantity: number; from_shelf_path?: string; to_shelf_path?: string; timestamp: string; username?: string }

export default function WarehouseMapping() {
  const queryClient = useQueryClient();

  // Queries
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: async () => (await api.get<Warehouse[]>("/warehouses")).data });
  const { data: aisles = [] } = useQuery({ queryKey: ["aisles"], queryFn: async () => (await api.get<Aisle[]>("/aisles")).data });
  const { data: racks = [] } = useQuery({ queryKey: ["racks"], queryFn: async () => (await api.get<Rack[]>("/racks")).data });
  const { data: shelves = [] } = useQuery({ queryKey: ["shelves"], queryFn: async () => (await api.get<Shelf[]>("/shelves")).data });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: async () => (await api.get<any[]>("/products")).data });
  const { data: activities = [] } = useQuery({ queryKey: ["warehouse-activities"], queryFn: async () => (await api.get<Activity[]>("/warehouse/activity")).data });

  // Selected Nodes
  const [selectedWh, setSelectedWh] = React.useState<number | null>(null);
  const [selectedAisle, setSelectedAisle] = React.useState<number | null>(null);
  const [selectedRack, setSelectedRack] = React.useState<number | null>(null);
  const [selectedShelf, setSelectedShelf] = React.useState<number | null>(null);

  // Modal States
  const [showScanner, setShowScanner] = React.useState(false);
  const [showQrCode, setShowQrCode] = React.useState<Shelf | null>(null);

  // Form States
  const [allocProd, setAllocProd] = React.useState("");
  const [allocQty, setAllocQty] = React.useState("");
  const [transferProd, setTransferProd] = React.useState("");
  const [transferFromShelf, setTransferFromShelf] = React.useState("");
  const [transferToShelf, setTransferToShelf] = React.useState("");
  const [transferQty, setTransferQty] = React.useState("");

  // Mutations
  const allocateMutation = useMutation({
    mutationFn: async (vars: { product_id: number; shelf_id: number; quantity: number }) => (await api.post("/warehouse/allocate", vars)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-activities"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setAllocQty("");
    }
  });

  const transferMutation = useMutation({
    mutationFn: async (vars: { product_id: number; from_shelf_id: number; to_shelf_id: number; quantity: number }) => (await api.post("/warehouse/transfer", vars)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-activities"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setTransferQty("");
    }
  });

  // Derived selections
  const filteredAisles = aisles.filter(a => a.warehouse_id === selectedWh);
  const filteredRacks = racks.filter(r => r.aisle_id === selectedAisle);
  const filteredShelves = shelves.filter(s => s.rack_id === selectedRack);
  const currentShelfObj = shelves.find(s => s.id === selectedShelf);

  // Mock Allocations for selected Shelf
  const shelfAllocations = products.flatMap((p: any) => p.allocations || []).filter((a: any) => a.shelf_id === selectedShelf);

  const handleScanShelf = (code: string) => {
    // Simulated Scanner matches shelf code (e.g. WH-01 / A1 / R1 / S1) and sets state
    const match = shelves.find(s => {
      const rack = racks.find(r => r.id === s.rack_id);
      const aisle = aisles.find(a => a.id === rack?.aisle_id);
      const wh = warehouses.find(w => w.id === aisle?.warehouse_id);
      const fullCode = `${wh?.code} / ${aisle?.code} / ${rack?.code} / ${s.code}`;
      return fullCode.trim().toLowerCase() === code.trim().toLowerCase();
    });
    if (match) {
      const rack = racks.find(r => r.id === match.rack_id);
      const aisle = aisles.find(a => a.id === rack?.aisle_id);
      setSelectedWh(aisle?.warehouse_id || null);
      setSelectedAisle(rack?.aisle_id || null);
      setSelectedRack(match.rack_id);
      setSelectedShelf(match.id);
      setShowScanner(false);
    } else {
      alert("Shelf QR Code not recognized");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Warehouse Mapping Dashboard"
        description="Visualize storage layout, allocate stock, perform transfers, and inspect QR codes."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowScanner(true)}>
              <ScanLine className="h-4 w-4 mr-2" /> QR Scanner
            </Button>
          </div>
        }
      />
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-8 overflow-auto">
        
        {/* Visual Map & Tabs */}
        <Card className="col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle>Warehouse Visual Grid Map</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            <Tabs defaultValue="grid" className="flex-1 flex flex-col">
              <TabsList className="mb-4">
                <TabsTrigger value="grid">Visual Grid</TabsTrigger>
                <TabsTrigger value="allocate">Place/Allocate Stock</TabsTrigger>
                <TabsTrigger value="transfer">Transfer Stock</TabsTrigger>
                <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
              </TabsList>

              {/* Grid Selector Map */}
              <TabsContent value="grid" className="flex-1 space-y-4">
                <div>
                  <Label>1. Select Warehouse</Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {warehouses.map(w => (
                      <Button key={w.id} variant={selectedWh === w.id ? "default" : "outline"} onClick={() => { setSelectedWh(w.id); setSelectedAisle(null); setSelectedRack(null); setSelectedShelf(null); }}>
                        {w.code} - {w.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedWh && (
                  <div>
                    <Label>2. Select Aisle</Label>
                    <div className="grid grid-cols-5 gap-2 mt-1">
                      {filteredAisles.map(a => (
                        <Button key={a.id} size="sm" variant={selectedAisle === a.id ? "default" : "secondary"} onClick={() => { setSelectedAisle(a.id); setSelectedRack(null); setSelectedShelf(null); }}>
                          Aisle {a.code}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAisle && (
                  <div>
                    <Label>3. Select Rack</Label>
                    <div className="grid grid-cols-6 gap-2 mt-1">
                      {filteredRacks.map(r => (
                        <Button key={r.id} size="sm" variant={selectedRack === r.id ? "default" : "outline"} onClick={() => { setSelectedRack(r.id); setSelectedShelf(null); }}>
                          Rack {r.code}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRack && (
                  <div>
                    <Label>4. Select Shelf (Grid View)</Label>
                    <div className="grid grid-cols-4 gap-4 mt-2">
                      {filteredShelves.map(s => (
                        <div
                          key={s.id}
                          className={`p-4 border rounded-lg cursor-pointer flex flex-col justify-between items-center h-24 transition-all hover:shadow-md ${selectedShelf === s.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-card"}`}
                          onClick={() => setSelectedShelf(s.id)}
                        >
                          <span className="font-bold text-lg">Shelf {s.code}</span>
                          <span className="text-xs text-muted-foreground">{s.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Allocate Form */}
              <TabsContent value="allocate" className="space-y-4">
                <div className="max-w-md space-y-3">
                  <div>
                    <Label>Product to Place</Label>
                    <Select value={allocProd} onValueChange={setAllocProd}>
                      <SelectTrigger><SelectValue placeholder="Select Product" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.sku} - {p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Destination Shelf</Label>
                    <Select value={String(selectedShelf || "")} onValueChange={(val) => setSelectedShelf(Number(val))}>
                      <SelectTrigger><SelectValue placeholder="Select Shelf" /></SelectTrigger>
                      <SelectContent>
                        {shelves.map(s => <SelectItem key={s.id} value={String(s.id)}>Shelf {s.code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" value={allocQty} onChange={(e) => setAllocQty(e.target.value)} placeholder="0.00" />
                  </div>
                  <Button onClick={() => allocateMutation.mutate({ product_id: Number(allocProd), shelf_id: Number(selectedShelf), quantity: Number(allocQty) })}>
                    Confirm Allocation
                  </Button>
                </div>
              </TabsContent>

              {/* Transfer Form */}
              <TabsContent value="transfer" className="space-y-4">
                <div className="max-w-md space-y-3">
                  <div>
                    <Label>Product to Transfer</Label>
                    <Select value={transferProd} onValueChange={setTransferProd}>
                      <SelectTrigger><SelectValue placeholder="Select Product" /></SelectTrigger>
                      <SelectContent>
                        {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.sku} - {p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>From Shelf</Label>
                      <Select value={transferFromShelf} onValueChange={setTransferFromShelf}>
                        <SelectTrigger><SelectValue placeholder="Source Shelf" /></SelectTrigger>
                        <SelectContent>
                          {shelves.map(s => <SelectItem key={s.id} value={String(s.id)}>Shelf {s.code}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>To Shelf</Label>
                      <Select value={transferToShelf} onValueChange={setTransferToShelf}>
                        <SelectTrigger><SelectValue placeholder="Target Shelf" /></SelectTrigger>
                        <SelectContent>
                          {shelves.map(s => <SelectItem key={s.id} value={String(s.id)}>Shelf {s.code}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" value={transferQty} onChange={(e) => setTransferQty(e.target.value)} placeholder="0.00" />
                  </div>
                  <Button onClick={() => transferMutation.mutate({ product_id: Number(transferProd), from_shelf_id: Number(transferFromShelf), to_shelf_id: Number(transferToShelf), quantity: Number(transferQty) })}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Execute Transfer
                  </Button>
                </div>
              </TabsContent>

              {/* Activity Timeline Feed */}
              <TabsContent value="timeline">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map(act => (
                      <TableRow key={act.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(act.timestamp).toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">{act.activity_type}</TableCell>
                        <TableCell>{act.product_sku} - {act.product_name}</TableCell>
                        <TableCell className="text-right font-medium">{act.quantity}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{act.from_shelf_path || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{act.to_shelf_path || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Sidebar Inspector Panel */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Shelf Inspector</span>
              {currentShelfObj && (
                <Button size="icon" variant="ghost" onClick={() => setShowQrCode(currentShelfObj)}>
                  <QrCode className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentShelfObj ? (
              <div className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <h3 className="font-bold text-lg">{currentShelfObj.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">Code: {currentShelfObj.code}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Shelf Stock Allocations</h4>
                  {shelfAllocations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Shelf is currently empty.</p>
                  ) : (
                    <div className="space-y-2">
                      {shelfAllocations.map((a: any) => (
                        <div key={a.id} className="flex justify-between items-center p-2 border rounded bg-card">
                          <div>
                            <p className="text-xs font-semibold">{a.product_sku}</p>
                            <p className="text-xs text-muted-foreground">{a.product_name}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold">{a.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center border-2 border-dashed rounded-lg text-muted-foreground">
                Select a Shelf to view details
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* QR Code Dialog */}
      {showQrCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-sm w-full space-y-4 border shadow-xl">
            <h3 className="font-bold text-lg">Shelf QR Code</h3>
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded border">
              {/* Rendering QR Code dynamically using dynamic chart API or custom layout */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  `SHELF:${showQrCode.id}`
                )}`}
                alt="QR Code"
                className="w-44 h-44"
              />
              <span className="text-xs text-black font-semibold mt-3">
                {showQrCode.code} - {showQrCode.name}
              </span>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowQrCode(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Scanner Dialog */}
      {showQrCode === null && showScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-sm w-full space-y-4 border shadow-xl">
            <h3 className="font-bold text-lg">Simulated QR Code Scanner</h3>
            <div className="space-y-3">
              <Label>Select Shelf to Scan</Label>
              <Select onValueChange={(val) => handleScanShelf(val)}>
                <SelectTrigger><SelectValue placeholder="Choose Shelf..." /></SelectTrigger>
                <SelectContent>
                  {shelves.map(s => {
                    const rack = racks.find(r => r.id === s.rack_id);
                    const aisle = aisles.find(a => a.id === rack?.aisle_id);
                    const wh = warehouses.find(w => w.id === aisle?.warehouse_id);
                    const fullCode = `${wh?.code} / ${aisle?.code} / ${rack?.code} / ${s.code}`;
                    return <SelectItem key={s.id} value={fullCode}>{fullCode}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowScanner(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 5.3. Updating Manufacturing Detail Component (`frontend/src/pages/manufacturing/ManufacturingDetail.tsx`)
In `ManufacturingDetail.tsx`, we should show the components' storage location paths (Warehouse / Aisle / Rack / Shelf) and available quantities at each location within the components table, making it easy for production operators to fetch parts.

```tsx
// Inside the TableBody component of components list in ManufacturingDetail.tsx:

<TableRow key={c.id}>
  <TableCell>
    <div>
      <span className="font-medium">{c.component_product ? c.component_product.name : productName(c.component_product_id)}</span>
      
      {/* RENDER DYNAMIC COMPONENT STORAGE LOCATIONS */}
      {c.storage_locations && c.storage_locations.length > 0 ? (
        <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-1 border-t pt-1">
          <span className="font-semibold text-primary/80">Retrieve from:</span>
          {c.storage_locations.map((loc: any, idx: number) => (
            <div key={idx} className="flex justify-between items-center">
              <span>📍 {loc.warehouse_code} / {loc.aisle_code} / {loc.rack_code} / {loc.shelf_code}</span>
              <span className="font-medium bg-muted px-1.5 py-0.5 rounded text-[10px]">{loc.quantity} units</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-destructive mt-1 italic">
          ⚠️ Not allocated to any shelf location
        </div>
      )}
    </div>
  </TableCell>
  <TableCell className="text-right">{c.required_quantity}</TableCell>
  <TableCell className="text-right">{c.consumed_quantity}</TableCell>
  <TableCell className={`text-right ${short ? "text-destructive font-semibold" : ""}`}>{stock}</TableCell>
  <TableCell><StatusBadge status={c.status === "Consumed" ? "Completed" : c.status === "Pending" ? "Draft" : c.status} /></TableCell>
</TableRow>
```

---

## 6. End-to-End Testing & Verification Plan (`backend/test_warehouse_mapping.py`)

A script-based integration test should be implemented in `backend/test_warehouse_mapping.py` following the style of `backend/test_flow.py`.

```python
import sys
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.seed import seed_db
from backend.app.models import Warehouse, Aisle, Rack, Shelf, StockAllocation, WarehouseActivity

client = TestClient(app)

def test_warehouse_workflow():
    print("Starting Warehouse Mapping E2E Workflow verification...")
    seed_db()
    
    # 1. Login
    login_resp = client.post("/api/auth/login", data={"username": "admin", "password": "admin123"})
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Create Warehouse, Aisle, Rack, Shelf
    wh = client.post("/api/warehouses", json={"name": "Central Furniture Store", "code": "WH-01"}, headers=headers).json()
    wh_id = wh["id"]
    print(f"[PASS] Created warehouse WH-01 (ID: {wh_id})")
    
    aisle = client.post("/api/aisles", json={"warehouse_id": wh_id, "name": "Plank Storage", "code": "A1"}, headers=headers).json()
    aisle_id = aisle["id"]
    print(f"[PASS] Created Aisle A1 (ID: {aisle_id})")
    
    rack = client.post("/api/racks", json={"aisle_id": aisle_id, "name": "Heavy Wood Racks", "code": "R1"}, headers=headers).json()
    rack_id = rack["id"]
    print(f"[PASS] Created Rack R1 (ID: {rack_id})")
    
    shelf = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Teak Shelf Top", "code": "S1"}, headers=headers).json()
    shelf_id = shelf["id"]
    print(f"[PASS] Created Shelf S1 (ID: {shelf_id})")
    
    # 3. Test Stock Allocation
    # Locate product RM001 (Teak Wood)
    prods = client.get("/api/products", headers=headers).json()
    rm001 = next(p for p in prods if p["sku"] == "RM001")
    rm001_id = rm001["id"]
    
    alloc = client.post("/api/warehouse/allocate", json={
        "product_id": rm001_id,
        "shelf_id": shelf_id,
        "quantity": 15.0
    }, headers=headers).json()
    assert alloc["quantity"] == 15.0
    print(f"[PASS] Allocated 15 units of RM001 to S1.")
    
    # 4. Create another shelf to test Transfer
    shelf2 = client.post("/api/shelves", json={"rack_id": rack_id, "name": "Teak Shelf Bottom", "code": "S2"}, headers=headers).json()
    shelf2_id = shelf2["id"]
    
    transfer = client.post("/api/warehouse/transfer", json={
        "product_id": rm001_id,
        "from_shelf_id": shelf_id,
        "to_shelf_id": shelf2_id,
        "quantity": 5.0
    }, headers=headers)
    assert transfer.status_code == 200
    print(f"[PASS] Transferred 5 units from S1 to S2.")
    
    # 5. Verify Activities Logged
    activities = client.get("/api/warehouse/activity", headers=headers).json()
    assert len(activities) >= 2
    assert activities[0]["activity_type"] == "Moved"
    assert activities[1]["activity_type"] == "Allocated"
    print(f"[PASS] Verified activity logs correctly recorded Allocated and Moved events.")
    
    print("ALL WAREHOUSE WORKFLOW TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    test_warehouse_workflow()
```
