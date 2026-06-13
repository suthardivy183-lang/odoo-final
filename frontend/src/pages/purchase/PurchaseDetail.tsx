import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usePurchaseOrders, usePurchaseActions } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";

export function PurchaseDetail({ poId, onClose }: { poId: number; onClose: () => void }) {
  const { data: orders } = usePurchaseOrders();
  const { data: products } = useProducts();
  const { confirm, receive, cancel } = usePurchaseActions();
  const [recvQty, setRecvQty] = React.useState<Record<number, string>>({});
  const [error, setError] = React.useState("");

  const po = orders?.find((o) => o.id === poId);
  const productName = (id: number) => products?.find((p) => p.id === id)?.name ?? `#${id}`;

  if (!po) return null;
  const canReceive = po.status === "confirmed" || po.status === "partially_received";

  const doReceive = async () => {
    setError("");
    const lines = po.lines
      .map((l) => ({ line_id: l.id, receive_qty: recvQty[l.id] }))
      .filter((l) => l.receive_qty && Number(l.receive_qty) > 0);
    if (lines.length === 0) { setError("Enter a quantity to receive"); return; }
    try {
      await receive.mutateAsync({ id: po.id, lines });
      setRecvQty({});
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Receive failed");
    }
  };

  const total = po.lines.reduce((s, l) => s + Number(l.ordered_qty) * Number(l.unit_price), 0);

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle><span className="flex items-center gap-3">{po.name} <StatusBadge status={po.status} /></span></DialogTitle>
      </DialogHeader>

      <div className="mt-2 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {canReceive && <TableHead className="w-28 text-right">Receive Now</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.lines.map((l) => {
              const remaining = Number(l.ordered_qty) - Number(l.received_qty);
              return (
                <TableRow key={l.id}>
                  <TableCell>{productName(l.product_id)}</TableCell>
                  <TableCell className="text-right">{Number(l.ordered_qty)}</TableCell>
                  <TableCell className="text-right">{Number(l.received_qty)}</TableCell>
                  <TableCell className="text-right">₹{Number(l.unit_price).toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{(Number(l.ordered_qty) * Number(l.unit_price)).toFixed(2)}</TableCell>
                  {canReceive && (
                    <TableCell className="text-right">
                      {remaining > 0 ? (
                        <Input type="number" step="0.001" max={remaining} className="h-8 text-right"
                          value={recvQty[l.id] ?? ""} placeholder={`≤ ${remaining}`}
                          onChange={(e) => setRecvQty((q) => ({ ...q, [l.id]: e.target.value }))} />
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
        {po.status === "draft" && (
          <>
            <Button variant="destructive" onClick={() => cancel.mutate(po.id)}>Cancel Order</Button>
            <Button onClick={() => confirm.mutate(po.id)} disabled={confirm.isPending}>
              {confirm.isPending ? "Confirming…" : "Confirm Order"}
            </Button>
          </>
        )}
        {canReceive && (
          <Button onClick={doReceive} disabled={receive.isPending}>
            {receive.isPending ? "Receiving…" : "Validate Receipt"}
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}
