import * as React from "react";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProducts } from "@/hooks/useProducts";
import { useBomActions } from "@/hooks/useOrders";
import type { BillOfMaterials } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

interface CompDraft { component_product_id: number | ""; quantity: string; }
interface OpDraft { sequence: number; operation_name: string; work_center: string; standard_time_minutes: string; }

export function BomForm({ bom, onClose }: { bom: BillOfMaterials | null; onClose: () => void }) {
  const { data: products } = useProducts();
  const { create, update } = useBomActions();
  const [name, setName] = React.useState(bom?.name ?? "");
  const [productId, setProductId] = React.useState<string>(bom ? String(bom.product_id) : "");
  const [description, setDescription] = React.useState(bom?.description ?? "");
  const [comps, setComps] = React.useState<CompDraft[]>(
    bom?.components.map((c) => ({ component_product_id: c.component_product_id, quantity: String(c.quantity) })) ?? [{ component_product_id: "", quantity: "1" }]
  );
  const [ops, setOps] = React.useState<OpDraft[]>(
    bom?.operations.map((o) => ({ sequence: o.sequence, operation_name: o.operation_name, work_center: o.work_center, standard_time_minutes: String(o.standard_time_minutes) })) ?? []
  );
  const [error, setError] = React.useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const validComps = comps.filter((c) => c.component_product_id && Number(c.quantity) > 0);
    if (!productId) { setError("Select the product this BoM produces"); return; }
    if (validComps.length === 0) { setError("Add at least one component"); return; }
    try {
      if (bom) {
        await update.mutateAsync({ id: bom.id, name, description });
      } else {
        await create.mutateAsync({
          name,
          product_id: Number(productId),
          description: description || null,
          components: validComps.map((c) => ({ component_product_id: c.component_product_id, quantity: Number(c.quantity) })),
          operations: ops.map((o) => ({ ...o, standard_time_minutes: Number(o.standard_time_minutes) })),
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
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {/* Components */}
        <div className="space-y-2">
          <Label>Components</Label>
          {bom && <p className="text-xs text-muted-foreground">Only name/description editable on existing BoMs.</p>}
          {comps.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1">
                <Select value={c.component_product_id} disabled={!!bom}
                  onChange={(e) => setComps(comps.map((x, idx) => idx === i ? { ...x, component_product_id: e.target.value ? Number(e.target.value) : "" } : x))}>
                  <option value="">— Component —</option>
                  {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <Input type="number" step="0.001" className="w-24" value={c.quantity} disabled={!!bom}
                onChange={(e) => setComps(comps.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} />
              {!bom && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setComps(comps.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
          {!bom && (
            <Button type="button" variant="outline" size="sm" onClick={() => setComps([...comps, { component_product_id: "", quantity: "1" }])}>
              <Plus className="h-4 w-4" /> Add Component
            </Button>
          )}
        </div>

        {/* Operations (new BoM only) */}
        {!bom && (
          <div className="space-y-2">
            <Label>Operations <span className="text-xs text-muted-foreground">(optional)</span></Label>
            {ops.map((o, i) => (
              <div key={i} className="grid grid-cols-[40px_1fr_1fr_80px_36px] items-center gap-2">
                <Input type="number" value={o.sequence} onChange={(e) => setOps(ops.map((x, idx) => idx === i ? { ...x, sequence: Number(e.target.value) } : x))} placeholder="Seq" />
                <Input value={o.operation_name} onChange={(e) => setOps(ops.map((x, idx) => idx === i ? { ...x, operation_name: e.target.value } : x))} placeholder="Operation name" />
                <Input value={o.work_center} onChange={(e) => setOps(ops.map((x, idx) => idx === i ? { ...x, work_center: e.target.value } : x))} placeholder="Work center" />
                <Input type="number" value={o.standard_time_minutes} onChange={(e) => setOps(ops.map((x, idx) => idx === i ? { ...x, standard_time_minutes: e.target.value } : x))} placeholder="Mins" />
                <Button type="button" variant="ghost" size="icon" onClick={() => setOps(ops.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setOps([...ops, { sequence: (ops.length + 1) * 10, operation_name: "", work_center: "", standard_time_minutes: "60" }])}>
              <Plus className="h-4 w-4" /> Add Operation
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending || update.isPending}>Save</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
