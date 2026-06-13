import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveProduct, useVendors } from "@/hooks/useProducts";
import type { Product } from "@/lib/types";

export function ProductForm({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data: vendors } = useVendors();
  const save = useSaveProduct();
  const [form, setForm] = React.useState({
    internal_ref: product?.internal_ref ?? "",
    name: product?.name ?? "",
    product_type: product?.product_type ?? "storable",
    uom: product?.uom ?? "Units",
    sales_price: product?.sales_price ?? "0.00",
    cost: product?.cost ?? "0.00",
    on_hand_qty: product?.on_hand_qty ?? "0.000",
    vendor_id: product?.vendor_id ?? null,
    procure_on_demand: product?.procure_on_demand ?? false,
    procure_method: product?.procure_method ?? null,
    min_order_qty: product?.min_order_qty ?? "1.000",
    notes: product?.notes ?? "",
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await save.mutateAsync({ ...(product ? { id: product.id } : {}), ...form } as any);
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
            <Label>Internal Reference</Label>
            <Input value={form.internal_ref} onChange={(e) => set("internal_ref", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.product_type} onChange={(e) => set("product_type", e.target.value)}>
              <option value="storable">Storable</option>
              <option value="consumable">Consumable</option>
              <option value="service">Service</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Unit of Measure</Label>
            <Input value={form.uom} onChange={(e) => set("uom", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Sales Price</Label>
            <Input type="number" step="0.01" value={form.sales_price} onChange={(e) => set("sales_price", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Cost</Label>
            <Input type="number" step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>On Hand Qty</Label>
            <Input type="number" step="0.001" value={form.on_hand_qty} onChange={(e) => set("on_hand_qty", e.target.value)} disabled={!!product} />
            {product && <p className="text-xs text-muted-foreground">Stock changes via receipts/production</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Select value={form.vendor_id ?? ""} onChange={(e) => set("vendor_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">— None —</option>
              {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </div>
        </div>

        <div className="rounded-md border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={form.procure_on_demand} onChange={(e) => set("procure_on_demand", e.target.checked)} />
            Procure on Demand (auto-create PO/MO when stock is short)
          </label>
          {form.procure_on_demand && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Procure Method</Label>
                <Select value={form.procure_method ?? ""} onChange={(e) => set("procure_method", e.target.value || null)}>
                  <option value="">— Select —</option>
                  <option value="buy">Buy (Purchase Order)</option>
                  <option value="manufacture">Manufacture (Mfg Order)</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Min Order Qty</Label>
                <Input type="number" step="0.001" value={form.min_order_qty} onChange={(e) => set("min_order_qty", e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
