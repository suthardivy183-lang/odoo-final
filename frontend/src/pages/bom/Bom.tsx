import * as React from "react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useBoms, useBomActions } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import type { BillOfMaterials } from "@/lib/types";
import { BomForm } from "./BomForm";
import { Pencil, Plus, Trash2 } from "lucide-react";

export default function Bom() {
  const { data: boms, isLoading } = useBoms();
  const { data: products } = useProducts();
  const { remove } = useBomActions();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<BillOfMaterials | null>(null);

  const productName = (id: number) => products?.find((p) => p.id === id)?.name ?? `#${id}`;

  return (
    <div>
      <PageHeader
        title="Bill of Materials"
        description="Component recipes used by manufacturing orders"
        action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New BoM</Button>}
      />
      <div className="p-8">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm [&_thead]:bg-muted/40">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BoM Name</TableHead>
                <TableHead>Produces</TableHead>
                <TableHead>Components</TableHead>
                <TableHead>Operations</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && boms?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No BoMs</TableCell></TableRow>}
              {boms?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{productName(b.product_id)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.components.map((c) => `${c.quantity}× ${productName(c.component_product_id)}`).join(", ")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {b.operations.map((o) => o.operation_name).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(b)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${b.name}?`)) remove.mutate(b.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {(creating || editing) && <BomForm bom={editing} onClose={() => { setCreating(false); setEditing(null); }} />}
    </div>
  );
}
