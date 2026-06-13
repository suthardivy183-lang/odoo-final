import * as React from "react";
import Eye from "lucide-react/dist/esm/icons/eye.js";
import Plus from "lucide-react/dist/esm/icons/plus.js";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usePurchaseOrders } from "@/hooks/useOrders";
import type { PurchaseOrder } from "@/lib/types";
import { PurchaseForm } from "./PurchaseForm";
import { PurchaseDetail } from "./PurchaseDetail";

export default function Purchase() {
  const { data: orders, isLoading } = usePurchaseOrders();
  const [creating, setCreating] = React.useState(false);
  const [viewingId, setViewingId] = React.useState<number | null>(null);

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        description="Replenish stock from vendors — receive to add to inventory"
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Purchase Order</Button>}
      />
      <div className="p-8">
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && orders?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No purchase orders</TableCell></TableRow>}
              {orders?.map((po: PurchaseOrder) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">PO-{String(po.id).padStart(4, "0")}</TableCell>
                  <TableCell>{po.vendor_name}</TableCell>
                  <TableCell className="text-muted-foreground">{po.lines.length}</TableCell>
                  <TableCell className="text-right">₹{po.total_amount.toFixed(2)}</TableCell>
                  <TableCell><StatusBadge status={po.status} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setViewingId(po.id)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {creating && <PurchaseForm onClose={() => setCreating(false)} />}
      {viewingId && <PurchaseDetail poId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
}
