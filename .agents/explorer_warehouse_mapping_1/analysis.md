# Warehouse Mapping Module Analysis & Design

## Executive Summary
This analysis outlines the architecture, database models, backend API routes, and frontend page structures required to implement the **Warehouse Mapping** module for the Shiv Furniture Works ERP system. By adding hierarchical storage tracking (`Warehouse` -> `Aisle` -> `Rack` -> `Shelf`), stock allocations, and activity movement logging, the ERP will transition from a single generic inventory pool to a precise, location-aware physical inventory tracking system. The design integrates QR code generation, simulated QR scanning, and component location mapping within the existing Manufacturing Order details page.

---

## 1. Database Models (`backend/app/models.py`)

We propose six new SQLAlchemy database models to support hierarchical storage mapping, stock allocation, and movement logging.

### Schema UML / Relationship Structure
`Warehouse (1) -> (N) Aisle (1) -> (N) Rack (1) -> (N) Shelf (1) -> (N) StockAllocation (N) <- (1) Product`

### 1.1 Warehouse Model
Represents the top-level warehouse facility.
```python
class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    code = Column(String, unique=True, index=True, nullable=False) # E.g., "WH-MAIN", "WH-RAW"
    address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    aisles = relationship("Aisle", back_populates="warehouse", cascade="all, delete-orphan")
```

### 1.2 Aisle Model
Represents an aisle within a specific warehouse.
```python
class Aisle(Base):
    __tablename__ = "aisles"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False) # E.g., "A", "B", "C"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    warehouse = relationship("Warehouse", back_populates="aisles")
    racks = relationship("Rack", back_populates="aisle", cascade="all, delete-orphan")
```

### 1.3 Rack Model
Represents a vertical rack structure within an aisle.
```python
class Rack(Base):
    __tablename__ = "racks"

    id = Column(Integer, primary_key=True, index=True)
    aisle_id = Column(Integer, ForeignKey("aisles.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False) # E.g., "R1", "R2"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    aisle = relationship("Aisle", back_populates="racks")
    shelves = relationship("Shelf", back_populates="rack", cascade="all, delete-orphan")
```

### 1.4 Shelf Model
Represents a specific storage shelf level on a rack. This is the unit to which products are physically allocated.
```python
class Shelf(Base):
    __tablename__ = "shelves"

    id = Column(Integer, primary_key=True, index=True)
    rack_id = Column(Integer, ForeignKey("racks.id"), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False) # E.g., "S1", "S2"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    rack = relationship("Rack", back_populates="shelves")
    allocations = relationship("StockAllocation", back_populates="shelf", cascade="all, delete-orphan")
```

### 1.5 StockAllocation Model
A join table representing quantities of products allocated to specific shelves.
```python
from sqlalchemy import UniqueConstraint

class StockAllocation(Base):
    __tablename__ = "stock_allocations"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=False)
    quantity = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Composite unique constraint to prevent duplicate allocation rows per shelf-product pair
    __table_args__ = (UniqueConstraint("product_id", "shelf_id", name="uq_product_shelf"),)

    # Relationships
    product = relationship("Product", back_populates="allocations")
    shelf = relationship("Shelf", back_populates="allocations")
```

Add relationship to the existing `Product` model in `backend/app/models.py`:
```python
# In class Product:
allocations = relationship("StockAllocation", back_populates="product", cascade="all, delete-orphan")
```

### 1.6 WarehouseActivity Model
Logs stock movement events including placement, transfers, and consumption.
```python
class WarehouseActivity(Base):
    __tablename__ = "warehouse_activities"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    from_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True) # Null if external entry
    to_shelf_id = Column(Integer, ForeignKey("shelves.id"), nullable=True)   # Null if consumed / exit
    quantity = Column(Float, nullable=False)
    activity_type = Column(String, nullable=False) # E.g., "Received", "Moved", "Consumed"
    username = Column(String, nullable=True)       # Who performed the action
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    product = relationship("Product")
    from_shelf = relationship("Shelf", foreign_keys=[from_shelf_id])
    to_shelf = relationship("Shelf", foreign_keys=[to_shelf_id])
```

---

## 2. Backend Schemas (`backend/app/schemas.py`)

Pydantic schemas to validate API inputs and format API responses.

```python
# Location Hierarchy Responses
class WarehouseResponse(BaseModel):
    id: int
    name: str
    code: str
    address: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AisleResponse(BaseModel):
    id: int
    warehouse_id: int
    name: str
    code: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class RackResponse(BaseModel):
    id: int
    aisle_id: int
    name: str
    code: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ShelfResponse(BaseModel):
    id: int
    rack_id: int
    name: str
    code: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Location Creation Inputs
class WarehouseCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None

class AisleCreate(BaseModel):
    warehouse_id: int
    name: str
    code: str

class RackCreate(BaseModel):
    aisle_id: int
    name: str
    code: str

class ShelfCreate(BaseModel):
    rack_id: int
    name: str
    code: str

# Allocation & Movement
class StockAllocationCreate(BaseModel):
    product_id: int
    shelf_id: int
    quantity: float

class StockAllocationResponse(BaseModel):
    id: int
    product_id: int
    shelf_id: int
    quantity: float
    created_at: datetime
    updated_at: datetime
    shelf: Optional[ShelfResponse] = None
    model_config = ConfigDict(from_attributes=True)

class StockTransferCreate(BaseModel):
    product_id: int
    from_shelf_id: int
    to_shelf_id: int
    quantity: float

class WarehouseActivityResponse(BaseModel):
    id: int
    product_id: int
    from_shelf_id: Optional[int] = None
    to_shelf_id: Optional[int] = None
    quantity: float
    activity_type: str
    username: Optional[str] = None
    timestamp: datetime
    product: Optional[ProductResponse] = None
    from_shelf: Optional[ShelfResponse] = None
    to_shelf: Optional[ShelfResponse] = None
    model_config = ConfigDict(from_attributes=True)
```

---

## 3. Backend API Routes (`backend/app/routers/warehouse_mapping.py`)

A new FastAPI router should be created and registered in `backend/app/main.py`.

### 3.1 Location CRUD Router
Standard CRUD operations with optional filters to select children of a specific parent (e.g. Aisles under Warehouse ID).
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.database import get_db
from backend.app.auth import get_current_user
from backend.app.models import Warehouse, Aisle, Rack, Shelf, StockAllocation, WarehouseActivity, Product
from backend.app.schemas import (
    WarehouseCreate, WarehouseResponse, AisleCreate, AisleResponse,
    RackCreate, RackResponse, ShelfCreate, ShelfResponse,
    StockAllocationCreate, StockAllocationResponse, StockTransferCreate,
    WarehouseActivityResponse
)
from backend.app.utils.context import current_username

router = APIRouter(prefix="/api", tags=["Warehouse Mapping"])

# Warehouses CRUD
@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(warehouse: WarehouseCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db_wh = Warehouse(**warehouse.model_dump())
    db.add(db_wh)
    db.commit()
    db.refresh(db_wh)
    return db_wh

@router.get("/warehouses", response_model=List[WarehouseResponse])
def get_warehouses(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(Warehouse).all()

# Aisles CRUD with Parent Filter
@router.post("/aisles", response_model=AisleResponse, status_code=status.HTTP_201_CREATED)
def create_aisle(aisle: AisleCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db_aisle = Aisle(**aisle.model_dump())
    db.add(db_aisle)
    db.commit()
    db.refresh(db_aisle)
    return db_aisle

@router.get("/aisles", response_model=List[AisleResponse])
def get_aisles(warehouse_id: Optional[int] = None, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    query = db.query(Aisle)
    if warehouse_id:
        query = query.filter(Aisle.warehouse_id == warehouse_id)
    return query.all()

# Racks CRUD with Parent Filter
@router.post("/racks", response_model=RackResponse, status_code=status.HTTP_201_CREATED)
def create_rack(rack: RackCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db_rack = Rack(**rack.model_dump())
    db.add(db_rack)
    db.commit()
    db.refresh(db_rack)
    return db_rack

@router.get("/racks", response_model=List[RackResponse])
def get_racks(aisle_id: Optional[int] = None, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    query = db.query(Rack)
    if aisle_id:
        query = query.filter(Rack.aisle_id == aisle_id)
    return query.all()

# Shelves CRUD with Parent Filter
@router.post("/shelves", response_model=ShelfResponse, status_code=status.HTTP_201_CREATED)
def create_shelf(shelf: ShelfCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    db_shelf = Shelf(**shelf.model_dump())
    db.add(db_shelf)
    db.commit()
    db.refresh(db_shelf)
    return db_shelf

@router.get("/shelves", response_model=List[ShelfResponse])
def get_shelves(rack_id: Optional[int] = None, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    query = db.query(Shelf)
    if rack_id:
        query = query.filter(Shelf.rack_id == rack_id)
    return query.all()
```

### 3.2 Stock Placement (Allocate) API
Allocates a quantity of product to a specific shelf. Upserts if an allocation record already exists and logs a `Received` activity.
```python
@router.post("/warehouse/allocate", response_model=StockAllocationResponse)
def allocate_stock(alloc_in: StockAllocationCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == alloc_in.product_id).first()
    shelf = db.query(Shelf).filter(Shelf.id == alloc_in.shelf_id).first()
    if not product or not shelf:
        raise HTTPException(status_code=404, detail="Product or Shelf not found")
    
    # Upsert logic
    alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == alloc_in.product_id,
        StockAllocation.shelf_id == alloc_in.shelf_id
    ).first()

    if alloc:
        alloc.quantity += alloc_in.quantity
    else:
        alloc = StockAllocation(
            product_id=alloc_in.product_id,
            shelf_id=alloc_in.shelf_id,
            quantity=alloc_in.quantity
        )
        db.add(alloc)

    # Sync product general stock (assuming new allocation equals new stock entry)
    product.on_hand_qty += alloc_in.quantity

    # Log activity
    username = current_username.get(current_user.username)
    activity = WarehouseActivity(
        product_id=alloc_in.product_id,
        from_shelf_id=None,
        to_shelf_id=alloc_in.shelf_id,
        quantity=alloc_in.quantity,
        activity_type="Received",
        username=username
    )
    db.add(activity)
    db.commit()
    db.refresh(alloc)
    return alloc
```

### 3.3 Stock Transfer API
Moves inventory from a source shelf to a target shelf. Validates stock availability and logs a `Moved` activity.
```python
@router.post("/warehouse/transfer")
def transfer_stock(transfer_in: StockTransferCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Verify source allocation
    src_alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == transfer_in.product_id,
        StockAllocation.shelf_id == transfer_in.from_shelf_id
    ).first()

    if not src_alloc or src_alloc.quantity < transfer_in.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient product quantity at source shelf (Available: {src_alloc.quantity if src_alloc else 0})"
        )

    # Get or create target allocation
    dest_alloc = db.query(StockAllocation).filter(
        StockAllocation.product_id == transfer_in.product_id,
        StockAllocation.shelf_id == transfer_in.to_shelf_id
    ).first()

    if dest_alloc:
        dest_alloc.quantity += transfer_in.quantity
    else:
        dest_alloc = StockAllocation(
            product_id=transfer_in.product_id,
            shelf_id=transfer_in.to_shelf_id,
            quantity=transfer_in.quantity
        )
        db.add(dest_alloc)

    # Deduct from source
    src_alloc.quantity -= transfer_in.quantity
    if src_alloc.quantity <= 0:
        db.delete(src_alloc)

    # Log activity
    username = current_username.get(current_user.username)
    activity = WarehouseActivity(
        product_id=transfer_in.product_id,
        from_shelf_id=transfer_in.from_shelf_id,
        to_shelf_id=transfer_in.to_shelf_id,
        quantity=transfer_in.quantity,
        activity_type="Moved",
        username=username
    )
    db.add(activity)
    db.commit()

    return {"message": "Stock transfer completed successfully"}
```

### 3.4 Warehouse Activity Log API
Fetches the activity log.
```python
@router.get("/warehouse/activity", response_model=List[WarehouseActivityResponse])
def get_warehouse_activities(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    return db.query(WarehouseActivity).order_by(WarehouseActivity.timestamp.desc()).all()
```

---

## 4. Manufacturing Order Integration

To connect Manufacturing Orders to component storage locations:

### 4.1 Schemas Update (`backend/app/schemas.py`)
Define `ComponentLocationInfo` and add it to `ManufacturingOrderComponentResponse`:
```python
class ComponentLocationInfo(BaseModel):
    warehouse_name: str
    aisle_name: str
    rack_name: str
    shelf_name: str
    quantity: float

class ManufacturingOrderComponentResponse(BaseModel):
    id: int
    manufacturing_order_id: int
    component_product_id: int
    required_quantity: float
    consumed_quantity: float
    status: str
    component_product: Optional[ProductResponse] = None
    storage_locations: List[ComponentLocationInfo] = [] # Injected dynamically
```

### 4.2 Router Update (`backend/app/routers/manufacturing.py`)
In `get_manufacturing_order` (and `list_manufacturing_orders` if needed), we dynamically query and attach storage location details for each raw material component:
```python
# Within get_manufacturing_order route:
# Since sqlalchemy automatically resolves relationships, we can map allocations manually
# before returning, or setup a hybrid property. Mapping in router or using a custom resolver:
for comp in mo.components:
    allocations = db.query(StockAllocation).filter(
        StockAllocation.product_id == comp.component_product_id
    ).all()
    
    comp.storage_locations = [
        ComponentLocationInfo(
            warehouse_name=a.shelf.rack.aisle.warehouse.name,
            aisle_name=a.shelf.rack.aisle.name,
            rack_name=a.shelf.rack.name,
            shelf_name=a.shelf.name,
            quantity=a.quantity
        ) for a in allocations
    ]
```

### 4.3 Stock Consumption in MO Completion
In `produce_manufacturing_order` route, when component quantities are deducted, they must also be deducted from the `StockAllocation` records in a FIFO/LIFO or greedy manner:
```python
# Within produce_manufacturing_order route:
for comp in mo.components:
    # Deduct from individual allocations
    allocations = db.query(StockAllocation).filter(
        StockAllocation.product_id == comp.component_product_id
    ).order_by(StockAllocation.created_at.asc()).all()
    
    rem_to_consume = comp.required_quantity
    for alloc in allocations:
        if rem_to_consume <= 0:
            break
        
        consume_qty = min(alloc.quantity, rem_to_consume)
        alloc.quantity -= consume_qty
        rem_to_consume -= consume_qty
        
        # Log activity of type "Consumed"
        activity = WarehouseActivity(
            product_id=comp.component_product_id,
            from_shelf_id=alloc.shelf_id,
            to_shelf_id=None,
            quantity=consume_qty,
            activity_type="Consumed",
            username=current_username.get(current_user.username)
        )
        db.add(activity)
        
        if alloc.quantity <= 0:
            db.delete(alloc)
```

---

## 5. Frontend Structure

### 5.1 App Navigation and Route Integration
Modify `frontend/src/components/AppShell.tsx` and `frontend/src/App.tsx`.

* **AppShell.tsx**:
  ```typescript
  import { Warehouse } from "lucide-react"; // Import new icon

  const NAV = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/products", label: "Products", icon: Package },
    { to: "/warehouse-mapping", label: "Warehouse Mapping", icon: Warehouse }, // Added here
    { to: "/sales", label: "Sales Orders", icon: ShoppingCart },
    ...
  ];
  ```

* **App.tsx**:
  ```typescript
  import WarehouseMapping from "@/pages/warehouse-mapping/WarehouseMapping"; // Import new page

  // Inside Routes -> ProtectedRoute -> AppShell:
  <Route path="/warehouse-mapping" element={<WarehouseMapping />} />
  ```

### 5.2 TypeScript Contracts (`frontend/src/lib/types.ts`)
Add TypeScript definitions mapping to the backend schemas:
```typescript
export interface Warehouse {
  id: number;
  name: string;
  code: string;
  address?: string;
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
  shelf?: Shelf;
}

export interface WarehouseActivity {
  id: number;
  product_id: number;
  from_shelf_id?: number;
  to_shelf_id?: number;
  quantity: number;
  activity_type: "Received" | "Moved" | "Consumed";
  username?: string;
  timestamp: string;
  product?: Product;
  from_shelf?: Shelf;
  to_shelf?: Shelf;
}

export interface ComponentLocationInfo {
  warehouse_name: string;
  aisle_name: string;
  rack_name: string;
  shelf_name: string;
  quantity: number;
}

// In ManufacturingOrderComponent, add:
storage_locations?: ComponentLocationInfo[];
```

### 5.3 React Hooks (`frontend/src/hooks/useWarehouse.ts`)
React Query queries and mutations for location, allocation, transfer, and activity logs.
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Warehouse, Aisle, Rack, Shelf, StockAllocation, WarehouseActivity } from "@/lib/types";

export function useWarehouses() {
  return useQuery({ queryKey: ["warehouses"], queryFn: async () => (await api.get<Warehouse[]>("/warehouses")).data });
}

export function useAisles(whId?: number) {
  return useQuery({
    queryKey: ["aisles", whId],
    queryFn: async () => (await api.get<Aisle[]>("/aisles", { params: { warehouse_id: whId } })).data,
    enabled: !!whId
  });
}

export function useRacks(aisleId?: number) {
  return useQuery({
    queryKey: ["racks", aisleId],
    queryFn: async () => (await api.get<Rack[]>("/racks", { params: { aisle_id: aisleId } })).data,
    enabled: !!aisleId
  });
}

export function useShelves(rackId?: number) {
  return useQuery({
    queryKey: ["shelves", rackId],
    queryFn: async () => (await api.get<Shelf[]>("/shelves", { params: { rack_id: rackId } })).data,
    enabled: !!rackId
  });
}

export function useWarehouseActions() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["warehouses"] });
    qc.invalidateQueries({ queryKey: ["aisles"] });
    qc.invalidateQueries({ queryKey: ["racks"] });
    qc.invalidateQueries({ queryKey: ["shelves"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["activities"] });
  };
  return {
    allocate: useMutation({
      mutationFn: async (data: { product_id: number; shelf_id: number; quantity: number }) => 
        (await api.post("/warehouse/allocate", data)).data,
      onSuccess: inval
    }),
    transfer: useMutation({
      mutationFn: async (data: { product_id: number; from_shelf_id: number; to_shelf_id: number; quantity: number }) =>
        (await api.post("/warehouse/transfer", data)).data,
      onSuccess: inval
    })
  };
}

export function useWarehouseActivities() {
  return useQuery({
    queryKey: ["warehouse-activities"],
    queryFn: async () => (await api.get<WarehouseActivity[]>("/warehouse/activity")).data
  });
}
```

### 5.4 Main Dashboard Page (`frontend/src/pages/warehouse-mapping/WarehouseMapping.tsx`)
This page renders the main UI for the Warehouse Mapping module, containing:
1. **Header Control Area**: Dropdown selector to choose the active warehouse, and a "Scan QR Code (Simulated)" action button.
2. **Interactive Layout Map**:
   - Renders a multi-column grid containing rows of aisles.
   - For the selected aisle, shows a horizontal row of racks.
   - Within each rack, renders vertical shelves.
   - Shelves are colored based on their stock levels (e.g. gray for empty, blue for occupied).
   - Clicking a shelf opens the **Details Sidebar Panel**.
3. **Details Sidebar Panel (Drawer/Slide-out)**:
   - Displays the selected shelf's details (Code: e.g., `WH1-A-R1-S2`, Warehouse, Aisle, Rack).
   - Includes a generated QR Code (using React component `QRCodeSVG` or `QRCodeCanvas` from `qrcode.react`).
   - Displays the shelf's **Stock Allocations** in a table: Product SKU, Name, Allocated Quantity.
   - Action buttons: "Allocate Stock" and "Transfer Stock" (which launch modals to perform the backend mutations).
4. **Recent Activities timeline**:
   - Renders at the bottom of the page. Shows a list of recent stock movements.
5. **QR Code Scanner Modal**:
   - Opens when the user clicks "Scan QR Code".
   - Displays a simulated camera view or a dropdown listing all shelves. Selecting a shelf simulates scanning it and instantly opens its sidebar panel.

### 5.5 Manufacturing Order Details Page (`frontend/src/pages/manufacturing/ManufacturingDetail.tsx`)
In `ManufacturingDetail.tsx`, we add a display for component locations inside the `Components` table:
- Add a new column: `Storage Location(s)`.
- For each component, render the list of storage locations (e.g., `WH-A > Aisle 1 > Rack 2 > Shelf S3 (Qty: 25.0)`) by mapping over `c.storage_locations`.
- Highlight in warning yellow/orange if the component has zero allocations or if total allocation quantity across all shelves is less than the required quantity.

---

## 6. Verification Plan

To verify this module's correctness, a verification suite (`backend/test_warehouse_mapping.py`) should be implemented with the following checks:
1. **Hierarchical Setup Verification**: Creates a test warehouse, aisle, rack, and shelf, and asserts they are linked by foreign keys.
2. **Stock Placement (Allocate) Verification**: Allocates a quantity of products to a shelf and asserts the `StockAllocation` record is correctly upserted and `Product.on_hand_qty` is synchronized.
3. **Stock Transfer Validation**: Moves stock from shelf A to shelf B and validates:
   - Target shelf increases in quantity.
   - Source shelf decreases in quantity (and is deleted if quantity drops to 0).
   - Attempting to transfer more than the allocated quantity returns HTTP 400.
4. **Manufacturing Order Allocation consumption**:
   - Submits a Manufacturing Order.
   - Marks it as completed.
   - Verifies that component stock is deducted from the specific allocations, and corresponding `Consumed` activities are logged.
5. **Activity Log audit**: Asserts that `Received`, `Moved`, and `Consumed` movements write corresponding records to `warehouse_activities`.
