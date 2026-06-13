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
  Warehouse as WarehouseIcon,
  MapPin,
  Activity,
  Info,
  Search,
  Check,
  ChevronRight,
  Settings,
  X,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import type { Warehouse, Aisle, Rack, Shelf, Product } from "@/lib/types";

// Dynamic QR Code SVG Component based on input string hash
function QRPlaceholder({ value }: { value: string }) {
  const getBlocks = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const blocks: { r: number; c: number }[] = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        // Corners: standard QR finder patterns
        const isFinder =
          (r < 4 && c < 4) ||
          (r < 4 && c >= 11) ||
          (r >= 11 && c < 4);
        if (isFinder) {
          const finderBlock =
            (r === 0 || r === 3 || c === 0 || c === 3) ||
            (r === 12 || r === 14 || c === 0 || c === 3) ||
            (r === 0 || r === 3 || c === 12 || c === 14);
          if (finderBlock) blocks.push({ r, c });
        } else {
          // Pseudo-random blocks
          const val = Math.abs(Math.sin(hash + r * 17 + c * 31));
          if (val > 0.5) {
            blocks.push({ r, c });
          }
        }
      }
    }
    return blocks;
  };

  const blocks = React.useMemo(() => getBlocks(value), [value]);

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white border rounded-lg shadow-sm">
      <svg width="100" height="100" viewBox="0 0 15 15" className="text-black fill-current">
        {blocks.map((b, idx) => (
          <rect key={idx} x={b.c} y={b.r} width="1" height="1" />
        ))}
      </svg>
    </div>
  );
}

export default function WarehouseMapping() {
  // --- Data Fetching ---
  const { data: products } = useProducts();
  const { data: warehouses, isLoading: whLoading } = useWarehouses();
  const { data: activities } = useWarehouseActivities();

  // Selections
  const [selectedWhId, setSelectedWhId] = React.useState<number | undefined>();
  const [selectedShelfId, setSelectedShelfId] = React.useState<number | undefined>();

  // Fetch all structural elements
  const { data: aisles, isLoading: aislesLoading } = useAisles(selectedWhId);
  const { data: allRacks } = useRacks();
  const { data: shelves, isLoading: shelvesLoading } = useShelves();

  // Mutations
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

  // --- Search & Highlights State ---
  const [searchQuery, setSearchQuery] = React.useState("");
  const [showSearchResults, setShowSearchResults] = React.useState(false);

  // --- Inline Forms State (within details panel) ---
  const [showAllocateForm, setShowAllocateForm] = React.useState(false);
  const [showTransferForm, setShowTransferForm] = React.useState(false);

  // --- Edit Mode (Toggles Admin Structure Settings) ---
  const [editMode, setEditMode] = React.useState(false);

  // --- CRUD Modal States ---
  const [whModal, setWhModal] = React.useState<{ mode: "create" | "edit"; data?: Warehouse } | null>(null);
  const [aisleModal, setAisleModal] = React.useState<{ mode: "create" | "edit"; warehouse_id: number; data?: Aisle } | null>(null);
  const [rackModal, setRackModal] = React.useState<{ mode: "create" | "edit"; aisle_id: number; data?: Rack } | null>(null);
  const [shelfModal, setShelfModal] = React.useState<{ mode: "create" | "edit"; rack_id: number; data?: Shelf } | null>(null);

  // --- Local Form Inputs ---
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

  // QR Code copied state
  const [copied, setCopied] = React.useState(false);

  // --- Default Selection ---
  React.useEffect(() => {
    if (warehouses && warehouses.length > 0 && selectedWhId === undefined) {
      setSelectedWhId(warehouses[0].id);
    }
  }, [warehouses, selectedWhId]);

  // --- Compute Stock Allocations dynamically from Activity Feed ---
  const computedAllocations = React.useMemo(() => {
    const map = new Map<number, { productId: number; productName: string; sku: string; quantity: number }[]>();
    if (!activities || !products) return map;

    // Sort by ID ascending to replay forward
    const sorted = [...activities].sort((a, b) => a.id - b.id);

    for (const act of sorted) {
      const prod = products.find((p) => p.id === act.product_id);
      if (!prod) continue;

      // Deduct from source shelf
      if (act.source_shelf_id) {
        const list = map.get(act.source_shelf_id) || [];
        const idx = list.findIndex((x) => x.productId === act.product_id);
        if (idx !== -1) {
          list[idx].quantity -= act.quantity;
          if (list[idx].quantity <= 0.0001) {
            list.splice(idx, 1);
          }
        }
        map.set(act.source_shelf_id, list);
      }

      // Add to target shelf
      if (act.target_shelf_id) {
        const list = map.get(act.target_shelf_id) || [];
        const idx = list.findIndex((x) => x.productId === act.product_id);
        if (idx !== -1) {
          list[idx].quantity += act.quantity;
        } else {
          list.push({
            productId: act.product_id,
            productName: prod.name,
            sku: prod.sku,
            quantity: act.quantity,
          });
        }
        map.set(act.target_shelf_id, list);
      }
    }
    return map;
  }, [activities, products]);

  // --- Global Inventory Search Engine ---
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();

    const results: {
      type: "product" | "location";
      title: string;
      subtitle: string;
      shelfId: number;
      aisleId: number;
      whId: number;
      extra?: string;
    }[] = [];

    // Search shelves & warehouse hierarchy
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
            title: `Shelf ${s.name}`,
            subtitle: `${w?.name ?? "WH"} > ${a?.name ?? "Aisle"} > ${r?.name ?? "Rack"}`,
            shelfId: s.id,
            aisleId: a?.id ?? 0,
            whId: w?.id ?? 0,
          });
        }
      }
    }

    // Search products stored in stock allocations
    if (products) {
      for (const prod of products) {
        if (
          prod.name.toLowerCase().includes(q) ||
          prod.sku.toLowerCase().includes(q)
        ) {
          // Find which shelves it resides in
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
                subtitle: `${prod.sku} — Stored in ${w?.name ?? "WH"} > ${a?.name ?? "Aisle"} > ${s?.name ?? "Shelf"}`,
                shelfId: shelfId,
                aisleId: a?.id ?? 0,
                whId: w?.id ?? 0,
                extra: `${match.quantity} Units`,
              });
            }
          });
        }
      }
    }

    return results.slice(0, 8);
  }, [searchQuery, products, shelves, allRacks, aisles, warehouses, computedAllocations]);

  // --- Active selections details ---
  const activeWh = warehouses?.find((w) => w.id === selectedWhId);
  const activeShelf = shelves?.find((s) => s.id === selectedShelfId);
  const activeShelfAllocations = selectedShelfId ? computedAllocations.get(selectedShelfId) || [] : [];
  
  // Find parent context for active shelf
  const activeShelfParentInfo = React.useMemo(() => {
    if (!activeShelf || !allRacks || !aisles || !warehouses) return null;
    const rack = allRacks.find((r) => r.id === activeShelf.rack_id);
    const aisle = aisles.find((a) => a.id === rack?.aisle_id);
    const wh = warehouses.find((w) => w.id === aisle?.warehouse_id);
    return { rack, aisle, wh };
  }, [activeShelf, allRacks, aisles, warehouses]);

  // Max capacity standard (e.g. 100)
  const MAX_CAPACITY = 100;
  const activeShelfQty = activeShelfAllocations.reduce((sum, item) => sum + item.quantity, 0);
  const activeShelfOccupancyPct = Math.min(Math.round((activeShelfQty / MAX_CAPACITY) * 105) / 1.05, 100); // safety cap

  // --- Filtered activities list (filtered contextually for selected shelf) ---
  const filteredActivities = React.useMemo(() => {
    if (!activities) return [];
    if (!selectedShelfId) return activities.slice(0, 10); // Show recent 10 if global
    return activities
      .filter((act) => act.source_shelf_id === selectedShelfId || act.target_shelf_id === selectedShelfId)
      .slice(0, 10);
  }, [activities, selectedShelfId]);

  // --- All shelves dropdown selector list ---
  const allShelvesList = React.useMemo(() => {
    if (!shelves || !warehouses || !aisles || !allRacks) return [];
    return shelves.map((s) => {
      const r = allRacks.find((rx) => rx.id === s.rack_id);
      const a = aisles.find((ax) => ax.id === r?.aisle_id);
      const w = warehouses.find((wx) => wx.id === a?.warehouse_id);
      return {
        id: s.id,
        name: s.name,
        fullName: `${w?.name ?? "Wh"} > ${a?.name ?? "Aisle"} > ${r?.name ?? "Rack"} > ${s.name}`,
      };
    });
  }, [shelves, warehouses, aisles, allRacks]);

  // --- Time Formatter ---
  const formatTimeAgo = (timestampStr: string) => {
    const now = new Date();
    const date = new Date(timestampStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  // --- Search selection handler ---
  const handleSearchResultClick = (result: typeof searchResults[0]) => {
    setSelectedWhId(result.whId);
    setSelectedShelfId(result.shelfId);
    setSearchQuery("");
    setShowSearchResults(false);
    // Hide forms
    setShowAllocateForm(false);
    setShowTransferForm(false);
  };

  // --- Action Submissions ---
  const handleWhSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim()) return;
    saveWh.mutate(
      { id: whModal?.data?.id, name: whName, location: whLoc || null },
      {
        onSuccess: (data) => {
          setSelectedWhId(data.id);
          setWhModal(null);
        },
      }
    );
  };

  const handleAisleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aisleName.trim() || !aisleModal) return;
    saveAisle.mutate(
      { id: aisleModal.data?.id, warehouse_id: aisleModal.warehouse_id, name: aisleName },
      {
        onSuccess: () => {
          setAisleModal(null);
        },
      }
    );
  };

  const handleRackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rackName.trim() || !rackModal) return;
    saveRack.mutate(
      { id: rackModal.data?.id, aisle_id: rackModal.aisle_id, name: rackName },
      {
        onSuccess: () => {
          setRackModal(null);
        },
      }
    );
  };

  const handleShelfSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shelfName.trim() || !shelfModal) return;
    saveShelf.mutate(
      { id: shelfModal.data?.id, rack_id: shelfModal.rack_id, name: shelfName },
      {
        onSuccess: (data) => {
          setSelectedShelfId(data.id);
          setShelfModal(null);
        },
      }
    );
  };

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShelfId || !allocProdId || allocQty <= 0) return;
    allocateStock.mutate(
      { product_id: allocProdId, shelf_id: selectedShelfId, quantity: allocQty },
      {
        onSuccess: () => {
          setShowAllocateForm(false);
          setAllocProdId(undefined);
          setAllocQty(0);
        },
      }
    );
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShelfId || !transferProdId || !transferTgtShelfId || transferQty <= 0) return;
    transferStock.mutate(
      {
        product_id: transferProdId,
        source_shelf_id: selectedShelfId,
        target_shelf_id: transferTgtShelfId,
        quantity: transferQty,
      },
      {
        onSuccess: () => {
          setShowTransferForm(false);
          setTransferProdId(undefined);
          setTransferTgtShelfId(undefined);
          setTransferQty(0);
        },
      }
    );
  };

  const copyQRUri = () => {
    if (!activeShelf) return;
    navigator.clipboard.writeText(`warehouse://shelf/${activeShelf.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Switch to target shelf after simulated lookup scan
  const handleSimulatedScanSelect = (val: string) => {
    if (!val) return;
    const sId = Number(val);
    setSelectedShelfId(sId);
    
    // Auto shift selected warehouse
    const targetShelf = shelves?.find((s) => s.id === sId);
    if (targetShelf) {
      const targetRack = allRacks?.find((r) => r.id === targetShelf.rack_id);
      const targetAisle = aisles?.find((a) => a.id === targetRack?.aisle_id);
      if (targetAisle) {
        setSelectedWhId(targetAisle.warehouse_id);
      }
    }
    setShowAllocateForm(false);
    setShowTransferForm(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] dark:bg-zinc-950">
      
      {/* ========================================== HEADER ========================================== */}
      <header className="sticky top-0 z-40 flex flex-col md:flex-row items-center justify-between gap-4 px-8 py-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg">
            <WarehouseIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-55 animate-fade-in">Warehouse Control Center</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Find, inspect, and route inventories dynamically</p>
          </div>
        </div>

        {/* Global Search Bar (Linear-style) */}
        <div className="relative w-full md:w-96">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search inventory, SKU, shelf, rack..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="w-full pl-9 pr-4 h-9 bg-zinc-50 border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-lg text-sm transition-all shadow-inner placeholder:text-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-2.5 hover:text-zinc-700 text-zinc-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown Overlay */}
          {showSearchResults && searchQuery.trim() && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSearchResults(false)} />
              <div className="absolute left-0 right-0 mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 animate-in fade-in slide-in-from-top-1 duration-150">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    No matching products or locations found
                  </div>
                ) : (
                  searchResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSearchResultClick(res)}
                      className="w-full text-left px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex items-center justify-between text-sm transition-colors"
                    >
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1.5">
                          {res.type === "product" ? (
                            <Package className="h-3.5 w-3.5 text-indigo-500" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          {res.title}
                        </div>
                        <div className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                          {res.subtitle}
                        </div>
                      </div>
                      {res.extra && (
                        <Badge variant="outline" className="font-mono text-[10px] text-indigo-600 bg-indigo-50/50 dark:text-indigo-400 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 shrink-0">
                          {res.extra}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Global Controls & Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setEditMode(false)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                !editMode
                  ? "bg-white dark:bg-zinc-800 shadow text-zinc-800 dark:text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              Control Center
            </button>
            <button
              onClick={() => setEditMode(true)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                editMode
                  ? "bg-white dark:bg-zinc-800 shadow text-indigo-600 dark:text-indigo-400"
                  : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
            >
              <Settings className="h-3 w-3" /> Edit Mode
            </button>
          </div>

          {editMode && (
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1"
              onClick={() => {
                setWhName("");
                setWhLoc("");
                setWhModal({ mode: "create" });
              }}
            >
              <Plus className="h-4 w-4" /> New Warehouse
            </Button>
          )}
        </div>
      </header>

      {/* ========================================== MAIN SPLIT LAYOUT ========================================== */}
      <main className="flex-1 px-8 py-6 grid grid-cols-1 lg:grid-cols-10 gap-8">
        
        {/* ==================== LEFT SIDE (70% - MAP & TIMELINE) ==================== */}
        <section className="lg:col-span-7 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Warehouse Map Box */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-6">
            
            {/* Map Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-indigo-500" />
                <h2 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">Interactive Visual Map</h2>
                {activeWh && (
                  <Badge variant="outline" className="ml-2 bg-zinc-50 border-zinc-200 dark:bg-zinc-800/40 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                    {activeWh.name}
                  </Badge>
                )}
              </div>

              {/* Warehouse Selector & Edit Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select
                  value={selectedWhId?.toString() ?? ""}
                  onChange={(e) => {
                    setSelectedWhId(e.target.value ? Number(e.target.value) : undefined);
                    setSelectedShelfId(undefined);
                  }}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-zinc-50 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                >
                  {whLoading ? (
                    <option>Loading...</option>
                  ) : (
                    warehouses?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))
                  )}
                </select>

                {editMode && activeWh && (
                  <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-950 border dark:border-zinc-800 rounded-lg p-0.5">
                    <button
                      onClick={() => {
                        setWhName(activeWh.name);
                        setWhLoc(activeWh.location || "");
                        setWhModal({ mode: "edit", data: activeWh });
                      }}
                      className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                      title="Edit Warehouse Details"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete warehouse "${activeWh.name}" and all associated structures?`)) {
                          deleteWh.mutate(activeWh.id, {
                            onSuccess: () => setSelectedWhId(undefined),
                          });
                        }
                      }}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                      title="Delete Warehouse"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Visual Grid Map */}
            {whLoading || shelvesLoading || aislesLoading ? (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-400 dark:text-zinc-500 gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-zinc-400" />
                <span className="text-xs">Loading warehouse visuals...</span>
              </div>
            ) : !selectedWhId ? (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 dark:text-zinc-500 p-6">
                <WarehouseIcon className="h-10 w-10 mb-2 text-zinc-300 dark:text-zinc-700" />
                <span className="text-sm font-semibold">No warehouse structure exists</span>
                <span className="text-xs text-center mt-1 max-w-xs">Create a warehouse in Edit Mode to begin map layouts.</span>
              </div>
            ) : aisles?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 dark:text-zinc-500 p-6">
                <MapPin className="h-10 w-10 mb-2 text-zinc-300 dark:text-zinc-700" />
                <span className="text-sm font-semibold">This warehouse is empty</span>
                <span className="text-xs text-center mt-1 max-w-xs">Switch to Edit Mode to create Aisles, Racks, and Shelves.</span>
                {editMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-4 border-zinc-300 dark:border-zinc-700"
                    onClick={() => {
                      setAisleName("");
                      setAisleModal({ mode: "create", warehouse_id: selectedWhId });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add First Aisle
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                {aisles?.map((aisle) => {
                  const aisleRacks = allRacks?.filter((r) => r.aisle_id === aisle.id) || [];
                  
                  return (
                    <div key={aisle.id} className="space-y-3 p-4 bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/80 rounded-xl transition-all">
                      
                      {/* Aisle Title & Edit actions */}
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                          {aisle.name}
                        </span>

                        {editMode && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs font-semibold px-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-indigo-600"
                              onClick={() => {
                                setRackName("");
                                setRackModal({ mode: "create", aisle_id: aisle.id });
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-0.5" /> Add Rack
                            </Button>
                            <button
                              onClick={() => {
                                setAisleName(aisle.name);
                                setAisleModal({ mode: "edit", warehouse_id: aisle.warehouse_id, data: aisle });
                              }}
                              className="p-1 text-zinc-400 hover:text-indigo-600 rounded"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete aisle "${aisle.name}" and all racks inside it?`)) {
                                  deleteAisle.mutate({ id: aisle.id, warehouseId: selectedWhId });
                                }
                              }}
                              className="p-1 text-zinc-400 hover:text-rose-650 rounded"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Racks list */}
                      {aisleRacks.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-400 dark:text-zinc-650 bg-white dark:bg-zinc-900/10">
                          No racks defined.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {aisleRacks.map((rack) => {
                            const rackShelves = shelves?.filter((s) => s.rack_id === rack.id) || [];
                            
                            return (
                              <div key={rack.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-3 space-y-2 shadow-xs">
                                
                                {/* Rack info line */}
                                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 dark:border-zinc-800/50">
                                  <span className="font-semibold text-xs text-zinc-650 dark:text-zinc-400 flex items-center gap-1.5">
                                    <Package className="h-3.5 w-3.5 text-zinc-400" />
                                    {rack.name}
                                  </span>

                                  {editMode && (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-[10px] px-1.5 text-zinc-500 hover:text-indigo-600"
                                        onClick={() => {
                                          setShelfName("");
                                          setShelfModal({ mode: "create", rack_id: rack.id });
                                        }}
                                      >
                                        <Plus className="h-3 w-3 mr-0.5" /> Add Shelf
                                      </Button>
                                      <button
                                        onClick={() => {
                                          setRackName(rack.name);
                                          setRackModal({ mode: "edit", aisle_id: rack.aisle_id, data: rack });
                                        }}
                                        className="p-0.5 text-zinc-400 hover:text-indigo-600 rounded"
                                      >
                                        <Pencil className="h-2.5 w-2.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm(`Delete rack "${rack.name}" and all shelves inside?`)) {
                                            deleteRack.mutate({ id: rack.id, aisleId: aisle.id });
                                          }
                                        }}
                                        className="p-0.5 text-zinc-400 hover:text-rose-600 rounded"
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Shelves rendering (Grid of location tiles) */}
                                {rackShelves.length === 0 ? (
                                  <div className="text-center py-2 text-[10px] text-zinc-400 dark:text-zinc-600">
                                    No shelves on this rack.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                    {rackShelves.map((shelf) => {
                                      const sAllocs = computedAllocations.get(shelf.id) || [];
                                      const sQty = sAllocs.reduce((sum, item) => sum + item.quantity, 0);
                                      const sPct = Math.min(Math.round((sQty / MAX_CAPACITY) * 100), 100);
                                      const isSelected = selectedShelfId === shelf.id;

                                      // Pick color based on capacity
                                      let tileStyles = "";
                                      if (sQty === 0) {
                                        tileStyles = isSelected
                                          ? "border-indigo-600 ring-2 ring-indigo-500/25 bg-indigo-50/10 text-indigo-800 dark:border-indigo-550 dark:bg-indigo-950/20 dark:text-indigo-300"
                                          : "border-emerald-250 bg-emerald-50/10 text-emerald-800 hover:bg-emerald-50/40 hover:border-emerald-300 dark:border-emerald-900/30 dark:bg-emerald-950/10 dark:text-emerald-400 dark:hover:bg-emerald-950/20";
                                      } else if (sPct < 80) {
                                        tileStyles = isSelected
                                          ? "border-indigo-600 ring-2 ring-indigo-500/25 bg-indigo-50/10 text-indigo-800 dark:border-indigo-550 dark:bg-indigo-950/20 dark:text-indigo-300"
                                          : "border-amber-250 bg-amber-50/10 text-amber-800 hover:bg-amber-50/40 hover:border-amber-300 dark:border-amber-900/30 dark:bg-amber-950/10 dark:text-amber-400 dark:hover:bg-amber-950/20";
                                      } else {
                                        tileStyles = isSelected
                                          ? "border-indigo-600 ring-2 ring-indigo-500/25 bg-indigo-50/10 text-indigo-800 dark:border-indigo-550 dark:bg-indigo-950/20 dark:text-indigo-300"
                                          : "border-rose-250 bg-rose-50/10 text-rose-800 hover:bg-rose-50/40 hover:border-rose-300 dark:border-rose-900/30 dark:bg-rose-950/10 dark:text-rose-400 dark:hover:bg-rose-950/20";
                                      }

                                      return (
                                        <div key={shelf.id} className="relative group">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedShelfId(shelf.id);
                                              setShowAllocateForm(false);
                                              setShowTransferForm(false);
                                            }}
                                            className={`w-full p-3 flex flex-col items-center justify-center border rounded-lg transition-all text-center ${tileStyles} ${
                                              isSelected ? "shadow-sm scale-[1.02] border-indigo-600 dark:border-indigo-400 font-bold" : "hover:scale-[1.01]"
                                            }`}
                                          >
                                            <span className="font-semibold text-xs tracking-tight">{shelf.name}</span>
                                            
                                            {/* Micro-occupancy indicator */}
                                            <div className="w-full bg-zinc-200/50 dark:bg-zinc-800/60 rounded-full h-1 mt-1.5 overflow-hidden">
                                              <div
                                                className={`h-full rounded-full ${
                                                  sQty === 0 ? "bg-emerald-500" : sPct < 80 ? "bg-amber-500" : "bg-rose-500"
                                                }`}
                                                style={{ width: `${sPct}%` }}
                                              />
                                            </div>
                                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono mt-1 font-semibold">
                                              {sPct}% Full
                                            </span>
                                          </button>

                                          {/* Tiny shelf actions in Edit Mode */}
                                          {editMode && (
                                            <div className="absolute -top-1.5 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-white dark:bg-zinc-800 border rounded shadow-xs p-0.5 z-10 animate-in fade-in zoom-in-95 duration-100">
                                              <button
                                                onClick={() => {
                                                  setShelfName(shelf.name);
                                                  setShelfModal({ mode: "edit", rack_id: shelf.rack_id, data: shelf });
                                                }}
                                                className="p-0.5 text-zinc-400 hover:text-indigo-600 rounded"
                                              >
                                                <Pencil className="h-2 w-2" />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  if (confirm(`Delete shelf "${shelf.name}"?`)) {
                                                    deleteShelf.mutate({ id: shelf.id, rackId: shelf.rack_id });
                                                  }
                                                }}
                                                className="p-0.5 text-zinc-400 hover:text-rose-600 rounded"
                                              >
                                                <Trash2 className="h-2 w-2" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ==================== Timeline Activity (Priority 3) ==================== */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-500" />
                <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">Warehouse Movements Timeline</h3>
              </div>
              {selectedShelfId ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-zinc-50 border-zinc-200 text-zinc-500 font-semibold px-2 py-0.5 dark:bg-zinc-850 dark:border-zinc-800">
                    Filtered for Shelf: {activeShelf?.name}
                  </Badge>
                  <button
                    onClick={() => setSelectedShelfId(undefined)}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 font-medium animate-pulse"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                <Badge variant="outline" className="text-[10px] bg-zinc-50 border-zinc-200 text-zinc-500 font-semibold px-2 dark:bg-zinc-850 dark:border-zinc-800">
                  Global Feed
                </Badge>
              )}
            </div>

            <div className="flow-root">
              <ul className="-mb-8">
                {filteredActivities.length === 0 ? (
                  <div className="text-center py-8 text-sm text-zinc-400 dark:text-zinc-500 flex flex-col items-center justify-center gap-2">
                    <Activity className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                    <span>No recent movements recorded for this context.</span>
                  </div>
                ) : (
                  filteredActivities.map((act, actIdx) => {
                    const prodName = products?.find((p) => p.id === act.product_id)?.name ?? `#${act.product_id}`;
                    const prodSku = products?.find((p) => p.id === act.product_id)?.sku ?? "";
                    const srcShelf = shelves?.find((s) => s.id === act.source_shelf_id);
                    const tgtShelf = shelves?.find((s) => s.id === act.target_shelf_id);

                    let icon = <ArrowLeftRight className="h-4 w-4" />;
                    let iconBg = "bg-blue-55 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400";
                    let desc = "";

                    if (act.activity_type === "Allocated") {
                      icon = <ArrowDownToLine className="h-4 w-4" />;
                      iconBg = "bg-emerald-50 text-emerald-600 dark:bg-emerald-955/20 dark:text-emerald-400";
                      desc = `Allocated ${act.quantity} units to Shelf ${tgtShelf?.name ?? "Target"}`;
                    } else if (act.activity_type === "Transferred") {
                      icon = <ArrowLeftRight className="h-4 w-4" />;
                      iconBg = "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400";
                      desc = `Transferred ${act.quantity} units from Shelf ${srcShelf?.name ?? "Source"} to Shelf ${tgtShelf?.name ?? "Target"}`;
                    } else if (act.activity_type === "Consumed") {
                      icon = <ArrowUpFromLine className="h-4 w-4" />;
                      iconBg = "bg-rose-50 text-rose-600 dark:bg-rose-955/20 dark:text-rose-400";
                      desc = `Consumed ${act.quantity} units from Shelf ${srcShelf?.name ?? "Source"}`;
                    }

                    return (
                      <li key={act.id}>
                        <div className="relative pb-8">
                          {actIdx !== filteredActivities.length - 1 ? (
                            <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-zinc-200 dark:bg-zinc-800" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-zinc-900 ${iconBg}`}>
                                {icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                  {desc}
                                </p>
                                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1.5">
                                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">{prodName}</span>
                                  {prodSku && <span className="font-mono text-[10px] text-zinc-450 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">SKU: {prodSku}</span>}
                                </p>
                              </div>
                              <div className="text-right text-xs whitespace-nowrap text-zinc-450 dark:text-zinc-500 font-medium">
                                <time dateTime={act.timestamp}>{formatTimeAgo(act.timestamp)}</time>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* ==================== RIGHT SIDE (30% - INSPECTION PANEL) ==================== */}
        <section className="lg:col-span-3">
          
          <div className="sticky top-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-6 space-y-6 self-start">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Info className="h-4 w-4 text-indigo-500" /> Location Details
              </h3>
              {activeShelf && (
                <button
                  onClick={() => {
                    setSelectedShelfId(undefined);
                    setShowAllocateForm(false);
                    setShowTransferForm(false);
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300"
                >
                  Clear Selection
                </button>
              )}
            </div>

            {/* Empty State / Warehouse Stats Summary */}
            {!activeShelf ? (
              <div className="space-y-6">
                <div className="text-center text-zinc-400 dark:text-zinc-500 py-8 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/10 p-4">
                  <LayoutGrid className="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                  No shelf selected. Click a grid tile on the map to inspect stock or perform movements.
                </div>

                {/* Warehouse Summary Stats Card */}
                {activeWh && (
                  <div className="border border-zinc-150 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/30 dark:bg-zinc-950/5 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-55 flex items-center gap-1.5">
                      <WarehouseIcon className="h-3.5 w-3.5" />
                      {activeWh.name} Summary
                    </h4>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-2.5 rounded-lg">
                        <div className="text-zinc-400 dark:text-zinc-500">Total Aisles</div>
                        <div className="text-base font-bold text-zinc-850 dark:text-zinc-100 mt-0.5">{aisles?.length ?? 0}</div>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-2.5 rounded-lg">
                        <div className="text-zinc-400 dark:text-zinc-500">Total Shelves</div>
                        <div className="text-base font-bold text-zinc-850 dark:text-zinc-100 mt-0.5">
                          {shelves?.filter((s) => {
                            const r = allRacks?.find((rx) => rx.id === s.rack_id);
                            const a = aisles?.find((ax) => ax.id === r?.aisle_id);
                            return a?.warehouse_id === activeWh.id;
                          }).length ?? 0}
                        </div>
                      </div>
                    </div>

                    {/* Scanner Simulation lookup trigger */}
                    <div className="space-y-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                        <QrCode className="h-3 w-3" /> QR Scanner Simulator
                      </Label>
                      <select
                        onChange={(e) => handleSimulatedScanSelect(e.target.value)}
                        className="w-full text-xs h-8 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-2 py-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        defaultValue=""
                      >
                        <option value="">-- Choose QR barcode to scan --</option>
                        {allShelvesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* Location Breadcrumbs */}
                <div className="space-y-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 rounded-lg p-3">
                  <div className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
                    Active Storage Path
                  </div>
                  <div className="text-xs text-zinc-700 dark:text-zinc-200 font-semibold flex items-center flex-wrap gap-1">
                    <span>{activeWh?.name}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-400" />
                    <span>{activeShelfParentInfo?.aisle?.name}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-400" />
                    <span>{activeShelfParentInfo?.rack?.name}</span>
                    <ChevronRight className="h-3 w-3 text-zinc-400" />
                    <span className="text-indigo-650 dark:text-indigo-400 font-bold">{activeShelf.name}</span>
                  </div>
                </div>

                {/* Capacity Occupancy Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
                      Capacity Occupancy
                    </span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {activeShelfOccupancyPct}% Used
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        activeShelfQty === 0
                          ? "bg-emerald-500"
                          : activeShelfOccupancyPct < 80
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      style={{ width: `${activeShelfOccupancyPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    <span>{activeShelfQty} Units</span>
                    <span>{MAX_CAPACITY} Max Units</span>
                  </div>
                </div>

                {/* Stored products list */}
                <div className="space-y-2">
                  <h4 className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">
                    Stored Products
                  </h4>

                  {activeShelfAllocations.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-450 dark:text-zinc-500 text-xs bg-zinc-50/30">
                      No stock allocated to this shelf.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-100 dark:border-zinc-800/80 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-zinc-50/10 dark:bg-zinc-950/20">
                      {activeShelfAllocations.map((alloc) => (
                        <div key={alloc.productId} className="flex justify-between items-center p-3 text-xs">
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="font-bold text-zinc-850 dark:text-zinc-200 truncate">{alloc.productName}</div>
                            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">{alloc.sku}</div>
                          </div>
                          <Badge variant="secondary" className="font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded px-2.5 py-0.5">
                            {alloc.quantity} Units
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Visual QR Code segment */}
                <div className="border-t border-b border-zinc-100 dark:border-zinc-800 py-4 flex flex-col sm:flex-row items-center gap-4">
                  <QRPlaceholder value={`warehouse://shelf/${activeShelf.id}`} />
                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Location QR Code</span>
                    <span className="text-[11px] font-mono text-zinc-550 break-all block max-w-[150px]">ID: {activeShelf.id}</span>
                    <div className="flex gap-2 justify-center sm:justify-start">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[10px] flex items-center gap-1 border-zinc-200"
                        onClick={copyQRUri}
                      >
                        {copied ? <Check className="h-3 w-3 text-emerald-650" /> : <QrCode className="h-3 w-3 text-zinc-500" />}
                        {copied ? "Copied" : "Copy URI"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Operations Actions (INLINE IN THE DETAILS PANEL) */}
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      size="sm"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm text-xs font-semibold h-8"
                      onClick={() => {
                        setShowAllocateForm(!showAllocateForm);
                        setShowTransferForm(false);
                      }}
                    >
                      {showAllocateForm ? "Hide Allocate" : "Allocate Stock"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs font-semibold h-8 border-zinc-200 dark:border-zinc-800"
                      disabled={activeShelfAllocations.length === 0}
                      onClick={() => {
                        setShowTransferForm(!showTransferForm);
                        setShowAllocateForm(false);
                        setTransferProdId(activeShelfAllocations[0]?.productId);
                        setTransferTgtShelfId(undefined);
                        setTransferQty(0);
                      }}
                    >
                      {showTransferForm ? "Hide Transfer" : "Transfer Stock"}
                    </Button>
                  </div>

                  {/* Inline Allocate Form */}
                  {showAllocateForm && (
                    <form onSubmit={handleAllocateSubmit} className="border border-zinc-150 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-955/40 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Allocate Inventory</div>
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <Label htmlFor="allocProd" className="text-[10px] text-zinc-450">Product</Label>
                          <select
                            id="allocProd"
                            className="w-full h-8 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 px-2 py-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={allocProdId?.toString() ?? ""}
                            onChange={(e) => setAllocProdId(e.target.value ? Number(e.target.value) : undefined)}
                            required
                          >
                            <option value="">-- Select Product --</option>
                            {products?.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="allocQty" className="text-[10px] text-zinc-455">Quantity</Label>
                          <Input
                            id="allocQty"
                            type="number"
                            min="0.01"
                            step="any"
                            className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            value={allocQty || ""}
                            onChange={(e) => setAllocQty(Number(e.target.value))}
                            placeholder="e.g. 15"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          className="h-7 px-2.5 text-[10px]"
                          onClick={() => setShowAllocateForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          type="submit"
                          className="h-7 px-2.5 text-[10px] bg-indigo-650 text-white"
                          disabled={allocateStock.isPending}
                        >
                          {allocateStock.isPending ? "Allocating..." : "Allocate"}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Inline Transfer Form */}
                  {showTransferForm && (
                    <form onSubmit={handleTransferSubmit} className="border border-zinc-150 dark:border-zinc-800 rounded-lg p-3 bg-zinc-50 dark:bg-zinc-955/40 space-y-3 animate-in slide-in-from-top-2 duration-200">
                      <div className="text-xs font-bold text-zinc-705 dark:text-zinc-300">Transfer Inventory</div>
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <Label htmlFor="transferProd" className="text-[10px] text-zinc-450">Product to Transfer</Label>
                          <select
                            id="transferProd"
                            className="w-full h-8 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 px-2 py-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={transferProdId?.toString() ?? ""}
                            onChange={(e) => {
                              setTransferProdId(e.target.value ? Number(e.target.value) : undefined);
                              setTransferQty(0);
                            }}
                            required
                          >
                            <option value="">-- Select Product --</option>
                            {activeShelfAllocations.map((a) => (
                              <option key={a.productId} value={a.productId}>
                                {a.productName} ({a.sku}) - Avail: {a.quantity}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="transferTgt" className="text-[10px] text-zinc-450">Target Shelf</Label>
                          <select
                            id="transferTgt"
                            className="w-full h-8 text-xs border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 px-2 py-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={transferTgtShelfId?.toString() ?? ""}
                            onChange={(e) => setTransferTgtShelfId(e.target.value ? Number(e.target.value) : undefined)}
                            required
                          >
                            <option value="">-- Select Target Shelf --</option>
                            {allShelvesList
                              .filter((s) => s.id !== selectedShelfId)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.fullName}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="transferQty" className="text-[10px] text-zinc-450">Quantity to Transfer</Label>
                          <Input
                            id="transferQty"
                            type="number"
                            min="0.01"
                            step="any"
                            max={activeShelfAllocations.find((a) => a.productId === transferProdId)?.quantity ?? undefined}
                            className="h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            value={transferQty || ""}
                            onChange={(e) => setTransferQty(Number(e.target.value))}
                            placeholder="e.g. 10"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end pt-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          className="h-7 px-2.5 text-[10px]"
                          onClick={() => setShowTransferForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          type="submit"
                          className="h-7 px-2.5 text-[10px] bg-indigo-650 text-white"
                          disabled={transferStock.isPending}
                        >
                          {transferStock.isPending ? "Transferring..." : "Transfer"}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ========================================== CRUD DIALOGS ========================================== */}

      {/* Warehouse Modal */}
      {whModal && (
        <Dialog open onClose={() => setWhModal(null)}>
          <form onSubmit={handleWhSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {whModal.mode === "create" ? "Create Warehouse" : "Edit Warehouse"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="whName">Warehouse Name</Label>
                <Input
                  id="whName"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="e.g. Main Warehouse"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="whLoc">Location (Optional)</Label>
                <Input
                  id="whLoc"
                  value={whLoc}
                  onChange={(e) => setWhLoc(e.target.value)}
                  placeholder="e.g. Building A"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWhModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveWh.isPending}>
                {saveWh.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}

      {/* Aisle Modal */}
      {aisleModal && (
        <Dialog open onClose={() => setAisleModal(null)}>
          <form onSubmit={handleAisleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {aisleModal.mode === "create" ? "Create Aisle" : "Edit Aisle"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="aisleName">Aisle Name</Label>
                <Input
                  id="aisleName"
                  value={aisleName}
                  onChange={(e) => setAisleName(e.target.value)}
                  placeholder="e.g. Aisle 1"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAisleModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveAisle.isPending}>
                {saveAisle.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}

      {/* Rack Modal */}
      {rackModal && (
        <Dialog open onClose={() => setRackModal(null)}>
          <form onSubmit={handleRackSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {rackModal.mode === "create" ? "Create Rack" : "Edit Rack"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="rackName">Rack Name</Label>
                <Input
                  id="rackName"
                  value={rackName}
                  onChange={(e) => setRackName(e.target.value)}
                  placeholder="e.g. Rack 10"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRackModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveRack.isPending}>
                {saveRack.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}

      {/* Shelf Modal */}
      {shelfModal && (
        <Dialog open onClose={() => setShelfModal(null)}>
          <form onSubmit={handleShelfSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {shelfModal.mode === "create" ? "Create Shelf" : "Edit Shelf"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="shelfName">Shelf Name</Label>
                <Input
                  id="shelfName"
                  value={shelfName}
                  onChange={(e) => setShelfName(e.target.value)}
                  placeholder="e.g. Shelf A1"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShelfModal(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveShelf.isPending}>
                {saveShelf.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}

    </div>
  );
}
