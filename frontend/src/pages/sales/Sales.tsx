import * as React from "react";
import { Plus, Eye } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useSalesOrders } from "@/hooks/useOrders";
import type { SalesOrder } from "@/lib/types";
import { SalesForm } from "./SalesForm";
import { SalesDetail } from "./SalesDetail";

export default function Sales() {
  const { data: orders, isLoading } = useSalesOrders();
  const [creating, setCreating] = React.useState(false);
  const [viewingId, setViewingId] = React.useState<number | null>(null);

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        description="Customer demand — confirm to reserve stock & trigger procurement"
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Sales Order</Button>}
      />
      <div className="p-8">
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && orders?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No sales orders</TableCell></TableRow>}
              {orders?.map((so: SalesOrder) => (
                <TableRow key={so.id}>
                  <TableCell className="font-medium">SO-{String(so.id).padStart(4, "0")}</TableCell>
                  <TableCell>{so.customer_name}</TableCell>
                  <TableCell className="text-muted-foreground">{so.lines.length}</TableCell>
                  <TableCell className="text-right">₹{so.total_amount.toFixed(2)}</TableCell>
                  <TableCell><StatusBadge status={so.status} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setViewingId(so.id)}><Eye className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {creating && <SalesForm onClose={() => setCreating(false)} />}
      {viewingId && <SalesDetail soId={viewingId} onClose={() => setViewingId(null)} />}
    </div>
  );
}
