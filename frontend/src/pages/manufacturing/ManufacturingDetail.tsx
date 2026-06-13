import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useManufacturingOrders, useManufacturingActions, useBoms } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";

export function ManufacturingDetail({ moId, onClose }: { moId: number; onClose: () => void }) {
  const { data: orders } = useManufacturingOrders();
  const { data: products } = useProducts();
  const { data: boms } = useBoms();
  const { confirm, produce, cancel } = useManufacturingActions();
  const [qty, setQty] = React.useState("");
  const [error, setError] = React.useState("");

  const mo = orders?.find((o) => o.id === moId);
  const productName = (id: number) => products?.find((p) => p.id === id)?.name ?? `#${id}`;
  const bom = boms?.find((b) => b.id === mo?.bom_id);

  if (!mo) return null;
  const remaining = Number(mo.qty_to_produce) - Number(mo.qty_produced);
  const canProduce = mo.status === "confirmed" || mo.status === "in_progress";
  // component consumption preview scales with qty entered
  const ratio = bom ? (Number(qty || remaining) / Number(bom.qty_produced)) : 0;

  const doProduce = async () => {
    setError("");
    const q = qty || String(remaining);
    if (Number(q) <= 0) { setError("Enter a quantity to produce"); return; }
    try {
      await produce.mutateAsync({ id: mo.id, qty: q });
      setQty("");
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Production failed");
    }
  };

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle><span className="flex items-center gap-3">{mo.name} <StatusBadge status={mo.status} /></span></DialogTitle>
      </DialogHeader>

      <div className="space-y-1 text-sm">
        <div><span className="text-muted-foreground">Product:</span> {productName(mo.product_id)}</div>
        <div><span className="text-muted-foreground">To produce:</span> {Number(mo.qty_to_produce)} &nbsp;·&nbsp;
          <span className="text-muted-foreground">Produced:</span> {Number(mo.qty_produced)} &nbsp;·&nbsp;
          <span className="text-muted-foreground">Remaining:</span> {remaining}</div>
      </div>

      {bom && (
        <div className="mt-4 rounded-lg border">
          <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Components (per {Number(bom.qty_produced)} produced)</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Per Unit</TableHead>
                <TableHead className="text-right">Will Consume</TableHead>
                <TableHead className="text-right">In Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bom.components.map((c) => {
                const stock = Number(products?.find((p) => p.id === c.product_id)?.on_hand_qty ?? 0);
                const consume = canProduce ? Number(c.qty) * ratio : 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>{productName(c.product_id)}</TableCell>
                    <TableCell className="text-right">{Number(c.qty)}</TableCell>
                    <TableCell className="text-right">{consume ? consume.toFixed(3) : "—"}</TableCell>
                    <TableCell className={`text-right ${stock < consume ? "text-destructive font-semibold" : ""}`}>{stock}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {canProduce && (
        <div className="mt-4 flex items-end gap-2">
          <div className="space-y-1.5">
            <Label>Quantity to Produce Now</Label>
            <Input type="number" step="0.001" max={remaining} className="w-40"
              placeholder={`default ${remaining}`} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <DialogFooter>
        {mo.status === "draft" && (
          <>
            <Button variant="destructive" onClick={() => cancel.mutate(mo.id)}>Cancel</Button>
            <Button onClick={() => confirm.mutate(mo.id)} disabled={confirm.isPending}>
              {confirm.isPending ? "Confirming…" : "Confirm Order"}
            </Button>
          </>
        )}
        {canProduce && (
          <Button onClick={doProduce} disabled={produce.isPending}>
            {produce.isPending ? "Producing…" : "Produce"}
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}
