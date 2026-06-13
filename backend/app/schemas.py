from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import List, Optional

# User Schemas
class UserBase(BaseModel):
    username: str
    role: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# Product Schemas
class ProductBase(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category: str
    sales_price: float = 0.0
    cost_price: float = 0.0
    on_hand_qty: float = 0.0
    reserved_qty: float = 0.0
    min_stock_level: float = 0.0
    is_bom_item: bool = False
    procure_on_demand: bool = False
    procurement_type: Optional[str] = None
    vendor_id: Optional[str] = None
    bom_id: Optional[int] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    sales_price: Optional[float] = None
    cost_price: Optional[float] = None
    on_hand_qty: Optional[float] = None
    reserved_qty: Optional[float] = None
    min_stock_level: Optional[float] = None
    is_bom_item: Optional[bool] = None
    procure_on_demand: Optional[bool] = None
    procurement_type: Optional[str] = None
    vendor_id: Optional[str] = None
    bom_id: Optional[int] = None

class ProductResponse(ProductBase):
    id: int
    free_to_use_qty: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# Sales Order Line Schemas
class SalesOrderLineBase(BaseModel):
    product_id: int
    quantity: float
    unit_price: float
    delivered_qty: float = 0.0

class SalesOrderLineCreate(SalesOrderLineBase):
    pass

class SalesOrderLineUpdate(BaseModel):
    id: int
    delivered_qty: float

class SalesOrderLineResponse(SalesOrderLineBase):
    id: int
    sales_order_id: int
    total_price: float
    product: Optional[ProductResponse] = None

    model_config = ConfigDict(from_attributes=True)

# Sales Order Schemas
class SalesOrderBase(BaseModel):
    customer_name: str

class SalesOrderCreate(SalesOrderBase):
    lines: List[SalesOrderLineCreate]

class SalesOrderUpdate(BaseModel):
    customer_name: Optional[str] = None
    status: Optional[str] = None
    lines: Optional[List[SalesOrderLineUpdate]] = None

class SalesOrderResponse(SalesOrderBase):
    id: int
    order_date: datetime
    status: str
    total_amount: float
    created_at: datetime
    updated_at: datetime
    lines: List[SalesOrderLineResponse]

    model_config = ConfigDict(from_attributes=True)

# Purchase Order Line Schemas
class PurchaseOrderLineBase(BaseModel):
    product_id: int
    quantity: float
    unit_price: float

class PurchaseOrderLineCreate(PurchaseOrderLineBase):
    pass

class PurchaseOrderLineResponse(PurchaseOrderLineBase):
    id: int
    purchase_order_id: int
    total_price: float
    received_qty: float
    product: Optional[ProductResponse] = None

    model_config = ConfigDict(from_attributes=True)

# Purchase Order Schemas
class PurchaseOrderBase(BaseModel):
    vendor_name: str

class PurchaseOrderCreate(PurchaseOrderBase):
    lines: List[PurchaseOrderLineCreate]

class PurchaseOrderUpdate(BaseModel):
    vendor_name: Optional[str] = None
    status: Optional[str] = None

class PurchaseOrderResponse(PurchaseOrderBase):
    id: int
    order_date: datetime
    status: str
    total_amount: float
    created_at: datetime
    updated_at: datetime
    lines: List[PurchaseOrderLineResponse]

    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderItemReceive(BaseModel):
    product_id: int
    received_qty: float

class PurchaseOrderReceive(BaseModel):
    items: Optional[List[PurchaseOrderItemReceive]] = None

# BoM Component Schemas
class BoMComponentBase(BaseModel):
    component_product_id: int
    quantity: float

class BoMComponentCreate(BoMComponentBase):
    pass

class BoMComponentResponse(BoMComponentBase):
    id: int
    bom_id: int
    component_product: Optional[ProductResponse] = None

    model_config = ConfigDict(from_attributes=True)

# BoM Operation Schemas
class BoMOperationBase(BaseModel):
    sequence: int
    operation_name: str
    work_center: str
    standard_time_minutes: float

class BoMOperationCreate(BoMOperationBase):
    pass

class BoMOperationResponse(BoMOperationBase):
    id: int
    bom_id: int

    model_config = ConfigDict(from_attributes=True)

# BoM Schemas
class BoMBase(BaseModel):
    product_id: int
    name: str
    description: Optional[str] = None

class BoMCreate(BoMBase):
    components: List[BoMComponentCreate]
    operations: List[BoMOperationCreate]

class BoMUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class BoMResponse(BoMBase):
    id: int
    created_at: datetime
    updated_at: datetime
    components: List[BoMComponentResponse]
    operations: List[BoMOperationResponse]

    model_config = ConfigDict(from_attributes=True)

# Manufacturing Order Component Schemas
class ManufacturingOrderComponentResponse(BaseModel):
    id: int
    manufacturing_order_id: int
    component_product_id: int
    required_quantity: float
    consumed_quantity: float
    status: str
    component_product: Optional[ProductResponse] = None

    model_config = ConfigDict(from_attributes=True)

# Manufacturing Order Operation Schemas
class ManufacturingOrderOperationResponse(BaseModel):
    id: int
    manufacturing_order_id: int
    sequence: int
    operation_name: str
    work_center: str
    standard_time_minutes: float
    actual_time_minutes: Optional[float] = None
    status: str

    model_config = ConfigDict(from_attributes=True)

# Manufacturing Order Schemas
class ManufacturingOrderCreate(BaseModel):
    product_id: int
    bom_id: int
    quantity: float

class ManufacturingOrderUpdate(BaseModel):
    status: Optional[str] = None

class ManufacturingOrderResponse(BaseModel):
    id: int
    product_id: int
    bom_id: int
    quantity: float
    status: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    components: List[ManufacturingOrderComponentResponse]
    operations: List[ManufacturingOrderOperationResponse]
    product: Optional[ProductResponse] = None

    model_config = ConfigDict(from_attributes=True)

# Audit Log Schemas
class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    table_name: str
    record_id: Optional[int] = None
    old_values: Optional[str] = None
    new_values: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


# Insights Schemas
class InsightItem(BaseModel):
    severity: str
    category: str
    title: str
    description: str
    impact: str
    recommendation: str
    confidence: int
    required: Optional[float] = None
    available: Optional[float] = None
    shortage: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class InsightsResponse(BaseModel):
    business_health_score: float
    summary: str
    critical_insights: List[InsightItem]
    warnings: List[InsightItem]
    opportunities: List[InsightItem]
    successes: List[InsightItem]

    model_config = ConfigDict(from_attributes=True)
