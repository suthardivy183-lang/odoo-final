import * as React from "react";
import { Plus, Eye } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useManufacturingOrders } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import type { ManufacturingOrder } from "@/lib/types";
import { ManufacturingForm } from "./ManufacturingForm";
import { ManufacturingDetail } from "./ManufacturingDetail";

export default function Manufacturing() {
  const { data: orders, isLoading } = useManufacturingOrders();
  const { data: products } = useProducts();
  const [creating, setCreating] = React.useState(false);
  const [viewing, setViewing] = React.useState<ManufacturingOrder | null>(null);

  const productName = (id: number) => products?.find((p) => p.id === id)?.name ?? `#${id}`;

  return (
    <div>
      <PageHeader
        title="Manufacturing Orders"
        description="Produce finished goods — consumes components, adds output to stock"
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New Mfg Order</Button>}
      />
      <div className="p-8">
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">To Produce</TableHead>
                <TableHead className="text-right">Produced</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {orders?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No manufacturing orders</TableCell></TableRow>}
              {orders?.map((mo) => (
                <TableRow key={mo.id}>
                  <TableCell className="font-medium">{mo.name}</TableCell>
                  <TableCell>{productName(mo.product_id)}</TableCell>
                  <TableCell className="text-right">{Number(mo.qty_to_produce)}</TableCell>
                  <TableCell className="text-right">{Number(mo.qty_produced)}</TableCell>
                  <TableCell><StatusBadge status={mo.status} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => setViewing(mo)}><Eye className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {creating && <ManufacturingForm onClose={() => setCreating(false)} />}
      {viewing && <ManufacturingDetail moId={viewing.id} onClose={() => setViewing(null)} />}
    </div>
  );
}
