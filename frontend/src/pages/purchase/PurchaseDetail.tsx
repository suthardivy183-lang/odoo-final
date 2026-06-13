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
  const canReceive = po.status === "Confirmed" || po.status === "Partially Received";

  const doReceive = async () => {
    setError("");
    const items = po.lines
      .filter((l) => recvQty[l.id] && Number(recvQty[l.id]) > 0)
      .map((l) => ({ product_id: l.product_id, received_qty: Number(recvQty[l.id]) }));
    if (items.length === 0) { setError("Enter a quantity to receive"); return; }
    try {
      await receive.mutateAsync({ id: po.id, items });
      setRecvQty({});
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Receive failed");
    }
  };

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <span className="flex items-center gap-3">PO-{String(po.id).padStart(4,"0")} — {po.vendor_name} <StatusBadge status={po.status} /></span>
        </DialogTitle>
      </DialogHeader>

      <div className="mt-4 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Unit Cost</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              {canReceive && <TableHead className="w-32 text-right">Receive Now</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.lines.map((l) => {
              const remaining = l.quantity - l.received_qty;
              return (
                <TableRow key={l.id}>
                  <TableCell>{l.product ? l.product.name : productName(l.product_id)}</TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell className="text-right">{l.received_qty}</TableCell>
                  <TableCell className="text-right">₹{l.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{l.total_price.toFixed(2)}</TableCell>
                  {canReceive && (
                    <TableCell className="text-right">
                      {remaining > 0 ? (
                        <Input type="number" step="0.001" max={remaining} className="h-8 text-right"
                          value={recvQty[l.id] ?? ""} placeholder={`≤${remaining}`}
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

      <div className="mt-2 text-right text-sm font-semibold">Total: ₹{po.total_amount.toFixed(2)}</div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <DialogFooter>
        {po.status === "Draft" && (
          <>
            <Button variant="destructive" onClick={() => cancel.mutate(po.id)} disabled={cancel.isPending}>Cancel</Button>
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
