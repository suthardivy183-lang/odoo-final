import * as React from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useProducts, useDeleteProduct } from "@/hooks/useProducts";
import type { Product } from "@/lib/types";
import { ProductForm } from "./ProductForm";

export default function Products() {
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [creating, setCreating] = React.useState(false);
  const { data: products, isLoading } = useProducts(search);
  const del = useDeleteProduct();

  return (
    <div>
      <PageHeader
        title="Products"
        description="Central inventory — on-hand, reserved, and free-to-use stock"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New Product
          </Button>
        }
      />
      <div className="p-8">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 max-w-xs"
        />
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Sales Price</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead className="text-right">Free to Use</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {products?.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No products</TableCell></TableRow>
              )}
              {products?.map((p) => {
                const free = Number(p.free_to_use_qty);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.internal_ref ?? "—"}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="muted">{p.product_type}</Badge></TableCell>
                    <TableCell className="text-right">₹{Number(p.sales_price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{Number(p.on_hand_qty)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{Number(p.reserved_qty)}</TableCell>
                    <TableCell className="text-right">
                      <span className={free <= 0 ? "font-semibold text-destructive" : "font-semibold text-green-700"}>
                        {free}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { if (confirm(`Delete ${p.name}?`)) del.mutate(p.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {(creating || editing) && (
        <ProductForm
          product={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
