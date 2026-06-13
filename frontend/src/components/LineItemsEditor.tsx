import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/types";

export interface DraftLine {
  product_id: number | "";
  ordered_qty: string;
  unit_price: string;
}

export function LineItemsEditor({
  lines,
  setLines,
  products,
  priceField = "sales_price",
}: {
  lines: DraftLine[];
  setLines: (l: DraftLine[]) => void;
  products: Product[];
  priceField?: "sales_price" | "cost";
}) {
  const update = (i: number, patch: Partial<DraftLine>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const onProduct = (i: number, pid: string) => {
    const product = products.find((p) => p.id === Number(pid));
    update(i, {
      product_id: pid ? Number(pid) : "",
      unit_price: product ? product[priceField] : lines[i].unit_price,
    });
  };

  return (
    <div className="space-y-2">
      <Label>Order Lines</Label>
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={line.product_id} onChange={(e) => onProduct(i, e.target.value)} required>
                <option value="">— Select product —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div className="w-24">
              <Input type="number" step="0.001" placeholder="Qty" value={line.ordered_qty}
                onChange={(e) => update(i, { ordered_qty: e.target.value })} required />
            </div>
            <div className="w-28">
              <Input type="number" step="0.01" placeholder="Price" value={line.unit_price}
                onChange={(e) => update(i, { unit_price: e.target.value })} required />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm"
        onClick={() => setLines([...lines, { product_id: "", ordered_qty: "1", unit_price: "0.00" }])}>
        <Plus className="h-4 w-4" /> Add Line
      </Button>
    </div>
  );
}
