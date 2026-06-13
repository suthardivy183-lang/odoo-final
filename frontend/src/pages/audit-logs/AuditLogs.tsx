import * as React from "react";
import { PageHeader } from "@/components/AppShell";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useActivityTimeline, useActivityUsers } from "@/hooks/useOrders";
import type { ActivityEvent } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Activity, ArrowRight, Factory, Filter, Layers, Package, ShoppingCart, Truck, User } from "lucide-react";

const ENTITY_FILTERS = [
  { value: "", label: "All Activities" },
  { value: "sales_orders", label: "Sales Orders" },
  { value: "products", label: "Products" },
  { value: "purchase_orders", label: "Purchase Orders" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "boms", label: "Bill of Materials" },
];

const ENTITY_ICONS: Record<string, React.ElementType> = {
  Product: Package,
  "Sales Order": ShoppingCart,
  "Purchase Order": Truck,
  "Manufacturing Order": Factory,
  "Bill of Materials": Layers,
  User: User,
};

const ENTITY_COLORS: Record<string, string> = {
  Product: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  "Sales Order": "bg-blue-100 text-blue-700 ring-blue-200",
  "Purchase Order": "bg-violet-100 text-violet-700 ring-violet-200",
  "Manufacturing Order": "bg-amber-100 text-amber-700 ring-amber-200",
  "Bill of Materials": "bg-slate-100 text-slate-700 ring-slate-200",
  User: "bg-rose-100 text-rose-700 ring-rose-200",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getDateGroup(timestamp: string): string {
  const date = new Date(timestamp);
  const today = startOfDay(new Date());
  const eventDay = startOfDay(date);
  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Last Week";
  if (diffDays <= 30) return "Last 30 Days";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function groupByDate(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const groups: { label: string; events: ActivityEvent[] }[] = [];
  const map = new Map<string, ActivityEvent[]>();

  for (const event of events) {
    const label = getDateGroup(event.timestamp);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(event);
  }

  const order = ["Today", "Yesterday", "Last Week", "Last 30 Days"];
  for (const label of order) {
    if (map.has(label)) groups.push({ label, events: map.get(label)! });
  }
  for (const [label, evts] of map) {
    if (!order.includes(label)) groups.push({ label, events: evts });
  }
  return groups;
}

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials}
    </div>
  );
}

function ChangeRow({ label, before, after }: { label: string; before: string | null; after: string | null }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      {before != null && after != null ? (
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="text-muted-foreground line-through decoration-muted-foreground/50">{before}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span>{after}</span>
        </span>
      ) : after != null ? (
        <span className="font-medium">{after}</span>
      ) : before != null ? (
        <span className="font-medium text-muted-foreground line-through">{before}</span>
      ) : null}
    </div>
  );
}

function ActivityEntry({ event }: { event: ActivityEvent }) {
  const Icon = ENTITY_ICONS[event.entity_type] ?? Activity;
  const colorClass = ENTITY_COLORS[event.entity_type] ?? "bg-gray-100 text-gray-700 ring-gray-200";

  return (
    <div className="group relative flex gap-4 pb-8 last:pb-0">
      <div className="absolute left-[18px] top-10 bottom-0 w-px bg-border group-last:hidden" />
      <div className={cn("relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-2", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-base font-semibold leading-snug text-foreground">{event.headline}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <UserAvatar name={event.user} />
              <span>{event.user}</span>
              <span aria-hidden>·</span>
              <span>{event.entity_type}</span>
            </div>
          </div>
          <time className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">
            {formatTime(event.timestamp)}
          </time>
        </div>
        {event.changes.length > 0 && (
          <div className="mt-3 space-y-1.5 rounded-lg border bg-muted/30 px-4 py-3">
            {event.changes.map((change, i) => (
              <ChangeRow key={i} label={change.label} before={change.before} after={change.after} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivityTimeline() {
  const [entityType, setEntityType] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const filters = React.useMemo(
    () => ({
      entity_type: entityType || undefined,
      username: username || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    }),
    [entityType, username, dateFrom, dateTo]
  );

  const { data: events, isLoading } = useActivityTimeline(filters);
  const { data: users } = useActivityUsers();
  const groups = React.useMemo(() => groupByDate(events ?? []), [events]);

  const hasFilters = entityType || username || dateFrom || dateTo;

  return (
    <div>
      <PageHeader
        title="Activity Timeline"
        description="See who did what across your business — sales, inventory, purchasing, and production"
      />
      <div className="p-8">
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Activity Type</label>
              <Select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-44"
              >
                {ENTITY_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">User</label>
              <Select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-40"
              >
                <option value="">All Users</option>
                {users?.map((u) => (
                  <option key={u} value={u}>
                    {u.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setEntityType("");
                  setUsername("");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="self-end rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-background p-6 shadow-sm">
          {isLoading && (
            <p className="py-12 text-center text-muted-foreground">Loading activity…</p>
          )}
          {!isLoading && events?.length === 0 && (
            <div className="py-16 text-center">
              <Activity className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No activity found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters ? "Try adjusting your filters." : "Business activity will appear here as your team works."}
              </p>
            </div>
          )}
          {!isLoading && groups.length > 0 && (
            <div className="space-y-10">
              {groups.map((group) => (
                <section key={group.label}>
                  <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </h2>
                  <div>
                    {group.events.map((event) => (
                      <ActivityEntry key={event.id} event={event} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
