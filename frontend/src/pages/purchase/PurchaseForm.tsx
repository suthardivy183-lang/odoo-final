import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { LineItemsEditor, type DraftLine } from "@/components/LineItemsEditor";
import { useProducts, useVendors } from "@/hooks/useProducts";
import { usePurchaseActions } from "@/hooks/useOrders";

export function PurchaseForm({ onClose }: { onClose: () => void }) {
  const { data: products } = useProducts();
  const { data: vendors } = useVendors();
  const { create } = usePurchaseActions();
  const [vendorId, setVendorId] = React.useState<string>("");
  const [expected, setExpected] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>([{ product_id: "", ordered_qty: "1", unit_price: "0.00" }]);
  const [error, setError] = React.useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const valid = lines.filter((l) => l.product_id && Number(l.ordered_qty) > 0);
    if (valid.length === 0) { setError("Add at least one order line"); return; }
    try {
      await create.mutateAsync({
        vendor_id: vendorId ? Number(vendorId) : null,
        expected_receipt: expected || null,
        lines: valid.map((l) => ({ product_id: l.product_id, ordered_qty: l.ordered_qty, unit_price: l.unit_price })),
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
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">— Select vendor —</option>
              {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Expected Receipt</Label>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
        </div>
        <LineItemsEditor lines={lines} setLines={setLines} products={products ?? []} priceField="cost" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create Draft"}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
