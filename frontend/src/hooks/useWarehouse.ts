import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Warehouse,
  Aisle,
  Rack,
  Shelf,
  StockAllocation,
  WarehouseActivity,
} from "@/lib/types";

// --- Warehouse CRUD ---

export function useWarehouses() {
  return useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await api.get<Warehouse[]>("/warehouses")).data,
  });
}

export function useWarehouse(id: number | undefined) {
  return useQuery({
    queryKey: ["warehouses", id],
    queryFn: async () => {
      if (!id) return null;
      return (await api.get<Warehouse>(`/warehouses/${id}`)).data;
    },
    enabled: !!id,
  });
}

export function useSaveWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (w: Partial<Warehouse> & { id?: number; name: string; location?: string | null }) => {
      if (w.id) {
        return (await api.put<Warehouse>(`/warehouses/${w.id}`, w)).data;
      }
      return (await api.post<Warehouse>("/warehouses", w)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/warehouses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });
}

// --- Aisle CRUD ---

export function useAisles(warehouseId?: number) {
  return useQuery({
    queryKey: ["aisles", warehouseId],
    queryFn: async () => {
      const params = warehouseId !== undefined ? { warehouse_id: warehouseId } : {};
      return (await api.get<Aisle[]>("/aisles", { params })).data;
    },
  });
}

export function useSaveAisle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<Aisle> & { id?: number; warehouse_id: number; name: string }) => {
      if (a.id) {
        return (await api.put<Aisle>(`/aisles/${a.id}`, a)).data;
      }
      return (await api.post<Aisle>("/aisles", a)).data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["aisles"] });
      qc.invalidateQueries({ queryKey: ["aisles", variables.warehouse_id] });
    },
  });
}

export function useDeleteAisle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, warehouseId }: { id: number; warehouseId?: number }) => {
      await api.delete(`/aisles/${id}`);
      return { warehouseId };
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["aisles"] });
      if (variables.warehouseId) {
        qc.invalidateQueries({ queryKey: ["aisles", variables.warehouseId] });
      }
    },
  });
}

// --- Rack CRUD ---

export function useRacks(aisleId?: number) {
  return useQuery({
    queryKey: ["racks", aisleId],
    queryFn: async () => {
      const params = aisleId !== undefined ? { aisle_id: aisleId } : {};
      return (await api.get<Rack[]>("/racks", { params })).data;
    },
  });
}

export function useSaveRack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: Partial<Rack> & { id?: number; aisle_id: number; name: string }) => {
      if (r.id) {
        return (await api.put<Rack>(`/racks/${r.id}`, r)).data;
      }
      return (await api.post<Rack>("/racks", r)).data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["racks"] });
      qc.invalidateQueries({ queryKey: ["racks", variables.aisle_id] });
    },
  });
}

export function useDeleteRack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aisleId }: { id: number; aisleId?: number }) => {
      await api.delete(`/racks/${id}`);
      return { aisleId };
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["racks"] });
      if (variables.aisleId) {
        qc.invalidateQueries({ queryKey: ["racks", variables.aisleId] });
      }
    },
  });
}

// --- Shelf CRUD ---

export function useShelves(rackId?: number) {
  return useQuery({
    queryKey: ["shelves", rackId],
    queryFn: async () => {
      const params = rackId !== undefined ? { rack_id: rackId } : {};
      return (await api.get<Shelf[]>("/shelves", { params })).data;
    },
  });
}

export function useShelf(id: number | undefined) {
  return useQuery({
    queryKey: ["shelves", "detail", id],
    queryFn: async () => {
      if (!id) return null;
      return (await api.get<Shelf>(`/shelves/${id}`)).data;
    },
    enabled: !!id,
  });
}

export function useSaveShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<Shelf> & { id?: number; rack_id: number; name: string }) => {
      if (s.id) {
        return (await api.put<Shelf>(`/shelves/${s.id}`, s)).data;
      }
      return (await api.post<Shelf>("/shelves", s)).data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["shelves", variables.rack_id] });
    },
  });
}

export function useDeleteShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rackId }: { id: number; rackId?: number }) => {
      await api.delete(`/shelves/${id}`);
      return { rackId };
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      if (variables.rackId) {
        qc.invalidateQueries({ queryKey: ["shelves", variables.rackId] });
      }
    },
  });
}

// --- Stock Allocations & Transfers ---

export function useAllocateStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { product_id: number; shelf_id: number; quantity: number }) => {
      return (await api.post<StockAllocation>("/warehouse/allocate", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["warehouseActivities"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      product_id: number;
      source_shelf_id: number;
      target_shelf_id: number;
      quantity: number;
    }) => {
      return (await api.post<{ message: string }>("/warehouse/transfer", payload)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["warehouseActivities"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useWarehouseActivities() {
  return useQuery({
    queryKey: ["warehouseActivities"],
    queryFn: async () => (await api.get<WarehouseActivity[]>("/warehouse/activity")).data,
  });
}
