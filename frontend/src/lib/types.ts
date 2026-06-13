/**
 * Frontend-side mirror of the backend API contract (Track A).
 * Once the backend is running, `npm run generate-api` will emit
 * src/api/schema.d.ts from /openapi.json — prefer those generated
 * types over these hand-written ones where they overlap.
 */

export type Role = "admin" | "user";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export type ProductType = "storable" | "consumable" | "service";
export type ProcureMethod = "buy" | "manufacture";

export interface Product {
  id: number;
  internal_ref: string | null;
  name: string;
  product_type: ProductType;
  uom: string;
  sales_price: string;
  cost: string;
  on_hand_qty: string;
  reserved_qty: string;
  free_to_use_qty: string;
  vendor_id: number | null;
  procure_on_demand: boolean;
  procure_method: ProcureMethod | null;
  min_order_qty: string;
  notes: string | null;
}

export interface Vendor {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export type SOStatus =
  | "draft"
  | "confirmed"
  | "partially_delivered"
  | "fully_delivered"
  | "cancelled";

export interface SalesOrderLine {
  id: number;
  product_id: number;
  ordered_qty: string;
  delivered_qty: string;
  unit_price: string;
}

export interface SalesOrder {
  id: number;
  name: string;
  customer_name: string;
  customer_email: string | null;
  status: SOStatus;
  order_date: string;
  expected_delivery: string | null;
  notes: string | null;
  lines: SalesOrderLine[];
}

export type POStatus =
  | "draft"
  | "confirmed"
  | "partially_received"
  | "fully_received"
  | "cancelled";

export interface PurchaseOrderLine {
  id: number;
  product_id: number;
  ordered_qty: string;
  received_qty: string;
  unit_price: string;
}

export interface PurchaseOrder {
  id: number;
  name: string;
  vendor_id: number | null;
  status: POStatus;
  order_date: string;
  expected_receipt: string | null;
  notes: string | null;
  lines: PurchaseOrderLine[];
}

export interface BOMComponent {
  id: number;
  product_id: number;
  qty: string;
}

export interface BillOfMaterials {
  id: number;
  name: string;
  product_id: number;
  qty_produced: string;
  notes: string | null;
  components: BOMComponent[];
}

export type MOStatus = "draft" | "confirmed" | "in_progress" | "done" | "cancelled";

export interface ManufacturingOrder {
  id: number;
  name: string;
  product_id: number;
  bom_id: number | null;
  qty_to_produce: string;
  qty_produced: string;
  status: MOStatus;
  scheduled_date: string | null;
  notes: string | null;
}

export type AuditAction = "create" | "update" | "delete";

export interface AuditLog {
  id: number;
  timestamp: string;
  user_id: number | null;
  module: string;
  record_type: string;
  record_id: number | null;
  action: AuditAction;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
}

export interface DashboardStats {
  sales: Record<string, number>;
  purchase: Record<string, number>;
  manufacturing: Record<string, number>;
}
