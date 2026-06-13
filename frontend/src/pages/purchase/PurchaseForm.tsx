import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineItemsEditor, type DraftLine } from "@/components/LineItemsEditor";
import { useProducts } from "@/hooks/useProducts";
import { usePurchaseActions } from "@/hooks/useOrders";

export function PurchaseForm({ onClose }: { onClose: () => void }) {
  const { data: products } = useProducts();
  const { create } = usePurchaseActions();
  const [vendorName, setVendorName] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>([{ product_id: "", quantity: "1", unit_price: "0.00" }]);
  const [error, setError] = React.useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const valid = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
    if (valid.length === 0) { setError("Add at least one order line"); return; }
    try {
      await create.mutateAsync({
        vendor_name: vendorName,
        lines: valid.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity), unit_price: Number(l.unit_price) })),
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to create order");
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Vendor Name *</Label>
          <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} required placeholder="e.g. WoodSupplierInc" />
        </div>
        <LineItemsEditor lines={lines} setLines={setLines} products={products ?? []} priceField="cost_price" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create Draft"}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
