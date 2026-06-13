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
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
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
    <div className="flex flex-col items-center justify-center p-4 bg-white border rounded-lg shadow-sm">
      <svg width="100" height="100" viewBox="0 0 15 15" className="text-black fill-current">
        {blocks.map((b, idx) => (
          <rect key={idx} x={b.c} y={b.r} width="1" height="1" />
        ))}
      </svg>
      <div className="mt-2 text-[10px] font-mono text-muted-foreground break-all text-center max-w-[180px]">
        {value}
      </div>
    </div>
  );
}

export default function WarehouseMapping() {
  // --- Data Fetching ---
  const { data: products } = useProducts();
  const { data: warehouses, isLoading: whLoading } = useWarehouses();
  const { data: activities } = useWarehouseActivities();

  // --- Selections ---
  const [selectedWhId, setSelectedWhId] = React.useState<number | undefined>();
  const [selectedAisleId, setSelectedAisleId] = React.useState<number | undefined>();
  const [selectedShelfId, setSelectedShelfId] = React.useState<number | undefined>();

  // Fetch children based on selections
  const { data: aisles, isLoading: aislesLoading } = useAisles(selectedWhId);
  const { data: racks, isLoading: racksLoading } = useRacks(selectedAisleId);
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

  // --- Modal States ---
  const [whModal, setWhModal] = React.useState<{ mode: "create" | "edit"; data?: Warehouse } | null>(null);
  const [aisleModal, setAisleModal] = React.useState<{ mode: "create" | "edit"; warehouse_id: number; data?: Aisle } | null>(null);
  const [rackModal, setRackModal] = React.useState<{ mode: "create" | "edit"; aisle_id: number; data?: Rack } | null>(null);
  const [shelfModal, setShelfModal] = React.useState<{ mode: "create" | "edit"; rack_id: number; data?: Shelf } | null>(null);

  const [allocModalOpen, setAllocModalOpen] = React.useState(false);
  const [transferModalOpen, setTransferModalOpen] = React.useState(false);

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

  // --- Reset selections if parent changes ---
  React.useEffect(() => {
    if (warehouses && warehouses.length > 0 && selectedWhId === undefined) {
      setSelectedWhId(warehouses[0].id);
    }
  }, [warehouses, selectedWhId]);

  React.useEffect(() => {
    if (aisles) {
      if (aisles.length > 0) {
        // Only reset if current selected aisle is not in the new aisles list
        const exists = aisles.some((a) => a.id === selectedAisleId);
        if (!exists) {
          setSelectedAisleId(aisles[0].id);
        }
      } else {
        setSelectedAisleId(undefined);
      }
    }
  }, [aisles, selectedAisleId]);

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

  // Find active selections details
  const activeWh = warehouses?.find((w) => w.id === selectedWhId);
  const activeAisle = aisles?.find((a) => a.id === selectedAisleId);
  const activeShelf = shelves?.find((s) => s.id === selectedShelfId);
  const activeShelfAllocations = selectedShelfId ? computedAllocations.get(selectedShelfId) || [] : [];

  // Group shelves by rack_id
  const shelvesByRack = React.useMemo(() => {
    const map = new Map<number, Shelf[]>();
    if (!shelves) return map;
    for (const s of shelves) {
      const list = map.get(s.rack_id) || [];
      list.push(s);
      map.set(s.rack_id, list);
    }
    return map;
  }, [shelves]);

  // Find all shelves for simulated scanner dropdown
  const allShelvesList = React.useMemo(() => {
    if (!shelves || !warehouses || !aisles || !racks) return [];
    return shelves.map((s) => {
      const r = racks.find((rx) => rx.id === s.rack_id);
      const a = aisles.find((ax) => ax.id === r?.aisle_id);
      const w = warehouses.find((wx) => wx.id === a?.warehouse_id);
      return {
        id: s.id,
        name: s.name,
        fullName: `${w?.name ?? "Wh"} > ${a?.name ?? "Aisle"} > ${r?.name ?? "Rack"} > ${s.name}`,
      };
    });
  }, [shelves, warehouses, aisles, racks]);

  // --- Handlers ---
  const handleWhSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim()) return;
    saveWh.mutate(
      {
        id: whModal?.data?.id,
        name: whName,
        location: whLoc || null,
      },
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
      {
        id: aisleModal.data?.id,
        warehouse_id: aisleModal.warehouse_id,
        name: aisleName,
      },
      {
        onSuccess: (data) => {
          setSelectedAisleId(data.id);
          setAisleModal(null);
        },
      }
    );
  };

  const handleRackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rackName.trim() || !rackModal) return;
    saveRack.mutate(
      {
        id: rackModal.data?.id,
        aisle_id: rackModal.aisle_id,
        name: rackName,
      },
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
      {
        id: shelfModal.data?.id,
        rack_id: shelfModal.rack_id,
        name: shelfName,
      },
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
      {
        product_id: allocProdId,
        shelf_id: selectedShelfId,
        quantity: allocQty,
      },
      {
        onSuccess: () => {
          setAllocModalOpen(false);
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
          setTransferModalOpen(false);
          setTransferProdId(undefined);
          setTransferTgtShelfId(undefined);
          setTransferQty(0);
        },
      }
    );
  };

  return (
    <div className="flex flex-col min-h-screen">
      <PageHeader
        title="Warehouse Mapping"
        description="Manage warehouse layout, visual grids, shelves capacity, QR codes, and stock transactions"
        action={
          <div className="flex items-center gap-3">
            {/* Mock QR Scanner Dropdown */}
            <div className="flex items-center gap-2 border bg-muted/30 rounded px-2 py-1">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Scan QR (Mock):</span>
              <Select
                className="h-7 text-xs bg-background py-0 w-44"
                value={selectedShelfId?.toString() ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSelectedShelfId(Number(val));
                    // Automatically switch selector to parent warehouse and aisle if possible
                    const targetShelf = shelves?.find((s) => s.id === Number(val));
                    if (targetShelf) {
                      const targetRack = racks?.find((r) => r.id === targetShelf.rack_id);
                      const targetAisle = aisles?.find((a) => a.id === targetRack?.aisle_id);
                      if (targetAisle) {
                        setSelectedAisleId(targetAisle.id);
                        setSelectedWhId(targetAisle.warehouse_id);
                      }
                    }
                  } else {
                    setSelectedShelfId(undefined);
                  }
                }}
              >
                <option value="">-- Select Shelf --</option>
                {allShelvesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setWhName("");
                setWhLoc("");
                setWhModal({ mode: "create" });
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> New Warehouse
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 space-y-6">
        {/* Top Selectors Bar */}
        <div className="flex flex-wrap items-center gap-6 bg-card p-4 border rounded-lg shadow-sm">
          {/* Warehouse Selector */}
          <div className="flex items-center gap-2">
            <WarehouseIcon className="h-4 w-4 text-primary" />
            <Label className="font-semibold text-sm">Warehouse:</Label>
            <div className="flex items-center gap-1">
              <Select
                className="w-48 h-8"
                value={selectedWhId?.toString() ?? ""}
                onChange={(e) => setSelectedWhId(e.target.value ? Number(e.target.value) : undefined)}
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
              </Select>
              {activeWh && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setWhName(activeWh.name);
                      setWhLoc(activeWh.location || "");
                      setWhModal({ mode: "edit", data: activeWh });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      if (confirm(`Delete warehouse "${activeWh.name}" and all of its structure?`)) {
                        deleteWh.mutate(activeWh.id, {
                          onSuccess: () => setSelectedWhId(undefined),
                        });
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Aisle Selector */}
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <Label className="font-semibold text-sm">Aisle:</Label>
            <div className="flex items-center gap-1">
              <Select
                className="w-40 h-8"
                value={selectedAisleId?.toString() ?? ""}
                onChange={(e) => setSelectedAisleId(e.target.value ? Number(e.target.value) : undefined)}
                disabled={!selectedWhId}
              >
                {aislesLoading ? (
                  <option>Loading...</option>
                ) : (
                  aisles?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))
                )}
              </Select>
              {selectedWhId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setAisleName("");
                    setAisleModal({ mode: "create", warehouse_id: selectedWhId });
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {activeAisle && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setAisleName(activeAisle.name);
                      setAisleModal({
                        mode: "edit",
                        warehouse_id: activeAisle.warehouse_id,
                        data: activeAisle,
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      if (confirm(`Delete aisle "${activeAisle.name}"?`)) {
                        deleteAisle.mutate(
                          { id: activeAisle.id, warehouseId: selectedWhId },
                          {
                            onSuccess: () => setSelectedAisleId(undefined),
                          }
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Grid and Details Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visual Map (Racks & Shelves) */}
          <div className="lg:col-span-2 space-y-6 bg-card border rounded-lg p-6 min-h-[450px]">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-lg">Visual Map Layout</h3>
                <p className="text-xs text-muted-foreground">
                  Click a shelf to view details, allocate, or transfer stock.
                </p>
              </div>
              {selectedAisleId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRackName("");
                    setRackModal({ mode: "create", aisle_id: selectedAisleId });
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Rack
                </Button>
              )}
            </div>

            {racksLoading || shelvesLoading ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                Loading visual map...
              </div>
            ) : !selectedWhId ? (
              <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded text-muted-foreground p-4">
                <WarehouseIcon className="h-8 w-8 mb-2 text-muted-foreground/60" />
                Please select or create a warehouse first.
              </div>
            ) : !selectedAisleId ? (
              <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded text-muted-foreground p-4">
                <MapPin className="h-8 w-8 mb-2 text-muted-foreground/60" />
                Please select or create an aisle in this warehouse.
              </div>
            ) : racks?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 border border-dashed rounded text-muted-foreground p-4">
                No racks in this aisle. Click "Add Rack" above to begin.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {racks?.map((rack) => {
                  const rackShelves = shelvesByRack.get(rack.id) || [];
                  return (
                    <div key={rack.id} className="border rounded-lg bg-muted/20 p-4 space-y-3">
                      <div className="flex items-center justify-between border-b pb-2">
                        <span className="font-medium text-sm text-foreground flex items-center gap-1.5">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {rack.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setShelfName("");
                              setShelfModal({ mode: "create", rack_id: rack.id });
                            }}
                            title="Add Shelf"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setRackName(rack.name);
                              setRackModal({ mode: "edit", aisle_id: rack.aisle_id, data: rack });
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={() => {
                              if (confirm(`Delete rack "${rack.name}" and all of its shelves?`)) {
                                deleteRack.mutate({ id: rack.id, aisleId: selectedAisleId });
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {rackShelves.length === 0 ? (
                        <div className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded">
                          No shelves
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {rackShelves.map((shelf) => {
                            const allocs = computedAllocations.get(shelf.id) || [];
                            const isOccupied = allocs.length > 0;
                            const totalQty = allocs.reduce((acc, curr) => acc + curr.quantity, 0);

                            return (
                              <button
                                key={shelf.id}
                                onClick={() => setSelectedShelfId(shelf.id)}
                                className={`flex flex-col items-start p-3 text-left border rounded-lg transition-all ${
                                  selectedShelfId === shelf.id
                                    ? "ring-2 ring-primary border-primary bg-primary/5"
                                    : isOccupied
                                    ? "border-green-300 bg-green-50/50 hover:bg-green-50"
                                    : "border-dashed border-muted-foreground/30 bg-background hover:bg-muted/10"
                                }`}
                              >
                                <span className="font-semibold text-xs">{shelf.name}</span>
                                <div className="mt-1 flex items-center justify-between w-full">
                                  <Badge
                                    variant={isOccupied ? "success" : "muted"}
                                    className="text-[10px] px-1 py-0"
                                  >
                                    {isOccupied ? "Occupied" : "Empty"}
                                  </Badge>
                                  {isOccupied && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      {totalQty} units
                                    </span>
                                  )}
                                </div>
                                {isOccupied && (
                                  <div className="mt-1.5 text-[10px] text-muted-foreground w-full truncate font-medium">
                                    {allocs.map((a) => `${a.sku}(${a.quantity})`).join(", ")}
                                  </div>
                                )}
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
          </div>

          {/* Details Sidebar Panel */}
          <div className="bg-card border rounded-lg p-6 space-y-6 self-start shadow-sm">
            <div className="border-b pb-3 flex items-center justify-between">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> Shelf Details
              </h3>
              {activeShelf && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      setShelfName(activeShelf.name);
                      setShelfModal({
                        mode: "edit",
                        rack_id: activeShelf.rack_id,
                        data: activeShelf,
                      });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => {
                      if (confirm(`Delete shelf "${activeShelf.name}"?`)) {
                        deleteShelf.mutate(
                          { id: activeShelf.id, rackId: activeShelf.rack_id },
                          {
                            onSuccess: () => setSelectedShelfId(undefined),
                          }
                        );
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {!activeShelf ? (
              <div className="text-center text-muted-foreground py-12 text-sm border border-dashed rounded-lg">
                Select a shelf in the visual map or use the QR scanner simulator to inspect details.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Location Path Info */}
                <div className="space-y-1 text-xs">
                  <div className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                    Full Location Path
                  </div>
                  <div className="font-medium text-foreground">
                    {activeWh?.name} &rarr; {activeAisle?.name} &rarr;{" "}
                    {racks?.find((r) => r.id === activeShelf.rack_id)?.name} &rarr; {activeShelf.name}
                  </div>
                </div>

                {/* QR Code Segment */}
                <div className="flex flex-col items-center border-t border-b py-4">
                  <QRPlaceholder value={`warehouse://shelf/${activeShelf.id}`} />
                  <span className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                    URI ID: {activeShelf.id}
                  </span>
                </div>

                {/* Allocations & Stock */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground uppercase font-semibold text-[10px] tracking-wider">
                      Stock Allocations
                    </span>
                    <Badge variant="muted">Capacity: 100 max</Badge>
                  </div>

                  {activeShelfAllocations.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground py-6 border border-dashed rounded bg-muted/10">
                      No stock allocated to this shelf.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded divide-y bg-background">
                      {activeShelfAllocations.map((alloc) => (
                        <div key={alloc.productId} className="flex justify-between items-center p-2 text-xs">
                          <div>
                            <div className="font-semibold text-foreground">{alloc.productName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{alloc.sku}</div>
                          </div>
                          <div className="font-bold text-foreground bg-muted/40 px-2 py-0.5 rounded">
                            {alloc.quantity} units
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setAllocProdId(undefined);
                      setAllocQty(0);
                      setAllocModalOpen(true);
                    }}
                  >
                    Allocate Stock
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={activeShelfAllocations.length === 0}
                    onClick={() => {
                      setTransferProdId(activeShelfAllocations[0]?.productId);
                      setTransferTgtShelfId(undefined);
                      setTransferQty(0);
                      setTransferModalOpen(true);
                    }}
                  >
                    Transfer Stock
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Warehouse Activity Feed */}
        <div className="bg-card border rounded-lg p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b pb-3">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Recent Movements &amp; Activity</h3>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Source Shelf</TableHead>
                  <TableHead>Target Shelf</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!activities || activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No recent movement activity logged.
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((act) => {
                    const prodName = products?.find((p) => p.id === act.product_id)?.name ?? `#${act.product_id}`;
                    const prodSku = products?.find((p) => p.id === act.product_id)?.sku ?? "";

                    const sourceShelfName = shelves?.find((s) => s.id === act.source_shelf_id)?.name ?? `ID ${act.source_shelf_id}`;
                    const targetShelfName = shelves?.find((s) => s.id === act.target_shelf_id)?.name ?? `ID ${act.target_shelf_id}`;

                    return (
                      <TableRow key={act.id}>
                        <TableCell>
                          {act.activity_type === "Allocated" ? (
                            <ArrowDownToLine className="h-4 w-4 text-green-600" />
                          ) : act.activity_type === "Transferred" ? (
                            <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                          ) : (
                            <ArrowUpFromLine className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              act.activity_type === "Allocated"
                                ? "success"
                                : act.activity_type === "Transferred"
                                ? "info"
                                : "destructive"
                            }
                          >
                            {act.activity_type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-xs">{prodName}</div>
                            {prodSku && <div className="text-[10px] text-muted-foreground font-mono">{prodSku}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-xs">
                          {act.quantity}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {act.source_shelf_id ? sourceShelfName : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {act.target_shelf_id ? targetShelfName : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(act.timestamp).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* --- CRUD Modals --- */}

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

      {/* Allocate Stock Modal */}
      {allocModalOpen && (
        <Dialog open onClose={() => setAllocModalOpen(false)}>
          <form onSubmit={handleAllocateSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Allocate Stock to Shelf {activeShelf?.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="allocProd">Product</Label>
                <Select
                  id="allocProd"
                  className="w-full h-9"
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
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="allocQty">Quantity</Label>
                <Input
                  id="allocQty"
                  type="number"
                  min="0.01"
                  step="any"
                  value={allocQty || ""}
                  onChange={(e) => setAllocQty(Number(e.target.value))}
                  placeholder="e.g. 15"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAllocModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={allocateStock.isPending}>
                {allocateStock.isPending ? "Allocating..." : "Allocate"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}

      {/* Transfer Stock Modal */}
      {transferModalOpen && (
        <Dialog open onClose={() => setTransferModalOpen(false)}>
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Transfer Stock from Shelf {activeShelf?.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="transferProd">Product to Transfer</Label>
                <Select
                  id="transferProd"
                  className="w-full h-9"
                  value={transferProdId?.toString() ?? ""}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setTransferProdId(val);
                    // Reset quantity
                    setTransferQty(0);
                  }}
                  required
                >
                  <option value="">-- Select Product --</option>
                  {activeShelfAllocations.map((a) => (
                    <option key={a.productId} value={a.productId}>
                      {a.productName} ({a.sku}) - Available: {a.quantity}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="transferTgt">Target Shelf</Label>
                <Select
                  id="transferTgt"
                  className="w-full h-9"
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
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="transferQty">Quantity to Transfer</Label>
                <Input
                  id="transferQty"
                  type="number"
                  min="0.01"
                  step="any"
                  max={activeShelfAllocations.find((a) => a.productId === transferProdId)?.quantity ?? undefined}
                  value={transferQty || ""}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  placeholder="e.g. 10"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={transferStock.isPending}>
                {transferStock.isPending ? "Transferring..." : "Transfer"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
