import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.app.models import (
    AuditLog,
    Product,
)

ENTITY_LABELS: Dict[str, str] = {
    "products": "Product",
    "sales_orders": "Sales Order",
    "sales_order_lines": "Sales Order",
    "purchase_orders": "Purchase Order",
    "purchase_order_lines": "Purchase Order",
    "manufacturing_orders": "Manufacturing Order",
    "manufacturing_order_components": "Manufacturing Order",
    "manufacturing_order_operations": "Manufacturing Order",
    "boms": "Bill of Materials",
    "bom_components": "Bill of Materials",
    "bom_operations": "Bill of Materials",
    "users": "User",
}

ENTITY_TYPE_TABLES: Dict[str, List[str]] = {
    "products": ["products"],
    "sales_orders": ["sales_orders", "sales_order_lines"],
    "purchase_orders": ["purchase_orders", "purchase_order_lines"],
    "manufacturing": ["manufacturing_orders", "manufacturing_order_components", "manufacturing_order_operations"],
    "boms": ["boms", "bom_components", "bom_operations"],
}

FIELD_LABELS: Dict[str, str] = {
    "status": "Status",
    "customer_name": "Customer",
    "vendor_name": "Vendor",
    "quantity": "Quantity",
    "reserved_qty": "Reserved Stock",
    "on_hand_qty": "On Hand Stock",
    "name": "Name",
    "total_amount": "Total Amount",
    "unit_price": "Unit Price",
    "total_price": "Total Price",
    "delivered_qty": "Delivered Quantity",
    "received_qty": "Received Quantity",
    "consumed_quantity": "Consumed Quantity",
    "required_quantity": "Required Quantity",
    "sales_price": "Sales Price",
    "cost_price": "Cost Price",
    "min_stock_level": "Minimum Stock Level",
    "category": "Category",
    "sku": "SKU",
    "description": "Description",
    "operation_name": "Operation",
    "work_center": "Work Center",
    "start_date": "Start Date",
    "end_date": "End Date",
    "order_date": "Order Date",
    "username": "Username",
    "role": "Role",
    "standard_time_minutes": "Standard Time",
    "actual_time_minutes": "Actual Time",
    "sequence": "Sequence",
    "procurement_type": "Procurement Type",
    "procure_on_demand": "Procure on Demand",
    "is_bom_item": "BOM Item",
}

HIDDEN_FIELDS = {"id", "created_at", "updated_at", "password_hash", "user_id", "product_id", "bom_id",
                 "sales_order_id", "purchase_order_id", "manufacturing_order_id", "component_product_id",
                 "bom_id", "record_id"}

STATUS_VERBS: Dict[Tuple[str, str, str], str] = {
    ("sales_orders", "Draft", "Confirmed"): "confirmed",
    ("sales_orders", "Confirmed", "Fully Delivered"): "delivered",
    ("sales_orders", "Confirmed", "Partially Delivered"): "partially delivered",
    ("sales_orders", "Draft", "Cancelled"): "cancelled",
    ("purchase_orders", "Draft", "Confirmed"): "placed",
    ("purchase_orders", "Confirmed", "Fully Received"): "received",
    ("purchase_orders", "Confirmed", "Partially Received"): "partially received",
    ("purchase_orders", "Draft", "Cancelled"): "cancelled",
    ("manufacturing_orders", "Draft", "Planned"): "planned",
    ("manufacturing_orders", "Planned", "In Progress"): "started",
    ("manufacturing_orders", "In Progress", "Completed"): "completed",
    ("manufacturing_orders", "Draft", "Cancelled"): "cancelled",
}


def _parse_json(raw: Optional[str]) -> Dict[str, Any]:
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


def _format_value(field: str, value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if field in ("total_amount", "unit_price", "total_price", "sales_price", "cost_price"):
        return f"₹{float(value):,.2f}"
    if field in ("quantity", "reserved_qty", "on_hand_qty", "delivered_qty", "received_qty",
                 "consumed_quantity", "required_quantity", "min_stock_level"):
        num = float(value)
        return f"{num:,.0f} Units" if num == int(num) else f"{num:,.2f} Units"
    if field in ("start_date", "end_date", "order_date"):
        try:
            if isinstance(value, str):
                dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                return dt.strftime("%b %d, %Y")
        except ValueError:
            pass
    return str(value)


def _display_user(username: Optional[str]) -> str:
    if not username:
        return "System"
    if username == "system_initializer":
        return "System"
    return username.replace("_", " ").title()


def _order_ref(table_name: str, record_id: Optional[int]) -> Optional[str]:
    if not record_id:
        return None
    if table_name == "sales_orders":
        return f"SO-{record_id:04d}"
    if table_name == "purchase_orders":
        return f"PO-{record_id:04d}"
    if table_name == "manufacturing_orders":
        return f"MO-{record_id:04d}"
    return None


def _resolve_product_name(db: Session, product_id: Optional[int], cache: Dict[int, str]) -> Optional[str]:
    if not product_id:
        return None
    if product_id in cache:
        return cache[product_id]
    product = db.query(Product).filter(Product.id == product_id).first()
    name = product.name if product else None
    if name:
        cache[product_id] = name
    return name


def _resolve_entity_context(
    db: Session,
    table_name: str,
    record_id: Optional[int],
    new_values: Dict[str, Any],
    old_values: Dict[str, Any],
    product_cache: Dict[int, str],
) -> Tuple[str, str]:
    """Return (entity_type_label, entity_name_for_headline)."""
    entity_type = ENTITY_LABELS.get(table_name, table_name.replace("_", " ").title())

    if table_name == "products":
        name = new_values.get("name") or old_values.get("name")
        if not name and record_id:
            product = db.query(Product).filter(Product.id == record_id).first()
            name = product.name if product else None
        return entity_type, name or "Product"

    if table_name == "sales_orders":
        ref = _order_ref(table_name, record_id)
        return entity_type, ref or "Sales Order"

    if table_name == "purchase_orders":
        ref = _order_ref(table_name, record_id)
        return entity_type, ref or "Purchase Order"

    if table_name == "manufacturing_orders":
        ref = _order_ref(table_name, record_id)
        product_id = new_values.get("product_id") or old_values.get("product_id")
        product_name = _resolve_product_name(db, product_id, product_cache)
        if ref and product_name:
            return entity_type, f"{ref} ({product_name})"
        return entity_type, ref or "Manufacturing Order"

    if table_name == "sales_order_lines":
        so_id = new_values.get("sales_order_id") or old_values.get("sales_order_id")
        ref = f"SO-{so_id:04d}" if so_id else "Sales Order"
        product_id = new_values.get("product_id") or old_values.get("product_id")
        product_name = _resolve_product_name(db, product_id, product_cache)
        if product_name:
            return entity_type, f"{ref} — {product_name}"
        return entity_type, ref

    if table_name == "purchase_order_lines":
        po_id = new_values.get("purchase_order_id") or old_values.get("purchase_order_id")
        ref = f"PO-{po_id:04d}" if po_id else "Purchase Order"
        product_id = new_values.get("product_id") or old_values.get("product_id")
        product_name = _resolve_product_name(db, product_id, product_cache)
        if product_name:
            return entity_type, f"{ref} — {product_name}"
        return entity_type, ref

    if table_name == "boms":
        name = new_values.get("name") or old_values.get("name")
        return entity_type, name or "Bill of Materials"

    if table_name == "users":
        username = new_values.get("username") or old_values.get("username")
        return entity_type, username or "User"

    return entity_type, entity_type


def _build_changes(
    action: str,
    old_values: Dict[str, Any],
    new_values: Dict[str, Any],
) -> List[Dict[str, Optional[str]]]:
    changes: List[Dict[str, Optional[str]]] = []

    if action == "INSERT":
        for field, value in new_values.items():
            if field in HIDDEN_FIELDS or value is None:
                continue
            changes.append({
                "label": FIELD_LABELS.get(field, field.replace("_", " ").title()),
                "before": None,
                "after": _format_value(field, value),
            })
    elif action == "UPDATE":
        for field in set(old_values.keys()) | set(new_values.keys()):
            if field in HIDDEN_FIELDS:
                continue
            old_val = old_values.get(field)
            new_val = new_values.get(field)
            if old_val == new_val:
                continue
            changes.append({
                "label": FIELD_LABELS.get(field, field.replace("_", " ").title()),
                "before": _format_value(field, old_val) if old_val is not None else None,
                "after": _format_value(field, new_val) if new_val is not None else None,
            })
    elif action == "DELETE":
        for field, value in old_values.items():
            if field in HIDDEN_FIELDS or value is None:
                continue
            changes.append({
                "label": FIELD_LABELS.get(field, field.replace("_", " ").title()),
                "before": _format_value(field, value),
                "after": None,
            })

    return changes


def _build_headline(
    action: str,
    table_name: str,
    user: str,
    entity_name: str,
    old_values: Dict[str, Any],
    new_values: Dict[str, Any],
) -> str:
    if action == "INSERT":
        if table_name == "products":
            return f"{user} added {entity_name}"
        if table_name in ("sales_orders", "purchase_orders", "manufacturing_orders"):
            verb = "created"
            label = ENTITY_LABELS.get(table_name, "record")
            return f"{user} {verb} {label} {entity_name}"
        if table_name in ("sales_order_lines", "purchase_order_lines"):
            return f"{user} added a line to {entity_name.split(' — ')[0]}"
        if table_name == "boms":
            return f"{user} created Bill of Materials for {entity_name}"
        if table_name == "users":
            return f"{user} created user account {entity_name}"
        return f"{user} created {entity_name}"

    if action == "DELETE":
        label = ENTITY_LABELS.get(table_name, "record")
        return f"{user} removed {label} {entity_name}"

    if action == "UPDATE":
        if table_name == "products" and "reserved_qty" in new_values:
            old_reserved = old_values.get("reserved_qty", 0) or 0
            new_reserved = new_values.get("reserved_qty", 0) or 0
            if new_reserved > old_reserved:
                return f"Inventory reserved for {entity_name}"
            if new_reserved < old_reserved:
                return f"Inventory reservation released for {entity_name}"

        if table_name == "products" and "on_hand_qty" in new_values and "reserved_qty" not in new_values:
            return f"Stock updated for {entity_name}"

        if "status" in new_values:
            old_status = old_values.get("status", "")
            new_status = new_values.get("status", "")
            verb = STATUS_VERBS.get((table_name, old_status, new_status))
            if verb:
                label = ENTITY_LABELS.get(table_name, "record")
                return f"{user} {verb} {label} {entity_name}"

        label = ENTITY_LABELS.get(table_name, "record")
        return f"{user} updated {label} {entity_name}"

    return f"{user} modified {entity_name}"


def transform_audit_log(db: Session, log: AuditLog, product_cache: Dict[int, str]) -> Dict[str, Any]:
    old_values = _parse_json(log.old_values)
    new_values = _parse_json(log.new_values)
    user = _display_user(log.username)
    entity_type, entity_name = _resolve_entity_context(
        db, log.table_name, log.record_id, new_values, old_values, product_cache
    )
    headline = _build_headline(log.action, log.table_name, user, entity_name, old_values, new_values)
    changes = _build_changes(log.action, old_values, new_values)

    return {
        "id": log.id,
        "timestamp": log.timestamp,
        "user": user,
        "headline": headline,
        "entity_type": entity_type,
        "entity_name": entity_name,
        "action": log.action,
        "changes": changes,
    }


def transform_audit_logs(db: Session, logs: List[AuditLog]) -> List[Dict[str, Any]]:
    product_cache: Dict[int, str] = {}
    return [transform_audit_log(db, log, product_cache) for log in logs]
