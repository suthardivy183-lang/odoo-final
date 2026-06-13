import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  Factory,
  Layers,
  ScrollText,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/sales", label: "Sales Orders", icon: ShoppingCart },
  { to: "/purchase", label: "Purchase Orders", icon: Truck },
  { to: "/manufacturing", label: "Manufacturing", icon: Factory },
  { to: "/bom", label: "Bill of Materials", icon: Layers },
  { to: "/audit-logs", label: "Activity Timeline", icon: ScrollText, adminOnly: true },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-muted/30">
      <aside className="flex w-60 flex-col border-r bg-background">
        <div className="flex h-16 items-center border-b px-6">
          <div>
            <div className="text-sm font-bold leading-tight">Shiv Furniture</div>
            <div className="text-xs text-muted-foreground">Works ERP</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 px-3">
            <div className="text-sm font-medium">{user?.username}</div>
            <div className="text-xs capitalize text-muted-foreground">{user?.role}</div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
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
    <div className="flex items-center justify-between border-b bg-background px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
