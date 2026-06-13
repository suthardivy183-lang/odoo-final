import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  SalesOrder,
  PurchaseOrder,
  ManufacturingOrder,
  BillOfMaterials,
  AuditLog,
  DashboardStats,
  InsightsResponse,
} from "@/lib/types";

/* ── Sales ─────────────────────────────────────────────────────────────── */
export function useSalesOrders() {
  return useQuery({
    queryKey: ["sales"],
    queryFn: async () => (await api.get<SalesOrder[]>("/sales-orders")).data,
  });
}
export function useSalesOrder(id?: number) {
  return useQuery({
    queryKey: ["sales", id],
    queryFn: async () => (await api.get<SalesOrder>(`/sales-orders/${id}`)).data,
    enabled: !!id,
  });
}
export function useSalesActions() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["purchase"] });
    qc.invalidateQueries({ queryKey: ["manufacturing"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post("/sales-orders", b)).data, onSuccess: inval }),
    update: useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.put(`/sales-orders/${id}`, b)).data, onSuccess: inval }),
    confirm: useMutation({ mutationFn: async (id: number) => (await api.post(`/sales-orders/${id}/confirm`)).data, onSuccess: inval }),
    deliver: useMutation({ mutationFn: async (id: number) => (await api.post(`/sales-orders/${id}/deliver`)).data, onSuccess: inval }),
    cancel: useMutation({ mutationFn: async (id: number) => (await api.post(`/sales-orders/${id}/cancel`)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/sales-orders/${id}`), onSuccess: inval }),
  };
}

/* ── Purchase ──────────────────────────────────────────────────────────── */
export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase"],
    queryFn: async () => (await api.get<PurchaseOrder[]>("/purchase-orders")).data,
  });
}
export function usePurchaseActions() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["purchase"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post("/purchase-orders", b)).data, onSuccess: inval }),
    update: useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.put(`/purchase-orders/${id}`, b)).data, onSuccess: inval }),
    confirm: useMutation({ mutationFn: async (id: number) => (await api.post(`/purchase-orders/${id}/confirm`)).data, onSuccess: inval }),
    // items: [{product_id, received_qty}]
    receive: useMutation({ mutationFn: async ({ id, items }: { id: number; items: { product_id: number; received_qty: number }[] }) => (await api.post(`/purchase-orders/${id}/receive`, { items })).data, onSuccess: inval }),
    cancel: useMutation({ mutationFn: async (id: number) => (await api.post(`/purchase-orders/${id}/cancel`)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/purchase-orders/${id}`), onSuccess: inval }),
  };
}

/* ── Manufacturing ─────────────────────────────────────────────────────── */
export function useManufacturingOrders() {
  return useQuery({
    queryKey: ["manufacturing"],
    queryFn: async () => (await api.get<ManufacturingOrder[]>("/manufacturing")).data,
  });
}
export function useManufacturingActions() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["manufacturing"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post("/manufacturing", b)).data, onSuccess: inval }),
    confirm: useMutation({ mutationFn: async (id: number) => (await api.post(`/manufacturing/${id}/confirm`)).data, onSuccess: inval }),
    start: useMutation({ mutationFn: async (id: number) => (await api.post(`/manufacturing/${id}/start`)).data, onSuccess: inval }),
    produce: useMutation({ mutationFn: async (id: number) => (await api.post(`/manufacturing/${id}/produce`)).data, onSuccess: inval }),
    cancel: useMutation({ mutationFn: async (id: number) => (await api.post(`/manufacturing/${id}/cancel`)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/manufacturing/${id}`), onSuccess: inval }),
  };
}

/* ── BoM ───────────────────────────────────────────────────────────────── */
export function useBoms() {
  return useQuery({
    queryKey: ["bom"],
    queryFn: async () => (await api.get<BillOfMaterials[]>("/boms")).data,
  });
}
export function useBomActions() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ["bom"] });
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post("/boms", b)).data, onSuccess: inval }),
    update: useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.put(`/boms/${id}`, b)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/boms/${id}`), onSuccess: inval }),
  };
}

/* ── Audit + Dashboard ─────────────────────────────────────────────────── */
export function useAuditLogs(filters: { table_name?: string; action?: string } = {}) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: async () => (await api.get<AuditLog[]>("/audit-logs", { params: filters })).data,
  });
}
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardStats>("/dashboard")).data,
  });
}

export function useInsights(enabled: boolean = true) {
  return useQuery({
    queryKey: ["insights"],
    queryFn: async () => (await api.get<InsightsResponse>("/insights")).data,
    enabled,
  });
}
