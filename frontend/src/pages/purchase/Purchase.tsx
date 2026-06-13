import * as React from "react";
import { Plus, Eye } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usePurchaseOrders } from "@/hooks/useOrders";
import { useVendors } from "@/hooks/useProducts";
import type { PurchaseOrder } from "@/lib/types";
import { PurchaseForm } from "./PurchaseForm";
import { PurchaseDetail } from "./PurchaseDetail";

export default function Purchase() {
  const { data: orders, isLoading } = usePurchaseOrders();
  const { data: vendors } = useVendors();
  const [creating, setCreating] = React.useState(false);
  const [viewing, setViewing] = React.useState<PurchaseOrder | null>(null);

  const vendorName = (id: number | null) => (id ? vendors?.find((v) => v.id === id)?.name ?? `#${id}` : "—");

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
                <TableHead>Order</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {orders?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No purchase orders</TableCell></TableRow>}
              {orders?.map((po) => {
                const total = po.lines.reduce((s, l) => s + Number(l.ordered_qty) * Number(l.unit_price), 0);
                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.name}</TableCell>
                    <TableCell>{vendorName(po.vendor_id)}</TableCell>
                    <TableCell className="text-muted-foreground">{po.lines.length}</TableCell>
                    <TableCell className="text-right">₹{total.toFixed(2)}</TableCell>
                    <TableCell><StatusBadge status={po.status} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => setViewing(po)}><Eye className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {creating && <PurchaseForm onClose={() => setCreating(false)} />}
      {viewing && <PurchaseDetail poId={viewing.id} onClose={() => setViewing(null)} />}
    </div>
  );
}
