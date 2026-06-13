import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Product, Vendor } from "@/lib/types";

export function useProducts(search = "") {
  return useQuery({
    queryKey: ["products", search],
    queryFn: async () => (await api.get<Product[]>("/products", { params: { search } })).data,
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async () => (await api.get<Vendor[]>("/vendors")).data,
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<Product> & { id?: number }) => {
      if (p.id) return (await api.patch<Product>(`/products/${p.id}`, p)).data;
      return (await api.post<Product>("/products", p)).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}
