import * as React from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, ArrowRight, Boxes, CheckCircle2, ClipboardList, Factory, Gauge, PackageCheck, ShieldCheck, ShoppingCart, TimerReset, TrendingUp } from "lucide-react";
import {
  useActivityTimeline,
  useDashboard,
  useInsights,
  useManufacturingOrders,
  useSalesOrders,
} from "@/hooks/useOrders";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { ActivityEvent, DashboardStats, InsightItem, InsightsResponse, ManufacturingOrder } from "@/lib/types";

type PriorityLevel = "critical" | "high" | "medium" | "healthy";

interface PriorityItem {
  id: string;
  level: PriorityLevel;
  title: string;
  impact: string;
  action: string;
  category: string;
  required?: number;
  available?: number;
  shortage?: number;
}

interface ReadinessRow {
  id: number;
  productName: string;
  maxUnits: number;
  requestedUnits: number;
  bottleneck: string;
  status: "Blocked" | "Constrained" | "Ready" | "In Progress" | "Completed";
}

const numberFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  currency: "INR",
  maximumFractionDigits: 0,
  style: "currency",
});

const PRIORITY_CONFIG: Record<
  PriorityLevel,
  {
    label: string;
    rank: number;
    icon: React.ComponentType<{ className?: string }>;
    row: string;
    pill: string;
    marker: string;
    value: string;
  }
> = {
  critical: {
    label: "Critical",
    rank: 1,
    icon: AlertTriangle,
    row: "border-red-200 bg-red-50/70",
    pill: "bg-red-100 text-red-700 ring-red-200",
    marker: "bg-red-500",
    value: "text-red-700",
  },
  high: {
    label: "High Priority",
    rank: 2,
    icon: TimerReset,
    row: "border-orange-200 bg-orange-50/70",
    pill: "bg-orange-100 text-orange-700 ring-orange-200",
    marker: "bg-orange-500",
    value: "text-orange-700",
  },
  medium: {
    label: "Medium Priority",
    rank: 3,
    icon: Activity,
    row: "border-blue-200 bg-blue-50/70",
    pill: "bg-blue-100 text-blue-700 ring-blue-200",
    marker: "bg-blue-500",
    value: "text-blue-700",
  },
  healthy: {
    label: "Healthy",
    rank: 4,
    icon: CheckCircle2,
    row: "border-emerald-200 bg-emerald-50/70",
    pill: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    marker: "bg-emerald-500",
    value: "text-emerald-700",
  },
};

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? numberFormatter.format(value) : value.toFixed(2);
}

function compactText(value: string, maxLength = 120) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function actionLabel(recommendation: string) {
  const lower = recommendation.toLowerCase();
  if (lower.includes("purchase order") || lower.includes("procure")) return "Create Purchase Order";
  if (lower.includes("manufactur") || lower.includes("production")) return "Increase Production";
  if (lower.includes("supplier") || lower.includes("vendor")) return "Contact Supplier";
  if (lower.includes("review")) return "Review Plan";
  if (lower.includes("prioritize")) return "Prioritize Orders";
  if (lower.includes("maintain") || lower.includes("continue")) return "Continue Monitoring";
  if (lower.includes("replenish") || lower.includes("stock")) return "Replenish Stock";
  return compactText(recommendation, 34);
}

function actionRoute(item: PriorityItem) {
  const source = `${item.title} ${item.action} ${item.category}`.toLowerCase();
  if (source.includes("purchase") || source.includes("procure") || source.includes("supplier") || source.includes("vendor")) {
    return "/purchase";
  }
  if (source.includes("manufactur") || source.includes("production")) return "/manufacturing";
  if (source.includes("sales") || source.includes("order") || source.includes("customer") || source.includes("demand")) {
    return "/sales";
  }
  return "/products";
}

function mapInsight(item: InsightItem, level: PriorityLevel, index: number): PriorityItem {
  return {
    id: `${level}-${index}-${item.title}`,
    level,
    title: item.title,
    impact: compactText(item.impact || item.description),
    action: item.recommendation,
    category: item.category,
    required: item.required,
    available: item.available,
    shortage: item.shortage,
  };
}

function fallbackQueue(stats: DashboardStats): PriorityItem[] {
  const items: PriorityItem[] = [];

  if (stats.products.low_stock_alerts > 0) {
    items.push({
      id: "low-stock",
      level: "high",
      title: "Low Stock Requires Attention",
      impact: `${stats.products.low_stock_alerts} products are below minimum stock.`,
      action: "Replenish Stock",
      category: "inventory",
    });
  }

  if (stats.sales_orders.confirmed > 0) {
    items.push({
      id: "confirmed-orders",
      level: "medium",
      title: "Confirmed Orders Waiting",
      impact: `${stats.sales_orders.confirmed} confirmed sales orders need fulfillment control.`,
      action: "Prioritize Orders",
      category: "sales",
    });
  }

  const activeManufacturing = stats.manufacturing_orders.planned + stats.manufacturing_orders.in_progress;
  if (activeManufacturing > 0) {
    items.push({
      id: "active-manufacturing",
      level: "medium",
      title: "Manufacturing Queue Active",
      impact: `${activeManufacturing} manufacturing orders are planned or in progress.`,
      action: "Review Plan",
      category: "manufacturing",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "stable-operations",
      level: "healthy",
      title: "Operations Stable",
      impact: "No active shortage signals in the dashboard totals.",
      action: "Continue Monitoring",
      category: "operations",
    });
  }

  return items;
}

function buildPriorityQueue(stats: DashboardStats, insights?: InsightsResponse) {
  const insightItems = insights
    ? [
        ...insights.critical_insights.map((item, index) => mapInsight(item, "critical", index)),
        ...insights.warnings.map((item, index) => mapInsight(item, "high", index)),
        ...insights.opportunities.map((item, index) => mapInsight(item, "medium", index)),
        ...insights.successes.map((item, index) => mapInsight(item, "healthy", index)),
      ]
    : [];

  const items = insightItems.length > 0 ? insightItems : fallbackQueue(stats);

  return items.sort((a, b) => PRIORITY_CONFIG[a.level].rank - PRIORITY_CONFIG[b.level].rank);
}

function estimateHealthScore(stats: DashboardStats) {
  const activeManufacturing = stats.manufacturing_orders.planned + stats.manufacturing_orders.in_progress;
  const pendingOrders = stats.sales_orders.confirmed + stats.purchase_orders.ordered;
  const score =
    100 -
    Math.min(stats.products.low_stock_alerts * 12, 42) -
    Math.min(activeManufacturing * 3, 18) -
    Math.min(pendingOrders * 2, 24);

  return clampScore(score);
}

function businessStatus(score: number, criticalCount: number, highPriorityCount: number) {
  if (score < 40 || criticalCount >= 5) return { label: "Critical", className: "text-red-700 bg-red-50 ring-red-200" };
  if (score < 60 || criticalCount >= 3) return { label: "At Risk", className: "text-orange-700 bg-orange-50 ring-orange-200" };
  if (score < 80 || criticalCount > 0 || highPriorityCount > 0) {
    return { label: "Attention Required", className: "text-amber-700 bg-amber-50 ring-amber-200" };
  }
  return { label: "Healthy", className: "text-emerald-700 bg-emerald-50 ring-emerald-200" };
}

function isResolvedLogToday(log: ActivityEvent) {
  const today = new Date().toDateString();
  const logDate = new Date(log.timestamp).toDateString();
  const value = `${log.action} ${log.entity_type} ${log.headline} ${log.changes.map((change) => `${change.before ?? ""} ${change.after ?? ""}`).join(" ")}`;
  return (
    today === logDate &&
    /update/i.test(log.action) &&
    /(Completed|Fully Delivered|Fully Received|Received)/i.test(value)
  );
}

function manufacturingReadiness(orders?: ManufacturingOrder[]): ReadinessRow[] {
  return (orders ?? [])
    .filter((order) => order.status !== "Cancelled")
    .map((order) => {
      if (order.status === "Completed") {
        return {
          id: order.id,
          productName: order.product?.name ?? `Product #${order.product_id}`,
          maxUnits: order.quantity,
          requestedUnits: order.quantity,
          bottleneck: "None",
          status: "Completed" as const,
        };
      }

      const components = order.components ?? [];
      const componentCapacity = components
        .map((component) => {
          const requiredPerUnit = order.quantity > 0 ? component.required_quantity / order.quantity : component.required_quantity;
          const available = component.component_product?.free_to_use_qty ?? component.component_product?.on_hand_qty ?? 0;
          const maxUnits = requiredPerUnit > 0 ? Math.floor(available / requiredPerUnit) : order.quantity;

          return {
            name: component.component_product?.name ?? `Component #${component.component_product_id}`,
            maxUnits,
          };
        })
        .sort((a, b) => a.maxUnits - b.maxUnits);

      const bottleneck = componentCapacity[0];
      const maxUnits = Math.max(0, Math.min(order.quantity, bottleneck?.maxUnits ?? order.quantity));
      const status: ReadinessRow["status"] =
        order.status === "In Progress"
          ? "In Progress"
          : maxUnits <= 0
            ? "Blocked"
            : maxUnits < order.quantity
              ? "Constrained"
              : "Ready";

      return {
        id: order.id,
        productName: order.product?.name ?? `Product #${order.product_id}`,
        maxUnits,
        requestedUnits: order.quantity,
        bottleneck: maxUnits >= order.quantity ? "None" : bottleneck?.name ?? "Component availability",
        status,
      };
    })
    .sort((a, b) => {
      const order = { Blocked: 0, Constrained: 1, "In Progress": 2, Ready: 3, Completed: 4 };
      return order[a.status] - order[b.status];
    })
    .slice(0, 4);
}

function HeaderMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-md", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
          <p className="tnum mt-1 text-3xl font-bold text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PriorityQueue({ items, loading }: { items: PriorityItem[]; loading: boolean }) {
  const navigate = useNavigate();

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-2xl text-slate-950">
              <ClipboardList className="h-6 w-6 text-primary" />
              Priority Queue
            </CardTitle>
            <p className="mt-2 text-sm text-slate-500">Sorted by business impact.</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600">
            {items.length} active signals
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        {loading ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Loading priority queue...
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const config = PRIORITY_CONFIG[item.level];
              const Icon = config.icon;
              const quantities = [
                { label: "Required", value: item.required },
                { label: "Available", value: item.available },
                { label: "Shortage", value: item.shortage },
              ].filter((entry): entry is { label: string; value: number } => entry.value != null);

              return (
                <div
                  key={item.id}
                  className={cn(
                    "grid gap-4 rounded-lg border p-4 transition-colors md:grid-cols-[11rem_minmax(0,1.25fr)_minmax(0,1fr)_13rem] md:items-center",
                    config.row
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("h-12 w-1 rounded-full", config.marker)} />
                    <div>
                      <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold uppercase ring-1", config.pill)}>
                        <Icon className="h-3.5 w-3.5" />
                        {config.label}
                      </div>
                      <p className="mt-2 text-xs font-medium text-slate-500">Queue #{String(index + 1).padStart(2, "0")}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-950">{item.title}</h3>
                    {quantities.length > 0 ? (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {quantities.map((entry) => (
                          <div key={entry.label} className="rounded-md border border-white/80 bg-white/80 p-2">
                            <p className="text-[11px] font-semibold uppercase text-slate-500">{entry.label}</p>
                            <p className={cn("mt-1 text-lg font-bold", entry.label === "Shortage" ? config.value : "text-slate-950")}>
                              {formatNumber(entry.value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm font-medium capitalize text-slate-500">{item.category.replace(/_/g, " ")}</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Impact</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-800">{item.impact}</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Recommended Action</p>
                    <Button
                      type="button"
                      className="mt-2 w-full justify-between bg-slate-950 text-white hover:bg-slate-800"
                      onClick={() => navigate(actionRoute(item))}
                    >
                      {actionLabel(item.action)}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManufacturingReadiness({ rows, loading }: { rows: ReadinessRow[]; loading: boolean }) {
  const statusClass: Record<ReadinessRow["status"], string> = {
    Blocked: "bg-red-50 text-red-700 ring-red-200",
    Constrained: "bg-orange-50 text-orange-700 ring-orange-200",
    "In Progress": "bg-blue-50 text-blue-700 ring-blue-200",
    Ready: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    Completed: "bg-slate-100 text-slate-700 ring-slate-200",
  };

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-slate-100 p-6">
        <CardTitle className="flex items-center gap-2 text-xl text-slate-950">
          <Factory className="h-5 w-5 text-primary" />
          Manufacturing Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading manufacturing readiness...</div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-base font-bold text-emerald-900">Production queue clear</p>
              <p className="mt-1 text-sm text-emerald-700">No active manufacturing orders need material review.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const readiness = row.requestedUnits > 0 ? Math.min(100, Math.round((row.maxUnits / row.requestedUnits) * 100)) : 100;
              return (
                <div key={row.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1.3fr)_12rem_minmax(0,1fr)_12rem] md:items-center">
                  <div>
                    <p className="text-sm font-bold text-slate-950">{row.productName}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">MO-{String(row.id).padStart(4, "0")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Can Produce</p>
                    <p className="tnum mt-1 text-2xl font-bold text-slate-950">{formatNumber(row.maxUnits)} Units</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Current Bottleneck</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{row.bottleneck}</p>
                  </div>
                  <div>
                    <div className="mb-2 h-2 rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-2 rounded-full",
                          row.status === "Blocked" ? "bg-red-500" : row.status === "Constrained" ? "bg-orange-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${readiness}%` }}
                      />
                    </div>
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1", statusClass[row.status])}>
                      {row.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SnapshotCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-semibold uppercase text-slate-400">Live</span>
        </div>
        <p className="mt-5 text-sm font-semibold text-slate-500">{label}</p>
        <p className="tnum mt-2 text-3xl font-bold text-slate-950">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: stats, isLoading: statsLoading } = useDashboard();
  const { data: insights, isLoading: insightsLoading } = useInsights(isAdmin);
  const { data: manufacturingOrders, isLoading: manufacturingLoading } = useManufacturingOrders();
  const { data: salesOrders } = useSalesOrders();
  const { data: auditLogs } = useActivityTimeline({});

  const totalRevenue = React.useMemo(
    () =>
      salesOrders
        ?.filter((order) => ["Completed", "Fully Delivered"].includes(order.status as string))
        .reduce((sum, order) => sum + order.total_amount, 0) ?? 0,
    [salesOrders]
  );

  const resolvedToday = React.useMemo(
    () => auditLogs?.filter(isResolvedLogToday).length ?? 0,
    [auditLogs]
  );

  if (statsLoading || !stats) {
    return (
      <div>
        <PageHeader title="AI Operations Center" description="What is broken, what needs attention, what should happen next." />
        <div className="p-8 text-sm text-slate-500">Loading operations center...</div>
      </div>
    );
  }

  const priorityItems = buildPriorityQueue(stats, insights);
  const criticalCount = priorityItems.filter((item) => item.level === "critical").length;
  const highPriorityCount = priorityItems.filter((item) => item.level === "high").length;
  const healthScore = clampScore(insights?.business_health_score ?? estimateHealthScore(stats));
  const status = businessStatus(healthScore, criticalCount, highPriorityCount);
  const readinessRows = manufacturingReadiness(manufacturingOrders);

  return (
    <div className="min-h-full bg-slate-50">
      <PageHeader title="AI Operations Center" description="What is broken, what needs attention, what should happen next." />

      <div className="space-y-6 p-6 lg:p-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_repeat(3,minmax(11rem,0.6fr))]">
            <div className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase text-slate-400">Business Health</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="tnum text-6xl font-bold leading-none">{healthScore}</span>
                    <span className="pb-2 text-2xl font-semibold text-slate-400">/100</span>
                  </div>
                </div>
                <Gauge className="h-8 w-8 text-red-300" />
              </div>
              <div className="mt-6 h-2 rounded-full bg-white/15">
                <div className="h-2 rounded-full bg-red-400" style={{ width: `${healthScore}%` }} />
              </div>
              <div className={cn("mt-5 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ring-1", status.className)}>
                <ShieldCheck className="h-4 w-4" />
                Status: {status.label}
              </div>
            </div>

            <HeaderMetric icon={AlertTriangle} label="Critical Issues" value={criticalCount} tone="bg-red-50 text-red-700" />
            <HeaderMetric icon={TimerReset} label="High Priority" value={highPriorityCount} tone="bg-orange-50 text-orange-700" />
            <HeaderMetric icon={PackageCheck} label="Resolved Today" value={resolvedToday} tone="bg-emerald-50 text-emerald-700" />
          </div>
        </section>

        <PriorityQueue items={priorityItems} loading={isAdmin && insightsLoading} />

        <ManufacturingReadiness rows={readinessRows} loading={manufacturingLoading} />

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-950">Business Snapshot</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SnapshotCard
              icon={TrendingUp}
              label="Revenue"
              value={currencyFormatter.format(totalRevenue)}
              detail={`${numberFormatter.format(stats.sales_orders.completed)} completed sales orders`}
            />
            <SnapshotCard
              icon={ShoppingCart}
              label="Orders"
              value={numberFormatter.format(stats.sales_orders.total)}
              detail={`${numberFormatter.format(stats.sales_orders.confirmed)} confirmed`}
            />
            <SnapshotCard
              icon={Boxes}
              label="Inventory Value"
              value={currencyFormatter.format(stats.products.total_valuation)}
              detail={`${numberFormatter.format(stats.products.low_stock_alerts)} low stock alerts`}
            />
            <SnapshotCard
              icon={Factory}
              label="Manufacturing Orders"
              value={numberFormatter.format(stats.manufacturing_orders.total)}
              detail={`${numberFormatter.format(stats.manufacturing_orders.in_progress)} in progress`}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
