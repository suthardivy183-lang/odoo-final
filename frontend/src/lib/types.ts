export type Role = "admin" | "sales" | "purchase" | "inventory" | "production";

export interface User {
  id: number;
  username: string;
  role: Role;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  sales_price: number;
  cost_price: number;
  on_hand_qty: number;
  reserved_qty: number;
  free_to_use_qty: number;
  min_stock_level: number;
  is_bom_item: boolean;
  procure_on_demand: boolean;
  procurement_type: string | null;
  vendor_id: string | null;
  bom_id: number | null;
  created_at: string;
  updated_at: string;
}

export type SOStatus = "Draft" | "Confirmed" | "Partially Delivered" | "Fully Delivered" | "Cancelled";

export interface SalesOrderLine {
  id: number;
  sales_order_id: number;
  product_id: number;
  quantity: number;
  delivered_qty: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface SalesOrder {
  id: number;
  customer_name: string;
  status: SOStatus;
  order_date: string;
  total_amount: number;
  lines: SalesOrderLine[];
}

export type POStatus = "Draft" | "Confirmed" | "Partially Received" | "Fully Received" | "Cancelled";

export interface PurchaseOrderLine {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity: number;
  received_qty: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface PurchaseOrder {
  id: number;
  vendor_name: string;
  status: POStatus;
  order_date: string;
  total_amount: number;
  lines: PurchaseOrderLine[];
}

export interface BoMComponent {
  id: number;
  bom_id: number;
  component_product_id: number;
  quantity: number;
  component_product?: Product;
}

export interface BoMOperation {
  id: number;
  bom_id: number;
  sequence: number;
  operation_name: string;
  work_center: string;
  standard_time_minutes: number;
}

export interface BillOfMaterials {
  id: number;
  product_id: number;
  name: string;
  description: string | null;
  components: BoMComponent[];
  operations: BoMOperation[];
}

export type MOStatus = "Draft" | "Planned" | "In Progress" | "Completed" | "Cancelled";

export interface ManufacturingOrderComponent {
  id: number;
  component_product_id: number;
  required_quantity: number;
  consumed_quantity: number;
  status: string;
  component_product?: Product;
}

export interface ManufacturingOrder {
  id: number;
  product_id: number;
  bom_id: number;
  quantity: number;
  status: MOStatus;
  start_date: string | null;
  end_date: string | null;
  components: ManufacturingOrderComponent[];
  operations: BoMOperation[];
  product?: Product;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  user_id: number | null;
  username: string | null;
  action: string;
  table_name: string;
  record_id: number | null;
  old_values: string | null;
  new_values: string | null;
}

export interface DashboardStats {
  products: {
    total: number;
    finished_goods: number;
    raw_materials: number;
    low_stock_alerts: number;
    total_valuation: number;
  };
  sales_orders: { draft: number; confirmed: number; completed: number; total: number };
  purchase_orders: { draft: number; ordered: number; received: number; total: number };
  manufacturing_orders: { draft: number; planned: number; in_progress: number; completed: number; total: number };
}

export interface InsightItem {
  severity: "critical" | "warning" | "info" | "success";
  category: string;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  confidence: number;
  required?: number;
  available?: number;
  shortage?: number;
}

export interface InsightsResponse {
  business_health_score: number;
  summary: string;
  critical_insights: InsightItem[];
  warnings: InsightItem[];
  opportunities: InsightItem[];
  successes: InsightItem[];
}
