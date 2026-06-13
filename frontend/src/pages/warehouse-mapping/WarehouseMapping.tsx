import * as React from "react";
import {
  Plus,
  Pencil,
  Trash2,
  QrCode,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Package,
  MapPin,
  Search,
  Check,
  ChevronRight,
  X,
  SlidersHorizontal,
  Boxes,
  CornerDownLeft,
  Activity,
  Layers,
  TrendingUp,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useProducts } from "@/hooks/useProducts";
import {
  useWarehouses,
  useAisles,
  useRacks,
  useShelves,
  useSaveWarehouse,
  useDeleteWarehouse,
  useSaveAisle,
  useDeleteAisle,
  useSaveRack,
  useDeleteRack,
  useSaveShelf,
  useDeleteShelf,
  useAllocateStock,
  useTransferStock,
  useWarehouseActivities,
} from "@/hooks/useWarehouse";
import type { Warehouse, Aisle, Rack, Shelf } from "@/lib/types";

const MAX_CAPACITY = 100;

/** Minimal QR glyph derived from a stable hash of the value. */
function QRGlyph({ value, size = 84 }: { value: string; size?: number }) {
  const blocks = React.useMemo(() => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = value.charCodeAt(i) + ((hash << 5) - hash);
    const out: { r: number; c: number }[] = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        const isFinder = (r < 4 && c < 4) || (r < 4 && c >= 11) || (r >= 11 && c < 4);
        if (isFinder) {
          if (r === 0 || r === 3 || c === 0 || c === 3 || r === 12 || r === 14 || c === 12 || c === 14)
            out.push({ r, c });
        } else if (Math.abs(Math.sin(hash + r * 17 + c * 31)) > 0.5) {
          out.push({ r, c });
        }
      }
    }
    return out;
  }, [value]);

  return (
    <svg width={size} height={size} viewBox="0 0 15 15" className="rounded-md fill-foreground">
      {blocks.map((b, i) => (
        <rect key={i} x={b.c} y={b.r} width="1" height="1" />
      ))}
    </svg>
  );
}

/** Occupancy tone — one restrained scale: empty → in use → near full. */
function occupancy(qty: number) {
  const pct = Math.min(Math.round((qty / MAX_CAPACITY) * 100), 100);
  if (qty <= 0) return { pct, bar: "bg-border", dot: "bg-muted-foreground/40", label: "Empty" };
  if (pct < 80) return { pct, bar: "bg-primary", dot: "bg-primary", label: `${pct}%` };
  return { pct, bar: "bg-amber-500", dot: "bg-amber-500", label: `${pct}%` };
}

export default function WarehouseMapping() {
  // --- Data ---
  const { data: products } = useProducts();
  const { data: warehouses, isLoading: whLoading } = useWarehouses();
  const { data: activities } = useWarehouseActivities();

  const [selectedWhId, setSelectedWhId] = React.useState<number | undefined>();
  const [selectedShelfId, setSelectedShelfId] = React.useState<number | undefined>();

  const { data: aisles, isLoading: aislesLoading } = useAisles(selectedWhId);
  const { data: allRacks } = useRacks();
  const { data: shelves, isLoading: shelvesLoading } = useShelves();

  // --- Mutations ---
  const saveWh = useSaveWarehouse();
  const deleteWh = useDeleteWarehouse();
  const saveAisle = useSaveAisle();
  const deleteAisle = useDeleteAisle();
  const saveRack = useSaveRack();
  const deleteRack = useDeleteRack();
  const saveShelf = useSaveShelf();
  const deleteShelf = useDeleteShelf();
  const allocateStock = useAllocateStock();
  const transferStock = useTransferStock();

  // --- UI state ---
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showSearchResults, setShowSearchResults] = React.useState(false);
  const [showAllocateForm, setShowAllocateForm] = React.useState(false);
  const [showTransferForm, setShowTransferForm] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // --- CRUD modal state ---
  const [whModal, setWhModal] = React.useState<{ mode: "create" | "edit"; data?: Warehouse } | null>(null);
  const [aisleModal, setAisleModal] = React.useState<{ mode: "create" | "edit"; warehouse_id: number; data?: Aisle } | null>(null);
  const [rackModal, setRackModal] = React.useState<{ mode: "create" | "edit"; aisle_id: number; data?: Rack } | null>(null);
  const [shelfModal, setShelfModal] = React.useState<{ mode: "create" | "edit"; rack_id: number; data?: Shelf } | null>(null);

  const [whName, setWhName] = React.useState("");
  const [whLoc, setWhLoc] = React.useState("");
  const [aisleName, setAisleName] = React.useState("");
  const [rackName, setRackName] = React.useState("");
  const [shelfName, setShelfName] = React.useState("");

  const [allocProdId, setAllocProdId] = React.useState<number | undefined>();
  const [allocQty, setAllocQty] = React.useState<number>(0);
  const [transferProdId, setTransferProdId] = React.useState<number | undefined>();
  const [transferTgtShelfId, setTransferTgtShelfId] = React.useState<number | undefined>();
  const [transferQty, setTransferQty] = React.useState<number>(0);

  React.useEffect(() => {
    if (warehouses && warehouses.length > 0 && selectedWhId === undefined) {
      setSelectedWhId(warehouses[0].id);
    }
  }, [warehouses, selectedWhId]);

  // --- Derive live shelf allocations by replaying the activity feed ---
  const computedAllocations = React.useMemo(() => {
    const map = new Map<number, { productId: number; productName: string; sku: string; quantity: number }[]>();
    if (!activities || !products) return map;
    const sorted = [...activities].sort((a, b) => a.id - b.id);
    for (const act of sorted) {
      const prod = products.find((p) => p.id === act.product_id);
      if (!prod) continue;
      if (act.source_shelf_id) {
        const list = map.get(act.source_shelf_id) || [];
        const idx = list.findIndex((x) => x.productId === act.product_id);
        if (idx !== -1) {
          list[idx].quantity -= act.quantity;
          if (list[idx].quantity <= 0.0001) list.splice(idx, 1);
        }
        map.set(act.source_shelf_id, list);
      }
      if (act.target_shelf_id) {
        const list = map.get(act.target_shelf_id) || [];
        const idx = list.findIndex((x) => x.productId === act.product_id);
        if (idx !== -1) list[idx].quantity += act.quantity;
        else list.push({ productId: act.product_id, productName: prod.name, sku: prod.sku, quantity: act.quantity });
        map.set(act.target_shelf_id, list);
      }
    }
    return map;
  }, [activities, products]);

  const shelfQty = React.useCallback(
    (shelfId: number) => (computedAllocations.get(shelfId) || []).reduce((s, a) => s + a.quantity, 0),
    [computedAllocations]
  );

  // --- Global discovery search (the primary workflow) ---
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: {
      type: "product" | "location";
      title: string;
      subtitle: string;
      shelfId: number;
      whId: number;
      extra?: string;
    }[] = [];

    if (products) {
      for (const prod of products) {
        if (prod.name.toLowerCase().includes(q) || prod.sku.toLowerCase().includes(q)) {
          computedAllocations.forEach((allocs, shelfId) => {
            const match = allocs.find((a) => a.productId === prod.id);
            if (match) {
              const s = shelves?.find((sh) => sh.id === shelfId);
              const r = allRacks?.find((rx) => rx.id === s?.rack_id);
              const a = aisles?.find((ax) => ax.id === r?.aisle_id);
              const w = warehouses?.find((wx) => wx.id === a?.warehouse_id);
              results.push({
                type: "product",
                title: prod.name,
                subtitle: `${prod.sku} · ${w?.name ?? "WH"} → ${a?.name ?? "Aisle"} → ${s?.name ?? "Shelf"}`,
                shelfId,
                whId: w?.id ?? 0,
                extra: `${match.quantity} units`,
              });
            }
          });
        }
      }
    }

    if (shelves && allRacks && aisles && warehouses) {
      for (const s of shelves) {
        const r = allRacks.find((rx) => rx.id === s.rack_id);
        const a = aisles.find((ax) => ax.id === r?.aisle_id);
        const w = warehouses.find((wx) => wx.id === a?.warehouse_id);
        if (
          s.name.toLowerCase().includes(q) ||
          r?.name.toLowerCase().includes(q) ||
          a?.name.toLowerCase().includes(q) ||
          w?.name.toLowerCase().includes(q)
        ) {
          results.push({
            type: "location",
            title: `${a?.name ?? "Aisle"} → ${r?.name ?? "Rack"} → ${s.name}`,
            subtitle: w?.name ?? "Warehouse",
            shelfId: s.id,
            whId: w?.id ?? 0,
          });
        }
      }
    }
    return results.slice(0, 8);
  }, [searchQuery, products, shelves, allRacks, aisles, warehouses, computedAllocations]);

  // --- Active selection context ---
  const activeWh = warehouses?.find((w) => w.id === selectedWhId);
  const activeShelf = shelves?.find((s) => s.id === selectedShelfId);
  const activeShelfAllocations = selectedShelfId ? computedAllocations.get(selectedShelfId) || [] : [];

  const activeShelfPath = React.useMemo(() => {
    if (!activeShelf || !allRacks || !aisles || !warehouses) return null;
    const rack = allRacks.find((r) => r.id === activeShelf.rack_id);
    const aisle = aisles.find((a) => a.id === rack?.aisle_id);
    const wh = warehouses.find((w) => w.id === aisle?.warehouse_id);
    return { rack, aisle, wh };
  }, [activeShelf, allRacks, aisles, warehouses]);

  const activeShelfQty = activeShelfAllocations.reduce((sum, item) => sum + item.quantity, 0);
  const activeOcc = occupancy(activeShelfQty);

  // Shelves that belong to the active warehouse (for summary + utilization)
  const whShelves = React.useMemo(() => {
    if (!shelves || !allRacks || !aisles) return [];
    const aisleIds = new Set(aisles.map((a) => a.id));
    return shelves.filter((s) => {
      const r = allRacks.find((rx) => rx.id === s.rack_id);
      return r ? aisleIds.has(r.aisle_id) : false;
    });
  }, [shelves, allRacks, aisles]);

  const whUtilization = React.useMemo(() => {
    if (whShelves.length === 0) return { occupied: 0, pct: 0 };
    const occupied = whShelves.filter((s) => shelfQty(s.id) > 0).length;
    return { occupied, pct: Math.round((occupied / whShelves.length) * 100) };
  }, [whShelves, shelfQty]);

  const whUnits = React.useMemo(
    () => whShelves.reduce((sum, sh) => sum + shelfQty(sh.id), 0),
    [whShelves, shelfQty]
  );

  const filteredActivities = React.useMemo(() => {
    if (!activities) return [];
    if (!selectedShelfId) return activities.slice(0, 8);
    return activities
      .filter((act) => act.source_shelf_id === selectedShelfId || act.target_shelf_id === selectedShelfId)
      .slice(0, 8);
  }, [activities, selectedShelfId]);

  const allShelvesList = React.useMemo(() => {
    if (!shelves || !warehouses || !aisles || !allRacks) return [];
    return shelves.map((s) => {
      const r = allRacks.find((rx) => rx.id === s.rack_id);
      const a = aisles.find((ax) => ax.id === r?.aisle_id);
      const w = warehouses.find((wx) => wx.id === a?.warehouse_id);
      return { id: s.id, name: s.name, fullName: `${w?.name ?? "Wh"} → ${a?.name ?? "Aisle"} → ${r?.name ?? "Rack"} → ${s.name}` };
    });
  }, [shelves, warehouses, aisles, allRacks]);

  const formatTimeAgo = (timestampStr: string) => {
    const diffMs = Date.now() - new Date(timestampStr).getTime();
    const m = Math.floor(diffMs / 60000);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d === 1) return "Yesterday";
    return `${d}d ago`;
  };

  // --- Handlers (unchanged logic) ---
  const selectShelf = (shelfId: number, whId?: number) => {
    if (whId) setSelectedWhId(whId);
    setSelectedShelfId(shelfId);
    setShowAllocateForm(false);
    setShowTransferForm(false);
  };

  const handleSearchResultClick = (result: (typeof searchResults)[number]) => {
    selectShelf(result.shelfId, result.whId);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleWhSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim()) return;
    saveWh.mutate(
      { id: whModal?.data?.id, name: whName, location: whLoc || null },
      { onSuccess: (data) => { setSelectedWhId(data.id); setWhModal(null); } }
    );
  };
  const handleAisleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aisleName.trim() || !aisleModal) return;
    saveAisle.mutate(
      { id: aisleModal.data?.id, warehouse_id: aisleModal.warehouse_id, name: aisleName },
      { onSuccess: () => setAisleModal(null) }
    );
  };
  const handleRackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rackName.trim() || !rackModal) return;
    saveRack.mutate(
      { id: rackModal.data?.id, aisle_id: rackModal.aisle_id, name: rackName },
      { onSuccess: () => setRackModal(null) }
    );
  };
  const handleShelfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelfName.trim() || !shelfModal) return;
    saveShelf.mutate(
      { id: shelfModal.data?.id, rack_id: shelfModal.rack_id, name: shelfName },
      { onSuccess: (data) => { setSelectedShelfId(data.id); setShelfModal(null); } }
    );
  };
  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShelfId || !allocProdId || allocQty <= 0) return;
    allocateStock.mutate(
      { product_id: allocProdId, shelf_id: selectedShelfId, quantity: allocQty },
      { onSuccess: () => { setShowAllocateForm(false); setAllocProdId(undefined); setAllocQty(0); } }
    );
  };
  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShelfId || !transferProdId || !transferTgtShelfId || transferQty <= 0) return;
    transferStock.mutate(
      { product_id: transferProdId, source_shelf_id: selectedShelfId, target_shelf_id: transferTgtShelfId, quantity: transferQty },
      { onSuccess: () => { setShowTransferForm(false); setTransferProdId(undefined); setTransferTgtShelfId(undefined); setTransferQty(0); } }
    );
  };
  const copyQRUri = () => {
    if (!activeShelf) return;
    navigator.clipboard.writeText(`warehouse://shelf/${activeShelf.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loading = whLoading || shelvesLoading || aislesLoading;

  return (
    <div className="aurora flex h-screen flex-col bg-canvas">
      {/* ───────────────────────── Header ───────────────────────── */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-background/55 px-8 py-3.5 backdrop-blur-xl backdrop-saturate-150">
        <div className="mr-auto flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[#7B61FF] text-white shadow-sm shadow-primary/30">
            <WarehouseIcon className="h-[18px] w-[18px]" />
          </span>
          <div>
            <h1 className="text-[17px] font-semibold tracking-tight text-foreground">Warehouse</h1>
            <p className="text-[13px] text-muted-foreground">Find inventory, inspect locations, and move stock</p>
          </div>
        </div>

        {/* Discovery search — primary workflow */}
        <div className="relative order-last w-full md:order-none md:w-[420px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
            onFocus={() => setShowSearchResults(true)}
            placeholder="Search a product, SKU, or location…"
            className="h-9 pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setShowSearchResults(false); }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {showSearchResults && searchQuery.trim() && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowSearchResults(false)} />
              <div className="animate-in-up glass-strong absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">No matching products or locations</div>
                ) : (
                  <ul className="max-h-80 divide-y divide-border/70 overflow-y-auto py-1">
                    {searchResults.map((res, idx) => (
                      <li key={idx}>
                        <button
                          onClick={() => handleSearchResultClick(res)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent"
                        >
                          <span className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                            res.type === "product" ? "bg-primary-wash text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            {res.type === "product" ? <Package className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">{res.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{res.subtitle}</span>
                          </span>
                          {res.extra && <span className="tnum shrink-0 text-xs font-medium text-muted-foreground">{res.extra}</span>}
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <Button
          variant={editMode ? "default" : "outline"}
          size="sm"
          onClick={() => setEditMode((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {editMode ? "Done editing" : "Edit layout"}
        </Button>
      </header>

      {/* ───────────────────────── Body: map + detail rail ───────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* MAP — the hero */}
        <main className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          {/* Warehouse switcher */}
          <div className="mb-5 flex flex-wrap items-center gap-1.5">
            {warehouses?.map((w) => (
              <button
                key={w.id}
                onClick={() => { setSelectedWhId(w.id); setSelectedShelfId(undefined); }}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all",
                  w.id === selectedWhId
                    ? "bg-gradient-to-r from-primary to-[#7B61FF] text-white shadow-sm shadow-primary/30"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {w.name}
              </button>
            ))}
            {editMode && (
              <button
                onClick={() => { setWhName(""); setWhLoc(""); setWhModal({ mode: "create" }); }}
                className="flex items-center gap-1 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Warehouse
              </button>
            )}
          </div>

          {/* Metrics hero band */}
          {activeWh && (
            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard icon={Boxes} label="Units stored" value={whUnits.toLocaleString()} />
              <MetricCard icon={Layers} label="Shelves" value={whShelves.length} sub={`${whUtilization.occupied} occupied`} />
              <MetricCard icon={TrendingUp} label="Utilization" value={`${whUtilization.pct}%`} accent pct={whUtilization.pct} />
              <MetricCard icon={Activity} label="Movements" value={activities?.length ?? 0} />
            </div>
          )}

          {/* Map surface */}
          <div className="glass-strong rounded-xl">
            {loading ? (
              <div className="flex h-72 items-center justify-center text-[13px] text-muted-foreground">Loading map…</div>
            ) : !selectedWhId ? (
              <EmptyMap icon={Boxes} title="No warehouse yet" hint="Turn on Edit layout to create your first warehouse." />
            ) : aisles?.length === 0 ? (
              <EmptyMap
                icon={MapPin}
                title="This warehouse is empty"
                hint="Add an aisle to start mapping racks and shelves."
                action={editMode ? { label: "Add aisle", onClick: () => { setAisleName(""); setAisleModal({ mode: "create", warehouse_id: selectedWhId }); } } : undefined}
              />
            ) : (
              <div className="divide-y divide-border">
                {aisles?.map((aisle) => {
                  const aisleRacks = allRacks?.filter((r) => r.aisle_id === aisle.id) || [];
                  return (
                    <section key={aisle.id} className="px-6 py-5">
                      {/* Aisle heading */}
                      <div className="mb-4 flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{aisle.name}</span>
                        <div className="h-px flex-1 bg-border" />
                        {editMode && (
                          <div className="flex items-center gap-0.5">
                            <IconAction title="Add rack" onClick={() => { setRackName(""); setRackModal({ mode: "create", aisle_id: aisle.id }); }}><Plus className="h-3.5 w-3.5" /></IconAction>
                            <IconAction title="Rename aisle" onClick={() => { setAisleName(aisle.name); setAisleModal({ mode: "edit", warehouse_id: aisle.warehouse_id, data: aisle }); }}><Pencil className="h-3.5 w-3.5" /></IconAction>
                            <IconAction title="Delete aisle" danger onClick={() => { if (confirm(`Delete aisle "${aisle.name}" and everything in it?`)) deleteAisle.mutate({ id: aisle.id, warehouseId: selectedWhId }); }}><Trash2 className="h-3.5 w-3.5" /></IconAction>
                          </div>
                        )}
                      </div>

                      {aisleRacks.length === 0 ? (
                        <p className="text-[13px] text-muted-foreground">No racks in this aisle.</p>
                      ) : (
                        <div className="space-y-5">
                          {aisleRacks.map((rack) => {
                            const rackShelves = shelves?.filter((s) => s.rack_id === rack.id) || [];
                            return (
                              <div key={rack.id}>
                                <div className="mb-2 flex items-center gap-2">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-[13px] font-medium text-foreground">{rack.name}</span>
                                  {editMode && (
                                    <div className="flex items-center gap-0.5">
                                      <IconAction title="Add shelf" onClick={() => { setShelfName(""); setShelfModal({ mode: "create", rack_id: rack.id }); }}><Plus className="h-3 w-3" /></IconAction>
                                      <IconAction title="Rename rack" onClick={() => { setRackName(rack.name); setRackModal({ mode: "edit", aisle_id: rack.aisle_id, data: rack }); }}><Pencil className="h-3 w-3" /></IconAction>
                                      <IconAction title="Delete rack" danger onClick={() => { if (confirm(`Delete rack "${rack.name}" and its shelves?`)) deleteRack.mutate({ id: rack.id, aisleId: aisle.id }); }}><Trash2 className="h-3 w-3" /></IconAction>
                                    </div>
                                  )}
                                </div>

                                {rackShelves.length === 0 ? (
                                  <p className="pl-5 text-xs text-muted-foreground">No shelves yet.</p>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                                    {rackShelves.map((shelf) => {
                                      const qty = shelfQty(shelf.id);
                                      const occ = occupancy(qty);
                                      const isSel = selectedShelfId === shelf.id;
                                      return (
                                        <button
                                          key={shelf.id}
                                          onClick={() => selectShelf(shelf.id)}
                                          style={!isSel && qty > 0 ? { backgroundColor: `hsl(234 56% 60% / ${0.05 + (occ.pct / 100) * 0.16})` } : undefined}
                                          className={cn(
                                            "group relative rounded-xl border p-3.5 text-left transition-all duration-150 hover:-translate-y-0.5",
                                            isSel
                                              ? "border-primary bg-primary-wash shadow-md ring-2 ring-primary/25"
                                              : qty > 0
                                                ? "border-primary/15 hover:border-primary/40 hover:shadow-md"
                                                : "border-dashed border-border bg-card hover:border-border-strong"
                                          )}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-foreground">{shelf.name}</span>
                                            <span className={cn("h-2 w-2 rounded-full ring-2 ring-background", occ.dot)} />
                                          </div>
                                          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                            <div className={cn("h-full rounded-full", occ.bar)} style={{ width: `${Math.max(occ.pct, qty > 0 ? 8 : 0)}%` }} />
                                          </div>
                                          <div className="mt-2 flex items-center justify-between">
                                            <span className="tnum text-[11px] font-medium text-muted-foreground">{qty > 0 ? `${qty} units` : "Empty"}</span>
                                            {editMode && (
                                              <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                                                <IconAction as="span" title="Rename shelf" onClick={(e) => { e.stopPropagation(); setShelfName(shelf.name); setShelfModal({ mode: "edit", rack_id: shelf.rack_id, data: shelf }); }}><Pencil className="h-2.5 w-2.5" /></IconAction>
                                                <IconAction as="span" title="Delete shelf" danger onClick={(e) => { e.stopPropagation(); if (confirm(`Delete shelf "${shelf.name}"?`)) deleteShelf.mutate({ id: shelf.id, rackId: shelf.rack_id }); }}><Trash2 className="h-2.5 w-2.5" /></IconAction>
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent movements — a table is genuinely right here */}
          <div className="glass-strong mt-6 rounded-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="text-[13px] font-semibold text-foreground">Recent movements</h2>
              {selectedShelfId ? (
                <button onClick={() => setSelectedShelfId(undefined)} className="text-xs font-medium text-primary hover:underline">
                  Showing {activeShelf?.name} · clear
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">All locations</span>
              )}
            </div>
            {filteredActivities.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">No movements recorded yet.</div>
            ) : (
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-border/70">
                  {filteredActivities.map((act) => {
                    const prod = products?.find((p) => p.id === act.product_id);
                    const src = shelves?.find((s) => s.id === act.source_shelf_id);
                    const tgt = shelves?.find((s) => s.id === act.target_shelf_id);
                    const meta =
                      act.activity_type === "Allocated"
                        ? { icon: ArrowDownToLine, tone: "text-emerald-600 bg-emerald-50", text: <>Allocated to <b className="font-medium text-foreground">{tgt?.name ?? "shelf"}</b></> }
                        : act.activity_type === "Transferred"
                          ? { icon: ArrowLeftRight, tone: "text-primary bg-primary-wash", text: <><b className="font-medium text-foreground">{src?.name ?? "—"}</b> → <b className="font-medium text-foreground">{tgt?.name ?? "—"}</b></> }
                          : { icon: ArrowUpFromLine, tone: "text-rose-600 bg-rose-50", text: <>Consumed from <b className="font-medium text-foreground">{src?.name ?? "shelf"}</b></> };
                    const Icon = meta.icon;
                    return (
                      <tr key={act.id} className="transition-colors hover:bg-muted/50">
                        <td className="py-3 pl-5 pr-2 w-9">
                          <span className={cn("flex h-7 w-7 items-center justify-center rounded-md", meta.tone)}><Icon className="h-3.5 w-3.5" /></span>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-foreground">{prod?.name ?? `#${act.product_id}`}</div>
                          <div className="text-xs text-muted-foreground">{meta.text}</div>
                        </td>
                        <td className="tnum py-3 pr-3 text-right font-medium text-foreground">{act.quantity}</td>
                        <td className="py-3 pr-5 text-right text-xs text-muted-foreground whitespace-nowrap">{formatTimeAgo(act.timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>

        {/* DETAIL RAIL */}
        <aside className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border bg-background/55 backdrop-blur-xl backdrop-saturate-150 lg:block">
          {!activeShelf ? (
            <div className="p-6">
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                <p className="text-[13px] font-medium text-foreground">Select a shelf</p>
                <p className="mt-1 text-xs text-muted-foreground">Click any shelf on the map, or search above, to inspect stock and move inventory.</p>
              </div>
              {activeWh && (
                <div className="mt-6">
                  <SectionLabel>{activeWh.name}{activeWh.location ? ` · ${activeWh.location}` : ""}</SectionLabel>
                  <div className="mt-2 grid grid-cols-2 gap-2.5">
                    <SummaryTile label="Aisles" value={aisles?.length ?? 0} />
                    <SummaryTile label="Shelves" value={whShelves.length} />
                    <SummaryTile label="Occupied" value={whUtilization.occupied} />
                    <SummaryTile label="Utilization" value={`${whUtilization.pct}%`} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-foreground">{activeShelf.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{activeShelfPath?.wh?.name}</span><ChevronRight className="h-3 w-3" />
                    <span>{activeShelfPath?.aisle?.name}</span><ChevronRight className="h-3 w-3" />
                    <span>{activeShelfPath?.rack?.name}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedShelfId(undefined)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>

              {/* Occupancy gauge */}
              <div className="mt-5 flex items-center gap-5 rounded-xl border border-border bg-gradient-to-br from-muted/50 to-transparent p-4">
                <Gauge pct={activeOcc.pct} warn={activeOcc.pct >= 80} />
                <div>
                  <div className="tnum text-2xl font-semibold tracking-tight text-foreground">
                    {activeShelfQty}
                    <span className="text-base font-normal text-muted-foreground"> / {MAX_CAPACITY}</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground">units stored</div>
                </div>
              </div>

              {/* Stored products */}
              <div className="mt-6">
                <SectionLabel>Stored products</SectionLabel>
                {activeShelfAllocations.length === 0 ? (
                  <div className="mt-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                    Nothing stored here yet.
                  </div>
                ) : (
                  <ul className="mt-2 divide-y divide-border/70 overflow-hidden rounded-lg border border-border">
                    {activeShelfAllocations.map((a) => (
                      <li key={a.productId} className="flex items-center justify-between px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-foreground">{a.productName}</div>
                          <div className="text-xs text-muted-foreground">{a.sku}</div>
                        </div>
                        <span className="tnum text-[13px] font-medium text-foreground">{a.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 grid grid-cols-2 gap-2.5">
                <Button size="sm" className="bg-gradient-to-r from-primary to-[#7B61FF] hover:opacity-95" onClick={() => { setShowAllocateForm((v) => !v); setShowTransferForm(false); }}>
                  <ArrowDownToLine className="h-4 w-4" /> Allocate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activeShelfAllocations.length === 0}
                  onClick={() => { setShowTransferForm((v) => !v); setShowAllocateForm(false); setTransferProdId(activeShelfAllocations[0]?.productId); setTransferTgtShelfId(undefined); setTransferQty(0); }}
                >
                  <ArrowLeftRight className="h-4 w-4" /> Transfer
                </Button>
              </div>

              {showAllocateForm && (
                <form onSubmit={handleAllocateSubmit} className="animate-in-up mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="allocProd">Product</Label>
                    <Select id="allocProd" value={allocProdId?.toString() ?? ""} onChange={(e) => setAllocProdId(e.target.value ? Number(e.target.value) : undefined)} required>
                      <option value="">Select a product…</option>
                      {products?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="allocQty">Quantity</Label>
                    <Input id="allocQty" type="number" min="0.01" step="any" value={allocQty || ""} onChange={(e) => setAllocQty(Number(e.target.value))} placeholder="e.g. 15" required />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" type="button" onClick={() => setShowAllocateForm(false)}>Cancel</Button>
                    <Button size="sm" type="submit" disabled={allocateStock.isPending}>{allocateStock.isPending ? "Allocating…" : "Allocate"}</Button>
                  </div>
                </form>
              )}

              {showTransferForm && (
                <form onSubmit={handleTransferSubmit} className="animate-in-up mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="transferProd">Product</Label>
                    <Select id="transferProd" value={transferProdId?.toString() ?? ""} onChange={(e) => { setTransferProdId(e.target.value ? Number(e.target.value) : undefined); setTransferQty(0); }} required>
                      <option value="">Select a product…</option>
                      {activeShelfAllocations.map((a) => <option key={a.productId} value={a.productId}>{a.productName} ({a.sku}) · {a.quantity} avail</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="transferTgt">Destination shelf</Label>
                    <Select id="transferTgt" value={transferTgtShelfId?.toString() ?? ""} onChange={(e) => setTransferTgtShelfId(e.target.value ? Number(e.target.value) : undefined)} required>
                      <option value="">Select destination…</option>
                      {allShelvesList.filter((s) => s.id !== selectedShelfId).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="transferQty">Quantity</Label>
                    <Input id="transferQty" type="number" min="0.01" step="any" max={activeShelfAllocations.find((a) => a.productId === transferProdId)?.quantity ?? undefined} value={transferQty || ""} onChange={(e) => setTransferQty(Number(e.target.value))} placeholder="e.g. 10" required />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" type="button" onClick={() => setShowTransferForm(false)}>Cancel</Button>
                    <Button size="sm" type="submit" disabled={transferStock.isPending}>{transferStock.isPending ? "Transferring…" : "Transfer"}</Button>
                  </div>
                </form>
              )}

              {/* QR */}
              <div className="mt-6 flex items-center gap-4 border-t border-border pt-5">
                <div className="rounded-lg border border-border p-2">
                  <QRGlyph value={`warehouse://shelf/${activeShelf.id}`} />
                </div>
                <div className="min-w-0">
                  <SectionLabel>Location QR</SectionLabel>
                  <div className="tnum mt-1 truncate text-xs text-muted-foreground">shelf/{activeShelf.id}</div>
                  <Button size="sm" variant="outline" className="mt-2" onClick={copyQRUri}>
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <QrCode className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy URI"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ───────────────────────── CRUD dialogs ───────────────────────── */}
      {whModal && (
        <Dialog open onClose={() => setWhModal(null)} className="max-w-md">
          <form onSubmit={handleWhSubmit} className="space-y-4">
            <DialogHeader><DialogTitle>{whModal.mode === "create" ? "New warehouse" : "Edit warehouse"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="whName">Name</Label><Input id="whName" value={whName} onChange={(e) => setWhName(e.target.value)} placeholder="e.g. Main Warehouse" required autoFocus /></div>
              <div className="space-y-1.5"><Label htmlFor="whLoc">Location (optional)</Label><Input id="whLoc" value={whLoc} onChange={(e) => setWhLoc(e.target.value)} placeholder="e.g. Building A" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWhModal(null)}>Cancel</Button>
              <Button type="submit" disabled={saveWh.isPending}>{saveWh.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
      {aisleModal && (
        <Dialog open onClose={() => setAisleModal(null)} className="max-w-md">
          <form onSubmit={handleAisleSubmit} className="space-y-4">
            <DialogHeader><DialogTitle>{aisleModal.mode === "create" ? "New aisle" : "Edit aisle"}</DialogTitle></DialogHeader>
            <div className="space-y-1.5"><Label htmlFor="aisleName">Name</Label><Input id="aisleName" value={aisleName} onChange={(e) => setAisleName(e.target.value)} placeholder="e.g. Aisle 1" required autoFocus /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAisleModal(null)}>Cancel</Button>
              <Button type="submit" disabled={saveAisle.isPending}>{saveAisle.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
      {rackModal && (
        <Dialog open onClose={() => setRackModal(null)} className="max-w-md">
          <form onSubmit={handleRackSubmit} className="space-y-4">
            <DialogHeader><DialogTitle>{rackModal.mode === "create" ? "New rack" : "Edit rack"}</DialogTitle></DialogHeader>
            <div className="space-y-1.5"><Label htmlFor="rackName">Name</Label><Input id="rackName" value={rackName} onChange={(e) => setRackName(e.target.value)} placeholder="e.g. Rack 10" required autoFocus /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRackModal(null)}>Cancel</Button>
              <Button type="submit" disabled={saveRack.isPending}>{saveRack.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
      {shelfModal && (
        <Dialog open onClose={() => setShelfModal(null)} className="max-w-md">
          <form onSubmit={handleShelfSubmit} className="space-y-4">
            <DialogHeader><DialogTitle>{shelfModal.mode === "create" ? "New shelf" : "Edit shelf"}</DialogTitle></DialogHeader>
            <div className="space-y-1.5"><Label htmlFor="shelfName">Name</Label><Input id="shelfName" value={shelfName} onChange={(e) => setShelfName(e.target.value)} placeholder="e.g. Shelf A1" required autoFocus /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShelfModal(null)}>Cancel</Button>
              <Button type="submit" disabled={saveShelf.isPending}>{saveShelf.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}

/* ───────────────────────── small presentational helpers ───────────────────────── */

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  pct,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
  pct?: number;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            accent ? "bg-gradient-to-br from-primary to-[#7B61FF] text-white" : "bg-primary-wash text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="tnum mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
      {pct !== undefined ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#7B61FF]" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

function Gauge({ pct, warn }: { pct: number; warn?: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * c;
  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={warn ? "#f59e0b" : "hsl(234 56% 60%)"} />
            <stop offset="100%" stopColor={warn ? "#f97316" : "#7B61FF"} />
          </linearGradient>
        </defs>
        <circle cx="38" cy="38" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="tnum absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground">
        {pct}%
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tnum mt-0.5 text-xl font-semibold tracking-tight text-foreground">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

function EmptyMap({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex h-72 flex-col items-center justify-center px-6 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground/40" />
      <p className="text-[15px] font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">{hint}</p>
      {action && <Button size="sm" className="mt-4" onClick={action.onClick}><Plus className="h-4 w-4" /> {action.label}</Button>}
    </div>
  );
}

function IconAction({
  children,
  title,
  onClick,
  danger,
  as = "button",
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  danger?: boolean;
  as?: "button" | "span";
}) {
  const cls = cn(
    "flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors",
    danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-accent hover:text-foreground"
  );
  if (as === "span") {
    return <span role="button" title={title} onClick={onClick} className={cls}>{children}</span>;
  }
  return <button type="button" title={title} onClick={onClick} className={cls}>{children}</button>;
}
