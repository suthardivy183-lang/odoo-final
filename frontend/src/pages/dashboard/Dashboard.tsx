import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard, useInsights } from "@/hooks/useOrders";
import { useAuth } from "@/lib/auth";

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
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: stats, isLoading } = useDashboard();
  const { data: insights, isLoading: insightsLoading } = useInsights(isAdmin);

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

            {/* Premium Intelligent Insights Panel for Admins */}
            {isAdmin && (
              insightsLoading ? (
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <p className="text-muted-foreground">Loading insights…</p>
                  </CardContent>
                </Card>
              ) : insights ? (
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="border-b bg-slate-50/50 pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <span>✨ Intelligent Insights Panel</span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          AI-driven operational suggestions and shortage alerts.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-500">Business Health Score</span>
                        <div className="flex items-center justify-center w-14 h-14 rounded-full border-4 border-primary/20 bg-primary/5 text-lg font-bold text-primary">
                          {insights.business_health_score}
                        </div>
                      </div>
                    </div>
                    {insights.summary && (
                      <p className="text-sm text-slate-600 mt-3 italic bg-slate-50 p-3 rounded-md border border-slate-100">
                        "{insights.summary}"
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    {/* Critical Shortages */}
                    {insights.critical_insights && insights.critical_insights.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>
                          Critical Shortages ({insights.critical_insights.length})
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                          {insights.critical_insights.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-lg border border-red-200 bg-red-50/50 text-red-900 space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-base">{item.title}</h4>
                                  <span className="inline-block px-2 py-0.5 mt-1 text-xs font-semibold rounded bg-red-100 text-red-800 uppercase tracking-wider">
                                    {item.category}
                                  </span>
                                </div>
                                <span className="text-xs font-medium bg-red-100/80 px-2 py-1 rounded">
                                  Confidence: {item.confidence > 1 ? item.confidence : (item.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-sm opacity-90">{item.description}</p>
                              
                              {/* Shortage details */}
                              {(item.required !== undefined || item.available !== undefined || item.shortage !== undefined) && (
                                <div className="bg-white/80 p-3 rounded border border-red-100 text-sm grid grid-cols-3 gap-2 text-center my-2">
                                  <div>
                                    <div className="text-xs text-red-600 font-semibold uppercase">Required</div>
                                    <div className="text-lg font-bold text-red-900">{item.required ?? 0}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-red-600 font-semibold uppercase">Available</div>
                                    <div className="text-lg font-bold text-red-900">{item.available ?? 0}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-red-600 font-semibold uppercase">Shortage</div>
                                    <div className="text-lg font-bold text-red-700">{item.shortage ?? 0}</div>
                                  </div>
                                </div>
                              )}
                              
                              <div className="text-sm">
                                <span className="font-semibold text-red-900">Impact: </span>
                                <span className="opacity-90">{item.impact}</span>
                              </div>
                              <div className="text-sm p-2 bg-red-100/50 rounded border border-red-200/50">
                                <span className="font-semibold text-red-900">Recommendation: </span>
                                <span className="opacity-95">{item.recommendation}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {insights.warnings && insights.warnings.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                          Warnings ({insights.warnings.length})
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                          {insights.warnings.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 text-amber-900 space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-base">{item.title}</h4>
                                  <span className="inline-block px-2 py-0.5 mt-1 text-xs font-semibold rounded bg-amber-100 text-amber-800 uppercase tracking-wider">
                                    {item.category}
                                  </span>
                                </div>
                                <span className="text-xs font-medium bg-amber-100/80 px-2 py-1 rounded">
                                  Confidence: {item.confidence > 1 ? item.confidence : (item.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-sm opacity-90">{item.description}</p>
                              <div className="text-sm">
                                <span className="font-semibold text-amber-900">Impact: </span>
                                <span className="opacity-90">{item.impact}</span>
                              </div>
                              <div className="text-sm p-2 bg-amber-100/50 rounded border border-amber-200/50">
                                <span className="font-semibold text-amber-900">Recommendation: </span>
                                <span className="opacity-95">{item.recommendation}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Opportunities */}
                    {insights.opportunities && insights.opportunities.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                          Opportunities ({insights.opportunities.length})
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                          {insights.opportunities.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 text-blue-900 space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-base">{item.title}</h4>
                                  <span className="inline-block px-2 py-0.5 mt-1 text-xs font-semibold rounded bg-blue-100 text-blue-800 uppercase tracking-wider">
                                    {item.category}
                                  </span>
                                </div>
                                <span className="text-xs font-medium bg-blue-100/80 px-2 py-1 rounded">
                                  Confidence: {item.confidence > 1 ? item.confidence : (item.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-sm opacity-90">{item.description}</p>
                              <div className="text-sm">
                                <span className="font-semibold text-blue-900">Impact: </span>
                                <span className="opacity-90">{item.impact}</span>
                              </div>
                              <div className="text-sm p-2 bg-blue-100/50 rounded border border-blue-200/50">
                                <span className="font-semibold text-blue-900">Recommendation: </span>
                                <span className="opacity-95">{item.recommendation}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Successes */}
                    {insights.successes && insights.successes.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          Successes ({insights.successes.length})
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                          {insights.successes.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-lg border border-emerald-200 bg-emerald-50/50 text-emerald-900 space-y-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-bold text-base">{item.title}</h4>
                                  <span className="inline-block px-2 py-0.5 mt-1 text-xs font-semibold rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                                    {item.category}
                                  </span>
                                </div>
                                <span className="text-xs font-medium bg-emerald-100/80 px-2 py-1 rounded">
                                  Confidence: {item.confidence > 1 ? item.confidence : (item.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-sm opacity-90">{item.description}</p>
                              <div className="text-sm">
                                <span className="font-semibold text-emerald-900">Impact: </span>
                                <span className="opacity-90">{item.impact}</span>
                              </div>
                              <div className="text-sm p-2 bg-emerald-100/50 rounded border border-emerald-200/50">
                                <span className="font-semibold text-emerald-900">Recommendation: </span>
                                <span className="opacity-95">{item.recommendation}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
