import * as React from "react";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.js";
import CircleDollarSign from "lucide-react/dist/esm/icons/circle-dollar-sign.js";
import Clock3 from "lucide-react/dist/esm/icons/clock-3.js";
import CopyCheck from "lucide-react/dist/esm/icons/copy-check.js";
import FlaskConical from "lucide-react/dist/esm/icons/flask-conical.js";
import GitCompareArrows from "lucide-react/dist/esm/icons/git-compare-arrows.js";
import Landmark from "lucide-react/dist/esm/icons/landmark.js";
import PackageSearch from "lucide-react/dist/esm/icons/package-search.js";
import Play from "lucide-react/dist/esm/icons/play.js";
import Route from "lucide-react/dist/esm/icons/route.js";
import ShieldAlert from "lucide-react/dist/esm/icons/shield-alert.js";
import TriangleAlert from "lucide-react/dist/esm/icons/triangle-alert.js";
import WandSparkles from "lucide-react/dist/esm/icons/wand-sparkles.js";
import Warehouse from "lucide-react/dist/esm/icons/warehouse.js";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useBoms, useManufacturingOrders, usePurchaseOrders, useSalesOrders } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";
import type { BillOfMaterials, Product, PurchaseOrder } from "@/lib/types";

type ScenarioType =
  | "sales-order"
  | "demand-increase"
  | "supplier-failure"
  | "inventory-reduction"
  | "price-change"
  | "production-expansion";

interface MaterialLine {
  id: number;
  name: string;
  sku: string;
  required: number;
  available: number;
  shortage: number;
  unitCost: number;
  supplier: string;
  supplierAvailable: boolean;
}

interface SimulationResult {
  label: string;
  quantity: number;
  canFulfill: boolean;
  materialLines: MaterialLine[];
  estimatedRevenue: number;
  estimatedCost: number;
  procurementCost: number;
  projectedProfit: number;
  margin: number;
  completionDays: number;
  productionStatus: "Ready" | "Capacity Constrained" | "Material Blocked";
  currentOccupancy: number;
  projectedOccupancy: number;
  warehouseRisk: "Stable" | "Near Maximum Capacity" | "Over Capacity";
  riskCount: number;
  rootCauses: Array<{
    title: string;
    reason: string;
    affectedProcess: string;
    impact: string;
  }>;
}

const SCENARIOS: Array<{ value: ScenarioType; label: string; hint: string }> = [
  { value: "sales-order", label: "New Sales Order", hint: "Simulate a large customer order before accepting it." },
  { value: "demand-increase", label: "Demand Increase", hint: "Project fulfillment impact from demand growth." },
  { value: "supplier-failure", label: "Supplier Failure", hint: "Remove a supplier from the virtual plan." },
  { value: "inventory-reduction", label: "Inventory Reduction", hint: "Stress test inventory loss or reservation changes." },
  { value: "price-change", label: "Price Change", hint: "Estimate profit impact from raw material inflation." },
  { value: "production-expansion", label: "Production Expansion", hint: "Model extra daily production capacity." },
];

const currency = new Intl.NumberFormat("en-IN", { currency: "INR", maximumFractionDigits: 0, style: "currency" });
const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

const BASE_DAILY_CAPACITY = 250;
const WAREHOUSE_CAPACITY_UNITS = 50000;

function getProductName(product?: Product) {
  return product ? product.name : "Select a product";
}

function getScenarioQuantity(type: ScenarioType, baseQuantity: number, percentage: number, productId: number, salesOrders?: { lines: { product_id: number; quantity: number }[] }[]) {
  if (type !== "demand-increase") return baseQuantity;

  const currentDemand =
    salesOrders?.reduce((sum, order) => {
      return sum + order.lines.reduce((lineSum, line) => lineSum + (line.product_id === productId ? line.quantity : 0), 0);
    }, 0) ?? baseQuantity;

  return Math.max(1, Math.round(currentDemand * (percentage / 100)));
}

function incomingPurchaseQuantity(productId: number, purchaseOrders?: PurchaseOrder[]) {
  return (
    purchaseOrders
      ?.filter((po) => ["Confirmed", "Partially Received"].includes(po.status))
      .flatMap((po) => po.lines)
      .filter((line) => line.product_id === productId)
      .reduce((sum, line) => sum + Math.max(0, line.quantity - line.received_qty), 0) ?? 0
  );
}

function findBom(product: Product | undefined, boms?: BillOfMaterials[]) {
  if (!product) return undefined;
  return boms?.find((bom) => bom.id === product.bom_id || bom.product_id === product.id);
}

function buildSimulation({
  label,
  product,
  bom,
  products,
  purchaseOrders,
  activeManufacturingQty,
  quantity,
  scenarioType,
  percentage,
  failedSupplier,
}: {
  label: string;
  product?: Product;
  bom?: BillOfMaterials;
  products?: Product[];
  purchaseOrders?: PurchaseOrder[];
  activeManufacturingQty: number;
  quantity: number;
  scenarioType: ScenarioType;
  percentage: number;
  failedSupplier: string;
}): SimulationResult {
  const inventoryAdjustment = scenarioType === "inventory-reduction" ? Math.max(0, 1 - percentage / 100) : 1;
  const priceMultiplier = scenarioType === "price-change" ? 1 + percentage / 100 : 1;
  const dailyCapacity = scenarioType === "production-expansion" ? BASE_DAILY_CAPACITY * (1 + percentage / 100) : BASE_DAILY_CAPACITY;
  const currentInventoryUnits = products?.reduce((sum, item) => sum + item.on_hand_qty, 0) ?? 0;
  const materialLines =
    bom?.components.map((component) => {
      const material = component.component_product ?? products?.find((item) => item.id === component.component_product_id);
      const supplier = material?.vendor_id ?? "Unassigned supplier";
      const supplierAvailable = !(scenarioType === "supplier-failure" && failedSupplier && supplier === failedSupplier);
      const required = component.quantity * quantity;
      const stockAvailable = (material?.free_to_use_qty ?? material?.on_hand_qty ?? 0) * inventoryAdjustment;
      const incoming = supplierAvailable ? incomingPurchaseQuantity(component.component_product_id, purchaseOrders) : 0;
      const available = supplierAvailable ? stockAvailable + incoming : 0;
      const shortage = Math.max(0, required - available);

      return {
        id: component.component_product_id,
        name: material?.name ?? `Material #${component.component_product_id}`,
        sku: material?.sku ?? `#${component.component_product_id}`,
        required,
        available,
        shortage,
        unitCost: (material?.cost_price ?? 0) * priceMultiplier,
        supplier,
        supplierAvailable,
      };
    }) ?? [];

  const materialCost = materialLines.reduce((sum, line) => sum + line.required * line.unitCost, 0);
  const procurementCost = materialLines.reduce((sum, line) => sum + line.shortage * line.unitCost, 0);
  const operationCost = Math.max(0, bom?.operations.reduce((sum, op) => sum + op.standard_time_minutes, 0) ?? 180) * quantity * 0.45;
  const estimatedCost = materialCost + operationCost;
  const estimatedRevenue = (product?.sales_price ?? 0) * quantity;
  const projectedProfit = estimatedRevenue - estimatedCost;
  const margin = estimatedRevenue > 0 ? (projectedProfit / estimatedRevenue) * 100 : 0;
  const completionDays = Math.max(1, Math.ceil((quantity + activeManufacturingQty * 0.35) / dailyCapacity));
  const currentOccupancy = Math.min(100, (currentInventoryUnits / WAREHOUSE_CAPACITY_UNITS) * 100);
  const projectedOccupancy = Math.min(140, ((currentInventoryUnits + quantity) / WAREHOUSE_CAPACITY_UNITS) * 100);
  const warehouseRisk = projectedOccupancy > 100 ? "Over Capacity" : projectedOccupancy >= 90 ? "Near Maximum Capacity" : "Stable";
  const hasShortage = materialLines.some((line) => line.shortage > 0);
  const productionStatus = hasShortage ? "Material Blocked" : completionDays > 14 ? "Capacity Constrained" : "Ready";

  const rootCauses: SimulationResult["rootCauses"] = [];
  const topShortage = [...materialLines].sort((a, b) => b.shortage - a.shortage)[0];

  if (topShortage?.shortage > 0) {
    rootCauses.push({
      title: "Material shortage detected",
      reason: `${topShortage.name} is short by ${number.format(topShortage.shortage)} units.`,
      affectedProcess: `${product?.name ?? "Product"} manufacturing`,
      impact: `Production cannot complete until procurement covers ${number.format(topShortage.shortage)} units.`,
    });
  }

  if (warehouseRisk !== "Stable") {
    rootCauses.push({
      title: "Warehouse constraint detected",
      reason: `Projected occupancy reaches ${percent.format(projectedOccupancy)}%.`,
      affectedProcess: "Finished goods storage",
      impact: warehouseRisk === "Over Capacity" ? "Shipments or storage overflow need a mitigation plan." : "Receiving and staging space will be tight.",
    });
  }

  if (completionDays > 14) {
    rootCauses.push({
      title: "Production bottleneck detected",
      reason: `${number.format(quantity)} units require ${completionDays} production days at current simulated capacity.`,
      affectedProcess: `${product?.name ?? "Product"} manufacturing`,
      impact: `Completion is delayed by ${Math.max(0, completionDays - 14)} days beyond a two-week planning window.`,
    });
  }

  if (scenarioType === "supplier-failure" && failedSupplier) {
    rootCauses.push({
      title: "Supplier risk detected",
      reason: `${failedSupplier} is unavailable in this simulation workspace.`,
      affectedProcess: "Procurement planning",
      impact: "Affected material availability is removed until an alternate supplier is selected.",
    });
  }

  return {
    label,
    quantity,
    canFulfill: !hasShortage && warehouseRisk !== "Over Capacity",
    materialLines,
    estimatedRevenue,
    estimatedCost,
    procurementCost,
    projectedProfit,
    margin,
    completionDays,
    productionStatus,
    currentOccupancy,
    projectedOccupancy,
    warehouseRisk,
    riskCount: rootCauses.length,
    rootCauses,
  };
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone: string;
}) {
  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold uppercase text-slate-400">Simulation</span>
        </div>
        <p className="mt-5 text-sm font-semibold text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 p-5">
        <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
          <Icon className="h-5 w-5 text-slate-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function OccupancyBar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-100">
      <div className={cn("h-2 rounded-full", tone)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export default function BusinessSimulationCenter() {
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: boms } = useBoms();
  const { data: purchaseOrders } = usePurchaseOrders();
  const { data: manufacturingOrders } = useManufacturingOrders();
  const { data: salesOrders } = useSalesOrders();
  const finishedProducts = React.useMemo(
    () => (products ?? []).filter((product) => product.is_bom_item || product.category === "Finished Good"),
    [products]
  );
  const suppliers = React.useMemo(
    () => Array.from(new Set((products ?? []).map((product) => product.vendor_id).filter((vendor): vendor is string => Boolean(vendor)))),
    [products]
  );
  const [scenarioType, setScenarioType] = React.useState<ScenarioType>("sales-order");
  const [productId, setProductId] = React.useState<number | null>(null);
  const [quantityInput, setQuantityInput] = React.useState(5000);
  const [percentageInput, setPercentageInput] = React.useState(30);
  const [failedSupplier, setFailedSupplier] = React.useState("");
  const [lastRunAt, setLastRunAt] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (!productId && finishedProducts[0]) setProductId(finishedProducts[0].id);
  }, [finishedProducts, productId]);

  React.useEffect(() => {
    if (!failedSupplier && suppliers[0]) setFailedSupplier(suppliers[0]);
  }, [failedSupplier, suppliers]);

  const selectedProduct = products?.find((product) => product.id === productId);
  const selectedBom = findBom(selectedProduct, boms);
  const scenarioQuantity = getScenarioQuantity(scenarioType, quantityInput, percentageInput, productId ?? 0, salesOrders);
  const activeManufacturingQty =
    manufacturingOrders
      ?.filter((order) => ["Planned", "In Progress"].includes(order.status))
      .reduce((sum, order) => sum + order.quantity, 0) ?? 0;

  const result = buildSimulation({
    label: "Scenario A",
    product: selectedProduct,
    bom: selectedBom,
    products,
    purchaseOrders,
    activeManufacturingQty,
    quantity: scenarioQuantity,
    scenarioType,
    percentage: percentageInput,
    failedSupplier,
  });

  const comparison = buildSimulation({
    label: "Scenario B",
    product: selectedProduct,
    bom: selectedBom,
    products,
    purchaseOrders,
    activeManufacturingQty,
    quantity: Math.max(1, Math.round(scenarioQuantity * 1.4)),
    scenarioType,
    percentage: percentageInput,
    failedSupplier,
  });

  const scenario = SCENARIOS.find((item) => item.value === scenarioType) ?? SCENARIOS[0];
  const topShortages = result.materialLines.filter((line) => line.shortage > 0);
  const sufficientMaterials = result.materialLines.filter((line) => line.shortage <= 0);
  const materialStatus = result.canFulfill ? "Can fulfill" : "Needs intervention";

  return (
    <div className="min-h-full bg-slate-50">
      <PageHeader title="Business Simulation Center" description="Run a virtual version of the company before committing to a decision." />

      <div className="space-y-6 p-6 lg:p-8">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="p-6 lg:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">Scenario workspace</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Temporary simulation only. Live inventory, orders, procurement, and manufacturing records are never modified.
                  </p>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                  Virtual environment
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-2 xl:col-span-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Simulation Input</span>
                  <Select value={scenarioType} onChange={(event) => setScenarioType(event.target.value as ScenarioType)}>
                    {SCENARIOS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2 xl:col-span-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Product</span>
                  <Select value={productId ?? ""} onChange={(event) => setProductId(Number(event.target.value))} disabled={productsLoading}>
                    {finishedProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase text-slate-500">{scenarioType === "sales-order" ? "Quantity" : "Value"}</span>
                  <Input
                    min={1}
                    type="number"
                    value={scenarioType === "sales-order" ? quantityInput : percentageInput}
                    onChange={(event) =>
                      scenarioType === "sales-order" ? setQuantityInput(Number(event.target.value)) : setPercentageInput(Number(event.target.value))
                    }
                  />
                </label>
              </div>

              {scenarioType === "supplier-failure" && (
                <label className="mt-4 block space-y-2">
                  <span className="text-xs font-bold uppercase text-slate-500">Unavailable Supplier</span>
                  <Select value={failedSupplier} onChange={(event) => setFailedSupplier(event.target.value)} className="max-w-md">
                    {suppliers.map((supplier) => (
                      <option key={supplier} value={supplier}>
                        {supplier}
                      </option>
                    ))}
                  </Select>
                </label>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button className="h-10 bg-slate-950 px-5 text-white hover:bg-slate-800" onClick={() => setLastRunAt(new Date())}>
                  <Play className="h-4 w-4" />
                  Run Simulation
                </Button>
                <p className="text-sm text-slate-500">{scenario.hint}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-950 p-6 text-white xl:border-l xl:border-t-0">
              <div className="flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="text-sm font-semibold uppercase text-slate-400">Simulation Result</p>
                  <h3 className="mt-3 text-4xl font-bold leading-tight">{number.format(result.quantity)} {getProductName(selectedProduct)}</h3>
                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {materialStatus}. {result.riskCount} risk signal{result.riskCount === 1 ? "" : "s"} detected before commitment.
                  </p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">Latest run</p>
                  <p className="mt-1 text-sm font-medium">{lastRunAt ? lastRunAt.toLocaleString() : "Ready to simulate"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            icon={CopyCheck}
            label="Can We Fulfill This?"
            value={result.canFulfill ? "Yes" : "Not Yet"}
            detail={result.productionStatus}
            tone={result.canFulfill ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}
          />
          <SummaryCard icon={CircleDollarSign} label="Estimated Revenue" value={currency.format(result.estimatedRevenue)} detail="Based on current sales price" tone="bg-blue-50 text-blue-700" />
          <SummaryCard icon={Landmark} label="Estimated Cost" value={currency.format(result.estimatedCost)} detail={`${currency.format(result.procurementCost)} procurement gap`} tone="bg-slate-100 text-slate-700" />
          <SummaryCard icon={WandSparkles} label="Projected Profit" value={currency.format(result.projectedProfit)} detail={`${percent.format(result.margin)}% margin`} tone="bg-emerald-50 text-emerald-700" />
          <SummaryCard icon={Clock3} label="Completion Time" value={`${result.completionDays} Days`} detail={`${number.format(BASE_DAILY_CAPACITY)} units/day baseline`} tone="bg-orange-50 text-orange-700" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
          <SectionCard title="Material Requirement Breakdown" icon={PackageSearch}>
            <div className="space-y-3">
              {result.materialLines.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                  No Bill of Materials found for {getProductName(selectedProduct)}.
                </div>
              ) : (
                result.materialLines.map((line) => (
                  <div key={line.id} className="grid gap-3 rounded-lg border border-slate-200 p-4 md:grid-cols-[minmax(0,1.2fr)_repeat(3,8rem)_9rem] md:items-center">
                    <div>
                      <p className="font-bold text-slate-950">{line.name}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{line.sku} · {line.supplier}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Required</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{number.format(line.required)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Available</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{number.format(line.available)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Shortage</p>
                      <p className={cn("mt-1 text-lg font-bold", line.shortage > 0 ? "text-red-700" : "text-emerald-700")}>{number.format(line.shortage)}</p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-center text-xs font-bold ring-1", line.shortage > 0 ? "bg-red-50 text-red-700 ring-red-200" : "bg-emerald-50 text-emerald-700 ring-emerald-200")}>
                      {line.shortage > 0 ? "Procure" : "Sufficient"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="Risk Analysis" icon={ShieldAlert}>
            <div className="space-y-3">
              {result.rootCauses.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-bold text-emerald-900">No blocking risks detected</p>
                  <p className="mt-1 text-sm text-emerald-700">The virtual plan fits current materials, capacity, and warehouse assumptions.</p>
                </div>
              ) : (
                result.rootCauses.map((cause) => (
                  <div key={cause.title} className="rounded-lg border border-red-100 bg-red-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                      <div>
                        <p className="font-bold text-red-950">{cause.title}</p>
                        <p className="mt-2 text-sm text-red-800"><span className="font-semibold">Reason:</span> {cause.reason}</p>
                        <p className="mt-1 text-sm text-red-800"><span className="font-semibold">Affected Process:</span> {cause.affectedProcess}</p>
                        <p className="mt-1 text-sm text-red-800"><span className="font-semibold">Impact:</span> {cause.impact}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <SectionCard title="Manufacturing Impact" icon={Route}>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">Current Capacity</span>
                <span className="text-xl font-bold text-slate-950">{number.format(BASE_DAILY_CAPACITY)} Units/Day</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500">Production Required</span>
                <span className="text-xl font-bold text-slate-950">{number.format(result.quantity)} Units</span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Production Status</p>
                <p className="mt-2 text-lg font-bold text-slate-950">{result.productionStatus}</p>
                <p className="mt-1 text-sm text-slate-500">Estimated completion: {result.completionDays} days.</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Warehouse Impact" icon={Warehouse}>
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-500">Current Occupancy</span>
                  <span>{percent.format(result.currentOccupancy)}%</span>
                </div>
                <OccupancyBar value={result.currentOccupancy} tone="bg-blue-500" />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-semibold">
                  <span className="text-slate-500">Projected Occupancy</span>
                  <span>{percent.format(result.projectedOccupancy)}%</span>
                </div>
                <OccupancyBar value={result.projectedOccupancy} tone={result.warehouseRisk === "Stable" ? "bg-emerald-500" : "bg-orange-500"} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase text-slate-500">Risk</p>
                <p className="mt-2 text-lg font-bold text-slate-950">{result.warehouseRisk}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Procurement Impact" icon={Landmark}>
            <div className="space-y-4">
              {topShortages.length === 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-bold text-emerald-900">No additional purchases required</p>
                  <p className="mt-1 text-sm text-emerald-700">{sufficientMaterials.length} material lines are sufficient.</p>
                </div>
              ) : (
                topShortages.map((line) => (
                  <div key={line.id} className="rounded-lg border border-slate-200 p-4">
                    <p className="font-bold text-slate-950">{line.name}</p>
                    <p className="mt-2 text-sm text-slate-500">Additional purchase: {number.format(line.shortage)} units</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">{currency.format(line.shortage * line.unitCost)}</p>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <SectionCard title="Financial Impact" icon={CircleDollarSign}>
            <div className="grid gap-4 sm:grid-cols-4">
              {[
                ["Estimated Revenue", currency.format(result.estimatedRevenue)],
                ["Estimated Cost", currency.format(result.estimatedCost)],
                ["Projected Profit", currency.format(result.projectedProfit)],
                ["Profit Margin", `${percent.format(result.margin)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
                  <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Scenario Comparison" icon={GitCompareArrows}>
            <div className="grid gap-3">
              {[result, comparison].map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-950">{item.label}</p>
                    <span className={cn("rounded-full px-2 py-1 text-xs font-bold", item.riskCount > 0 ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700")}>
                      {item.riskCount} risks
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">{number.format(item.quantity)} units</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Profit</p>
                      <p className="mt-1 font-bold text-slate-950">{currency.format(item.projectedProfit)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase text-slate-500">Time</p>
                      <p className="mt-1 font-bold text-slate-950">{item.completionDays} days</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Convert simulation into real actions</h2>
              <p className="mt-1 text-sm text-slate-500">Review and approve before anything writes to live ERP records.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {["Generate Purchase Order", "Generate Manufacturing Order", "Reserve Inventory", "Approve Production Plan"].map((action) => (
                <Button key={action} variant="outline" className="justify-between">
                  {action}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
