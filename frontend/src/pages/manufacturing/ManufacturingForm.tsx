import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { useBoms, useManufacturingActions } from "@/hooks/useOrders";

export function ManufacturingForm({ onClose }: { onClose: () => void }) {
  const { data: products } = useProducts();
  const { data: boms } = useBoms();
  const { create } = useManufacturingActions();
  const [productId, setProductId] = React.useState("");
  const [bomId, setBomId] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [error, setError] = React.useState("");

  const onProduct = (pid: string) => {
    setProductId(pid);
    const match = boms?.find((b) => b.product_id === Number(pid));
    setBomId(match ? String(match.id) : "");
  };

  const matchingBoms = boms?.filter((b) => !productId || b.product_id === Number(productId)) ?? [];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!productId) { setError("Select a product to manufacture"); return; }
    if (!bomId) { setError("Select a Bill of Materials"); return; }
    try {
      await create.mutateAsync({
        product_id: Number(productId),
        bom_id: Number(bomId),
        quantity: Number(qty),
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to create order");
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader><DialogTitle>New Manufacturing Order</DialogTitle></DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Product *</Label>
            <Select value={productId} onChange={(e) => onProduct(e.target.value)} required>
              <option value="">— Select —</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bill of Materials *</Label>
            <Select value={bomId} onChange={(e) => setBomId(e.target.value)} required>
              <option value="">— Select BoM —</option>
              {matchingBoms.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quantity to Produce *</Label>
            <Input type="number" step="0.001" min="0.001" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create Draft"}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
