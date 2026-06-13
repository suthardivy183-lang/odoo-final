import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { useDashboard } from "@/hooks/useOrders";
import { useProducts } from "@/hooks/useProducts";

function StatGroup({ title, counts }: { title: string; counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-baseline justify-between">
          <span>{title}</span>
          <span className="text-2xl font-bold">{total}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(counts)
          .filter(([, n]) => n > 0)
          .map(([status, n]) => (
            <div key={status} className="flex items-center justify-between text-sm">
              <StatusBadge status={status} />
              <span className="font-medium">{n}</span>
            </div>
          ))}
        {total === 0 && <p className="text-sm text-muted-foreground">No orders yet</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboard();
  const { data: products } = useProducts();

  const lowStock = (products ?? []).filter(
    (p) => Number(p.free_to_use_qty) <= 0 && p.product_type === "storable"
  );

  return (
    <div>
      <PageHeader title="Dashboard" description="Order overview across all modules" />
      <div className="p-8">
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatGroup title="Sales Orders" counts={stats?.sales ?? {}} />
              <StatGroup title="Purchase Orders" counts={stats?.purchase ?? {}} />
              <StatGroup title="Manufacturing" counts={stats?.manufacturing ?? {}} />
            </div>

            {lowStock.length > 0 && (
              <Card className="mt-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-amber-700">
                    ⚠ {lowStock.length} product(s) out of free stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {lowStock.map((p) => (
                      <span key={p.id} className="rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-800">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
