import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LineItemsEditor, type DraftLine } from "@/components/LineItemsEditor";
import { useProducts } from "@/hooks/useProducts";
import { useSalesActions } from "@/hooks/useOrders";

export function SalesForm({ onClose }: { onClose: () => void }) {
  const { data: products } = useProducts();
  const { create } = useSalesActions();
  const [customer, setCustomer] = React.useState("");
  const [email, setEmail] = React.useState("");
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
        customer_name: customer,
        customer_email: email || null,
        expected_delivery: expected || null,
        lines: valid.map((l) => ({ product_id: l.product_id, ordered_qty: l.ordered_qty, unit_price: l.unit_price })),
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to create order");
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader><DialogTitle>New Sales Order</DialogTitle></DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Customer Name *</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Customer Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Expected Delivery</Label>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>
        </div>
        <LineItemsEditor lines={lines} setLines={setLines} products={products ?? []} priceField="sales_price" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending}>{create.isPending ? "Creating…" : "Create Draft"}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
