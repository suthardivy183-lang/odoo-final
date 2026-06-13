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
  const [viewing, setViewing] = React.useState<SalesOrder | null>(null);

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
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Lines</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {orders?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No sales orders</TableCell></TableRow>}
              {orders?.map((so) => {
                const total = so.lines.reduce((s, l) => s + Number(l.ordered_qty) * Number(l.unit_price), 0);
                return (
                  <TableRow key={so.id}>
                    <TableCell className="font-medium">{so.name}</TableCell>
                    <TableCell>{so.customer_name}</TableCell>
                    <TableCell className="text-muted-foreground">{so.lines.length}</TableCell>
                    <TableCell className="text-right">₹{total.toFixed(2)}</TableCell>
                    <TableCell><StatusBadge status={so.status} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setViewing(so)}><Eye className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {creating && <SalesForm onClose={() => setCreating(false)} />}
      {viewing && <SalesDetail soId={viewing.id} onClose={() => setViewing(null)} />}
    </div>
  );
}
