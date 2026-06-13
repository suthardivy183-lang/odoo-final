from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, event, inspect
from sqlalchemy.orm import relationship, Mapper
import json

from backend.app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin, sales, purchase, inventory, production

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    category = Column(String, nullable=False)  # "Raw Material" or "Finished Good"
    price = Column(Float, default=0.0, nullable=False)
    stock = Column(Float, default=0.0, nullable=False)
    min_stock_level = Column(Float, default=0.0, nullable=False)
    is_bom_item = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to BoM (a finished good can have one BoM)
    bom = relationship("BoM", back_populates="product", uselist=False)

class SalesOrder(Base):
    __tablename__ = "sales_orders"
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    order_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String, default="Draft", nullable=False)  # Draft, Confirmed, Completed, Cancelled
    total_amount = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lines = relationship("SalesOrderLine", back_populates="sales_order", cascade="all, delete-orphan")

class SalesOrderLine(Base):
    __tablename__ = "sales_order_lines"
    id = Column(Integer, primary_key=True, index=True)
    sales_order_id = Column(Integer, ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    sales_order = relationship("SalesOrder", back_populates="lines")
    product = relationship("Product")

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    id = Column(Integer, primary_key=True, index=True)
    vendor_name = Column(String, nullable=False)
    order_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String, default="Draft", nullable=False)  # Draft, Ordered, Received, Cancelled
    total_amount = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lines = relationship("PurchaseOrderLine", back_populates="purchase_order", cascade="all, delete-orphan")

class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"
    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    unit_price = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)

    purchase_order = relationship("PurchaseOrder", back_populates="lines")
    product = relationship("Product")

class BoM(Base):
    __tablename__ = "boms"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), unique=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="bom")
    components = relationship("BoMComponent", back_populates="bom", cascade="all, delete-orphan")
    operations = relationship("BoMOperation", back_populates="bom", cascade="all, delete-orphan")

class BoMComponent(Base):
    __tablename__ = "bom_components"
    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
    component_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Float, nullable=False)  # Quantity required per unit of finished good

    bom = relationship("BoM", back_populates="components")
    component_product = relationship("Product")

class BoMOperation(Base):
    __tablename__ = "bom_operations"
    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
    sequence = Column(Integer, nullable=False)  # 10, 20, 30 etc.
    operation_name = Column(String, nullable=False)  # e.g., Cutting, Assembly, Polishing
    work_center = Column(String, nullable=False)
    standard_time_minutes = Column(Float, nullable=False)

    bom = relationship("BoM", back_populates="operations")

class ManufacturingOrder(Base):
    __tablename__ = "manufacturing_orders"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    bom_id = Column(Integer, ForeignKey("boms.id"), nullable=False)
    quantity = Column(Float, nullable=False)
    status = Column(String, default="Draft", nullable=False)  # Draft, Planned, In Progress, Completed, Cancelled
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product")
    bom = relationship("BoM")
    components = relationship("ManufacturingOrderComponent", back_populates="manufacturing_order", cascade="all, delete-orphan")
    operations = relationship("ManufacturingOrderOperation", back_populates="manufacturing_order", cascade="all, delete-orphan")

class ManufacturingOrderComponent(Base):
    __tablename__ = "manufacturing_order_components"
    id = Column(Integer, primary_key=True, index=True)
    manufacturing_order_id = Column(Integer, ForeignKey("manufacturing_orders.id"), nullable=False)
    component_product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    required_quantity = Column(Float, nullable=False)
    consumed_quantity = Column(Float, default=0.0, nullable=False)
    status = Column(String, default="Pending", nullable=False)  # Pending, Consumed

    manufacturing_order = relationship("ManufacturingOrder", back_populates="components")
    component_product = relationship("Product")

class ManufacturingOrderOperation(Base):
    __tablename__ = "manufacturing_order_operations"
    id = Column(Integer, primary_key=True, index=True)
    manufacturing_order_id = Column(Integer, ForeignKey("manufacturing_orders.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    operation_name = Column(String, nullable=False)
    work_center = Column(String, nullable=False)
    standard_time_minutes = Column(Float, nullable=False)
    actual_time_minutes = Column(Float, nullable=True)
    status = Column(String, default="Pending", nullable=False)  # Pending, In Progress, Completed

    manufacturing_order = relationship("ManufacturingOrder", back_populates="operations")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String, nullable=True)
    action = Column(String, nullable=False)  # INSERT, UPDATE, DELETE
    table_name = Column(String, nullable=False)
    record_id = Column(Integer, nullable=True)
    old_values = Column(Text, nullable=True)  # JSON String
    new_values = Column(Text, nullable=True)  # JSON String
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

# Automatic Audit Logging Listeners

@event.listens_for(Mapper, "after_insert")
def audit_after_insert(mapper, connection, target):
    if target.__tablename__ == "audit_logs":
        return

    state = inspect(target)
    new_values = {}
    for col in state.mapper.columns:
        val = getattr(target, col.key)
        if val is not None:
            if isinstance(val, (int, float, bool, str)):
                new_values[col.key] = val
            else:
                new_values[col.key] = str(val)
        else:
            new_values[col.key] = None

    from backend.app.utils.context import current_user_id, current_username
    uid = current_user_id.get(None)
    uname = current_username.get(None)

    connection.execute(
        AuditLog.__table__.insert().values(
            user_id=uid,
            username=uname,
            action="INSERT",
            table_name=target.__tablename__,
            record_id=getattr(target, "id", None),
            old_values=None,
            new_values=json.dumps(new_values),
            timestamp=datetime.utcnow()
        )
    )

@event.listens_for(Mapper, "after_update")
def audit_after_update(mapper, connection, target):
    if target.__tablename__ == "audit_logs":
        return

    state = inspect(target)
    old_values = {}
    new_values = {}
    for col in state.mapper.columns:
        attr = state.attrs[col.key]
        hist = attr.history
        if hist.has_changes():
            old_val = hist.deleted[0] if hist.deleted else None
            new_val = attr.value

            if old_val is not None:
                if isinstance(old_val, (int, float, bool, str)):
                    old_values[col.key] = old_val
                else:
                    old_values[col.key] = str(old_val)
            else:
                old_values[col.key] = None

            if new_val is not None:
                if isinstance(new_val, (int, float, bool, str)):
                    new_values[col.key] = new_val
                else:
                    new_values[col.key] = str(new_val)
            else:
                new_values[col.key] = None

    if not old_values and not new_values:
        return

    from backend.app.utils.context import current_user_id, current_username
    uid = current_user_id.get(None)
    uname = current_username.get(None)

    connection.execute(
        AuditLog.__table__.insert().values(
            user_id=uid,
            username=uname,
            action="UPDATE",
            table_name=target.__tablename__,
            record_id=getattr(target, "id", None),
            old_values=json.dumps(old_values),
            new_values=json.dumps(new_values),
            timestamp=datetime.utcnow()
        )
    )

@event.listens_for(Mapper, "after_delete")
def audit_after_delete(mapper, connection, target):
    if target.__tablename__ == "audit_logs":
        return

    state = inspect(target)
    old_values = {}
    for col in state.mapper.columns:
        val = getattr(target, col.key)
        if val is not None:
            if isinstance(val, (int, float, bool, str)):
                old_values[col.key] = val
            else:
                old_values[col.key] = str(val)
        else:
            old_values[col.key] = None

    from backend.app.utils.context import current_user_id, current_username
    uid = current_user_id.get(None)
    uname = current_username.get(None)

    connection.execute(
        AuditLog.__table__.insert().values(
            user_id=uid,
            username=uname,
            action="DELETE",
            table_name=target.__tablename__,
            record_id=getattr(target, "id", None),
            old_values=json.dumps(old_values),
            new_values=None,
            timestamp=datetime.utcnow()
        )
    )
