import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Factory,
  FlaskConical,
  Layers,
  ScrollText,
  LogOut,
  Warehouse,
  Boxes,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "AI Ops Center", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { to: "/sales", label: "Sales Orders", icon: ShoppingCart },
      { to: "/purchase", label: "Purchase Orders", icon: Truck },
      { to: "/manufacturing", label: "Manufacturing", icon: Factory },
      { to: "/warehouse-mapping", label: "Warehouse Mapping", icon: Warehouse },
      { to: "/digital-twin", label: "Digital Twin", icon: Network },
      { to: "/simulation", label: "Business Simulation Center", icon: FlaskConical },
    ],
  },
  {
    label: "Catalog",
    items: [
      { to: "/products", label: "Products", icon: Package },
      { to: "/bom", label: "Bill of Materials", icon: Layers },
    ],
  },
  {
    label: "System",
    items: [{ to: "/audit-logs", label: "Activity Timeline", icon: ScrollText, adminOnly: true }],
  },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const initial = (user?.username?.[0] ?? "?").toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside className="flex w-[244px] shrink-0 flex-col border-r border-border bg-background">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-emphasis text-primary-foreground shadow-sm">
            <Boxes className="h-[18px] w-[18px]" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight text-foreground">Shiv Furniture</div>
            <div className="text-[11px] font-medium text-muted-foreground">Works ERP</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => canAccess(user?.role, item.to));
            if (items.length === 0) return null;
            return (
              <div key={group.label}>
                <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors",
                          isActive
                            ? "bg-primary/[0.08] text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={cn(
                              "h-[18px] w-[18px] shrink-0 transition-colors",
                              isActive ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"
                            )}
                          />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-secondary-foreground ring-1 ring-border">
              {initial}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-medium text-foreground">{user?.username}</div>
              <div className="truncate text-[11px] capitalize text-muted-foreground">{user?.role}</div>
            </div>
            <button
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background/60 px-8 py-4 backdrop-blur-xl backdrop-saturate-150">
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
