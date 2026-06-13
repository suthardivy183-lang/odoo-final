import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/hooks/useOrders";

function StatCard({ title, stats }: { title: string; stats: Record<string, number | string> }) {
  const entries = Object.entries(stats).filter(([k]) => k !== "total" && k !== "total_valuation");
  const total = stats["total"] ?? stats["total_products"];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-baseline justify-between text-base">
          <span>{title}</span>
          {total !== undefined && <span className="text-2xl font-bold">{total}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="capitalize text-muted-foreground">{k.replace(/_/g, " ")}</span>
            <span className="font-medium">{typeof v === "number" && k.includes("valuation") ? `₹${v.toFixed(0)}` : v}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboard();

  return (
    <div>
      <PageHeader title="Dashboard" description="Order & inventory overview" />
      <div className="p-8">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard title="Sales Orders" stats={stats.sales_orders} />
              <StatCard title="Purchase Orders" stats={stats.purchase_orders} />
              <StatCard title="Manufacturing" stats={stats.manufacturing_orders} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StatCard title="Products" stats={{
                "Total Products": stats.products.total,
                "Finished Goods": stats.products.finished_goods,
                "Raw Materials": stats.products.raw_materials,
                "Low Stock Alerts": stats.products.low_stock_alerts,
                "Inventory Value (₹)": stats.products.total_valuation,
              }} />
              {stats.products.low_stock_alerts > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-amber-800">⚠ Low Stock Alert</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-amber-700">
                      {stats.products.low_stock_alerts} product(s) are below their minimum stock level. Check the Products page.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
