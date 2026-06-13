import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useProducts } from "@/hooks/useProducts";
import { useBomActions } from "@/hooks/useOrders";
import type { BillOfMaterials } from "@/lib/types";

interface CompDraft { product_id: number | ""; qty: string; }

export function BomForm({ bom, onClose }: { bom: BillOfMaterials | null; onClose: () => void }) {
  const { data: products } = useProducts();
  const { create, update } = useBomActions();
  const [name, setName] = React.useState(bom?.name ?? "");
  const [productId, setProductId] = React.useState<string>(bom ? String(bom.product_id) : "");
  const [qtyProduced, setQtyProduced] = React.useState(bom?.qty_produced ?? "1.000");
  const [comps, setComps] = React.useState<CompDraft[]>(
    bom?.components.map((c) => ({ product_id: c.product_id, qty: c.qty })) ?? [{ product_id: "", qty: "1" }]
  );
  const [error, setError] = React.useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const valid = comps.filter((c) => c.product_id && Number(c.qty) > 0);
    if (!productId) { setError("Select the product this BoM produces"); return; }
    if (valid.length === 0) { setError("Add at least one component"); return; }
    try {
      if (bom) {
        await update.mutateAsync({ id: bom.id, name, qty_produced: qtyProduced });
        // Note: component editing on existing BoM uses PUT /bom/:id/components (Track A)
      } else {
        await create.mutateAsync({
          name,
          product_id: Number(productId),
          qty_produced: qtyProduced,
          components: valid.map((c) => ({ product_id: c.product_id, qty: c.qty })),
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Failed to save BoM");
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogHeader><DialogTitle>{bom ? "Edit BoM" : "New Bill of Materials"}</DialogTitle></DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>BoM Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Produces Product *</Label>
            <Select value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!!bom} required>
              <option value="">— Select —</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Qty Produced</Label>
            <Input type="number" step="0.001" value={qtyProduced} onChange={(e) => setQtyProduced(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Components</Label>
          {bom && <p className="text-xs text-muted-foreground">Component editing on existing BoMs is limited in MVP — recreate for major changes.</p>}
          {comps.map((c, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Select value={c.product_id} disabled={!!bom}
                  onChange={(e) => setComps(comps.map((x, idx) => idx === i ? { ...x, product_id: e.target.value ? Number(e.target.value) : "" } : x))}>
                  <option value="">— Component —</option>
                  {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div className="w-24">
                <Input type="number" step="0.001" value={c.qty} disabled={!!bom}
                  onChange={(e) => setComps(comps.map((x, idx) => idx === i ? { ...x, qty: e.target.value } : x))} />
              </div>
              {!bom && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setComps(comps.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {!bom && (
            <Button type="button" variant="outline" size="sm" onClick={() => setComps([...comps, { product_id: "", qty: "1" }])}>
              <Plus className="h-4 w-4" /> Add Component
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending || update.isPending}>Save</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
