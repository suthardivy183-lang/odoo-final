import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useManufacturingOrders, useManufacturingActions } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";

export function ManufacturingDetail({ moId, onClose }: { moId: number; onClose: () => void }) {
  const { data: orders } = useManufacturingOrders();
  const { data: products } = useProducts();
  const { confirm, start, produce, cancel } = useManufacturingActions();

  const mo = orders?.find((o) => o.id === moId);
  const productName = (id: number) => products?.find((p) => p.id === id)?.name ?? `#${id}`;

  if (!mo) return null;

  const fg = products?.find((p) => p.id === mo.product_id);

  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          <span className="flex items-center gap-3">MO-{String(mo.id).padStart(4,"0")} <StatusBadge status={mo.status} /></span>
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-1 text-sm">
        <div><span className="text-muted-foreground">Product:</span> {fg?.name ?? productName(mo.product_id)}</div>
        <div><span className="text-muted-foreground">Quantity:</span> {mo.quantity}</div>
        {mo.start_date && <div><span className="text-muted-foreground">Started:</span> {new Date(mo.start_date).toLocaleString()}</div>}
        {mo.end_date && <div><span className="text-muted-foreground">Completed:</span> {new Date(mo.end_date).toLocaleString()}</div>}
      </div>

      {mo.components.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Components</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead className="text-right">Consumed</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mo.components.map((c) => {
                const stock = products?.find((p) => p.id === c.component_product_id)?.on_hand_qty ?? 0;
                const short = stock < c.required_quantity && c.status !== "Consumed";
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">
                        {c.component_product ? c.component_product.name : productName(c.component_product_id)}
                      </div>
                      {c.storage_locations && c.storage_locations.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground bg-muted/50 p-1 rounded">
                          <span className="font-semibold">Storage:</span>{" "}
                          {c.storage_locations.map(loc =>
                            `${loc.warehouse_name} (${loc.aisle_name} → ${loc.rack_name} → ${loc.shelf_name}): ${loc.quantity} units`
                          ).join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{c.required_quantity}</TableCell>
                    <TableCell className="text-right">{c.consumed_quantity}</TableCell>
                    <TableCell className={`text-right ${short ? "text-destructive font-semibold" : ""}`}>{stock}</TableCell>
                    <TableCell><StatusBadge status={c.status === "Consumed" ? "Completed" : c.status === "Pending" ? "Draft" : c.status} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {mo.operations.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Operations</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Seq</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Work Center</TableHead>
                <TableHead className="text-right">Std Time (min)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mo.operations.map((op) => (
                <TableRow key={op.id}>
                  <TableCell>{op.sequence}</TableCell>
                  <TableCell>{op.operation_name}</TableCell>
                  <TableCell>{op.work_center}</TableCell>
                  <TableCell className="text-right">{op.standard_time_minutes}</TableCell>
                  <TableCell><StatusBadge status={(op as any).status === "Completed" ? "Completed" : "Draft"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DialogFooter>
        {mo.status === "Draft" && (
          <>
            <Button variant="destructive" onClick={() => cancel.mutate(mo.id)} disabled={cancel.isPending}>Cancel</Button>
            <Button onClick={() => confirm.mutate(mo.id)} disabled={confirm.isPending}>
              {confirm.isPending ? "…" : "Confirm (→ Planned)"}
            </Button>
          </>
        )}
        {mo.status === "Planned" && (
          <>
            <Button variant="destructive" onClick={() => cancel.mutate(mo.id)} disabled={cancel.isPending}>Cancel</Button>
            <Button onClick={() => start.mutate(mo.id)} disabled={start.isPending}>
              {start.isPending ? "…" : "Start Production (→ In Progress)"}
            </Button>
          </>
        )}
        {mo.status === "In Progress" && (
          <Button onClick={() => produce.mutate(mo.id)} disabled={produce.isPending}>
            {produce.isPending ? "Producing…" : "Produce & Complete"}
          </Button>
        )}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </Dialog>
  );
}
