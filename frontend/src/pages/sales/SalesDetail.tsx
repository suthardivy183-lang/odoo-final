import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useSalesOrder, useSalesActions } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";

export function SalesDetail({ soId, onClose }: { soId: number; onClose: () => void }) {
  const { data: so, isLoading } = useSalesOrder(soId);
  const { data: products } = useProducts();
  const { confirm, deliver, cancel } = useSalesActions();

  const productName = (id: number) => products?.find((p) => p.id === id)?.name ?? `#${id}`;

  if (isLoading || !so) return null;

  const canDeliver = so.status === "Confirmed" || so.status === "Partially Delivered";

  return (
    <Dialog open onClose={onClose} className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <span className="flex items-center gap-3">SO #{so.id} — {so.customer_name} <StatusBadge status={so.status} /></span>
        </DialogTitle>
      </DialogHeader>

      <div className="mt-4 overflow-hidden rounded-lg border border-border [&_thead]:bg-muted/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Ordered</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {so.lines.map((l) => {
              const remaining = l.quantity - l.delivered_qty;
              return (
                <TableRow key={l.id}>
                  <TableCell>{l.product ? l.product.name : productName(l.product_id)}</TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell className="text-right">{l.delivered_qty}</TableCell>
                  <TableCell className="text-right">
                    <span className={remaining > 0 ? "text-amber-600 font-medium" : "text-green-700"}>{remaining}</span>
                  </TableCell>
                  <TableCell className="text-right">₹{l.unit_price.toFixed(2)}</TableCell>
                  <TableCell className="text-right">₹{l.total_price.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Order Total</span>
        <span className="tnum text-lg font-semibold text-foreground">₹{so.total_amount.toFixed(2)}</span>
      </div>

      {canDeliver && (
        <p className="mt-2 text-xs text-muted-foreground">
          "Validate Delivery" will deliver as much as current on-hand stock allows.
        </p>
      )}

      <DialogFooter>
        {so.status === "Draft" && (
          <>
            <Button variant="destructive" onClick={() => cancel.mutate(so.id)} disabled={cancel.isPending}>Cancel Order</Button>
            <Button onClick={() => confirm.mutate(so.id)} disabled={confirm.isPending}>
              {confirm.isPending ? "Confirming…" : "Confirm Order"}
            </Button>
          </>
        )}
        {canDeliver && (
          <Button onClick={() => deliver.mutate(so.id)} disabled={deliver.isPending}>
            {deliver.isPending ? "Delivering…" : "Validate Delivery"}
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}
