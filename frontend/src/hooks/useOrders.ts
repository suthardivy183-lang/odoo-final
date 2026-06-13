import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  SalesOrder,
  PurchaseOrder,
  ManufacturingOrder,
  BillOfMaterials,
  AuditLog,
  DashboardStats,
} from "@/lib/types";

/* ── Sales ─────────────────────────────────────────────────────────────── */
export function useSalesOrders() {
  return useQuery({
    queryKey: ["sales"],
    queryFn: async () => (await api.get<SalesOrder[]>("/sales")).data,
  });
}
export function useSalesOrder(id?: number) {
  return useQuery({
    queryKey: ["sales", id],
    queryFn: async () => (await api.get<SalesOrder>(`/sales/${id}`)).data,
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
  };
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post("/sales", b)).data, onSuccess: inval }),
    update: useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.patch(`/sales/${id}`, b)).data, onSuccess: inval }),
    confirm: useMutation({ mutationFn: async (id: number) => (await api.post(`/sales/${id}/confirm`)).data, onSuccess: inval }),
    deliver: useMutation({ mutationFn: async ({ id, lines }: any) => (await api.post(`/sales/${id}/deliver`, { lines })).data, onSuccess: inval }),
    cancel: useMutation({ mutationFn: async (id: number) => (await api.post(`/sales/${id}/cancel`)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/sales/${id}`), onSuccess: inval }),
  };
}

/* ── Purchase ──────────────────────────────────────────────────────────── */
export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase"],
    queryFn: async () => (await api.get<PurchaseOrder[]>("/purchase")).data,
  });
}
export function usePurchaseActions() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ["purchase"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post("/purchase", b)).data, onSuccess: inval }),
    update: useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.patch(`/purchase/${id}`, b)).data, onSuccess: inval }),
    confirm: useMutation({ mutationFn: async (id: number) => (await api.post(`/purchase/${id}/confirm`)).data, onSuccess: inval }),
    receive: useMutation({ mutationFn: async ({ id, lines }: any) => (await api.post(`/purchase/${id}/receive`, { lines })).data, onSuccess: inval }),
    cancel: useMutation({ mutationFn: async (id: number) => (await api.post(`/purchase/${id}/cancel`)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/purchase/${id}`), onSuccess: inval }),
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
  };
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post("/manufacturing", b)).data, onSuccess: inval }),
    update: useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.patch(`/manufacturing/${id}`, b)).data, onSuccess: inval }),
    confirm: useMutation({ mutationFn: async (id: number) => (await api.post(`/manufacturing/${id}/confirm`)).data, onSuccess: inval }),
    produce: useMutation({ mutationFn: async ({ id, qty }: any) => (await api.post(`/manufacturing/${id}/produce`, { qty })).data, onSuccess: inval }),
    cancel: useMutation({ mutationFn: async (id: number) => (await api.post(`/manufacturing/${id}/cancel`)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/manufacturing/${id}`), onSuccess: inval }),
  };
}

/* ── BoM ───────────────────────────────────────────────────────────────── */
export function useBoms() {
  return useQuery({
    queryKey: ["bom"],
    queryFn: async () => (await api.get<BillOfMaterials[]>("/bom")).data,
  });
}
export function useBomActions() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ["bom"] });
  return {
    create: useMutation({ mutationFn: async (b: any) => (await api.post("/bom", b)).data, onSuccess: inval }),
    update: useMutation({ mutationFn: async ({ id, ...b }: any) => (await api.patch(`/bom/${id}`, b)).data, onSuccess: inval }),
    remove: useMutation({ mutationFn: async (id: number) => api.delete(`/bom/${id}`), onSuccess: inval }),
  };
}

/* ── Audit + Dashboard ─────────────────────────────────────────────────── */
export function useAuditLogs(filters: { module?: string; action?: string } = {}) {
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
