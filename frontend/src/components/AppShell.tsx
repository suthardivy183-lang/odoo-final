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
      { to: "/digital-twin", label: "Digital Twin Workspace", icon: Network },
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
    <div className="flex h-screen overflow-hidden bg-canvas app-canvas">
      <aside className="flex w-[252px] shrink-0 flex-col border-r border-white/70 bg-white/78 shadow-[8px_0_30px_-24px_rgba(15,23,42,0.45)] backdrop-blur-2xl">
        {/* Brand */}
        <div className="flex h-16 items-center gap-2.5 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-emphasis text-primary-foreground shadow-[0_8px_18px_-10px_rgba(185,28,28,0.75)] ring-1 ring-white/70">
            <Boxes className="h-[18px] w-[18px]" />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-foreground">Shiv Furniture</div>
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
                          "group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-all",
                          isActive
                            ? "bg-white text-primary shadow-sm ring-1 ring-border/80"
                            : "text-muted-foreground hover:bg-white/70 hover:text-foreground hover:shadow-xs"
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
        <div className="border-t border-white/70 p-3">
          <div className="flex items-center gap-2.5 rounded-md bg-white/58 px-1.5 py-1 shadow-xs ring-1 ring-border/70">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-wash text-[13px] font-semibold text-primary ring-1 ring-primary/20">
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
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
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
    <div className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-white/70 bg-white/64 px-8 py-4 shadow-[0_8px_26px_-24px_rgba(15,23,42,0.5)] backdrop-blur-2xl backdrop-saturate-150">
      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
