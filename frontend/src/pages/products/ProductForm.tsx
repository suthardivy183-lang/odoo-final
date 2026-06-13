import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveProduct } from "@/hooks/useProducts";
import type { Product } from "@/lib/types";

export function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const save = useSaveProduct();
  const [form, setForm] = React.useState({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    category: product?.category ?? "Raw Material",
    sales_price: product?.sales_price ?? 0,
    cost_price: product?.cost_price ?? 0,
    on_hand_qty: product?.on_hand_qty ?? 0,
    min_stock_level: product?.min_stock_level ?? 0,
    vendor_id: product?.vendor_id ?? "",
    is_bom_item: product?.is_bom_item ?? false,
    procure_on_demand: product?.procure_on_demand ?? false,
    procurement_type: product?.procurement_type ?? "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({
      ...(product ? { id: product.id } : {}),
      ...form,
      vendor_id: form.vendor_id || null,
      procurement_type: form.procurement_type || null,
    } as any);
    onClose();
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader>
        <DialogTitle>{product ? "Edit Product" : "New Product"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>SKU *</Label>
            <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="Raw Material">Raw Material</option>
              <option value="Finished Good">Finished Good</option>
              <option value="Semi-Finished">Semi-Finished</option>
              <option value="Consumable">Consumable</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Vendor Name</Label>
            <Input value={form.vendor_id ?? ""} onChange={(e) => set("vendor_id", e.target.value)} placeholder="e.g. WoodSupplierInc" />
          </div>
          <div className="space-y-1.5">
            <Label>Sales Price (₹)</Label>
            <Input type="number" step="0.01" value={form.sales_price} onChange={(e) => set("sales_price", parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cost Price (₹)</Label>
            <Input type="number" step="0.01" value={form.cost_price} onChange={(e) => set("cost_price", parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>On Hand Qty</Label>
            <Input type="number" step="0.001" value={form.on_hand_qty} onChange={(e) => set("on_hand_qty", parseFloat(e.target.value) || 0)} disabled={!!product} />
            {product && <p className="text-xs text-muted-foreground">Updated via receipts/production</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Min Stock Level</Label>
            <Input type="number" step="0.001" value={form.min_stock_level} onChange={(e) => set("min_stock_level", parseFloat(e.target.value) || 0)} />
          </div>
        </div>

        <div className="rounded-md border p-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.is_bom_item} onChange={(e) => set("is_bom_item", e.target.checked)} />
            Has Bill of Materials (manufactured product)
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.procure_on_demand} onChange={(e) => set("procure_on_demand", e.target.checked)} />
            Procure on Demand (auto-create PO/MO when stock is short)
          </label>
          {form.procure_on_demand && (
            <div className="space-y-1.5">
              <Label>Procurement Method</Label>
              <Select value={form.procurement_type ?? ""} onChange={(e) => set("procurement_type", e.target.value || null)}>
                <option value="">— Select —</option>
                <option value="purchase">Buy (Purchase Order)</option>
                <option value="manufacturing">Manufacture (Mfg Order)</option>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
