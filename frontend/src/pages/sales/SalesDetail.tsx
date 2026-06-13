import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useSalesOrder, useSalesActions } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";

export function SalesDetail({ soId, onClose }: { soId: number; onClose: () => void }) {
  const { data: so } = useSalesOrder(soId);
  const { data: products } = useProducts();
  const { confirm, deliver, cancel } = useSalesActions();
  const [delivQty, setDelivQty] = React.useState<Record<number, string>>({});
  const [error, setError] = React.useState("");

  const productName = (id: number) => products?.find((p) => p.id === id)?.name ?? `#${id}`;

  if (!so) return null;

  const canDeliver = so.status === "confirmed" || so.status === "partially_delivered";

  const doDeliver = async () => {
    setError("");
    const lines = so.lines
      .map((l) => ({ line_id: l.id, deliver_qty: delivQty[l.id] }))
      .filter((l) => l.deliver_qty && Number(l.deliver_qty) > 0);
    if (lines.length === 0) { setError("Enter a quantity to deliver"); return; }
    try {
      await deliver.mutateAsync({ id: so.id, lines });
      setDelivQty({});
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Delivery failed");
    }
  };

  const total = so.lines.reduce((s, l) => s + Number(l.ordered_qty) * Number(l.unit_price), 0);

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <span className="flex items-center gap-3">{so.name} <StatusBadge status={so.status} /></span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-1 text-sm">
        <div><span className="text-muted-foreground">Customer:</span> {so.customer_name}</div>
        {so.customer_email && <div><span className="text-muted-foreground">Email:</span> {so.customer_email}</div>}
        {so.expected_delivery && <div><span className="text-muted-foreground">Expected:</span> {so.expected_delivery}</div>}
      </div>

      <div className="mt-4 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {canDeliver && <TableHead className="w-28 text-right">Deliver Now</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {so.lines.map((l) => {
              const remaining = Number(l.ordered_qty) - Number(l.delivered_qty);
              return (
                <TableRow key={l.id}>
                  <TableCell>{productName(l.product_id)}</TableCell>
                  <TableCell className="text-right">{Number(l.ordered_qty)}</TableCell>
                  <TableCell className="text-right">{Number(l.delivered_qty)}</TableCell>
                  <TableCell className="text-right">₹{Number(l.unit_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{(Number(l.ordered_qty) * Number(l.unit_price)).toFixed(2)}</TableCell>
                  {canDeliver && (
                    <TableCell className="text-right">
                      {remaining > 0 ? (
                        <Input type="number" step="0.001" max={remaining} className="h-8 text-right"
                          value={delivQty[l.id] ?? ""} placeholder={`≤ ${remaining}`}
                          onChange={(e) => setDelivQty((q) => ({ ...q, [l.id]: e.target.value }))} />
                      ) : <span className="text-xs text-green-700">Done</span>}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-2 text-right text-sm font-semibold">Total: ₹{total.toFixed(2)}</div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <DialogFooter>
        {so.status === "draft" && (
          <>
            <Button variant="destructive" onClick={() => cancel.mutate(so.id)}>Cancel Order</Button>
            <Button onClick={() => confirm.mutate(so.id)} disabled={confirm.isPending}>
              {confirm.isPending ? "Confirming…" : "Confirm Order"}
            </Button>
          </>
        )}
        {canDeliver && (
          <Button onClick={doDeliver} disabled={deliver.isPending}>
            {deliver.isPending ? "Delivering…" : "Validate Delivery"}
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}
