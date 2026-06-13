import type { Role } from "@/lib/types";

/**
 * Single source of truth for route-level access. `admin` is implicitly allowed
 * everywhere. Keys are route path prefixes; a path matches its key exactly or as
 * a sub-path (e.g. "/sales/123" → "/sales").
 */
export const ROUTE_ROLES: Record<string, Role[]> = {
  "/dashboard": ["admin", "business_owner"],
  "/products": ["admin", "inventory_manager"],
  "/warehouse-mapping": ["admin", "inventory_manager"],
  "/sales": ["admin", "sales"],
  "/purchase": ["admin", "purchase"],
  "/manufacturing": ["admin", "manufacturing"],
  "/bom": ["admin"],
  "/audit-logs": ["admin"],
};

/** Whether a role may view a given route path. */
export function canAccess(role: Role | undefined, path: string): boolean {
  if (!role) return false;
  if (path === "/") return true; // handled by HomeRedirect
  if (role === "admin") return true;
  const key = Object.keys(ROUTE_ROLES).find((k) => path === k || path.startsWith(k + "/"));
  return key ? ROUTE_ROLES[key].includes(role) : false;
}

/** Landing route for each role after login / on "/". */
const HOME: Record<Role, string> = {
  admin: "/dashboard",
  business_owner: "/dashboard",
  sales: "/sales",
  purchase: "/purchase",
  manufacturing: "/manufacturing",
  inventory_manager: "/products",
};

export function homePath(role: Role | undefined): string {
  return role ? HOME[role] : "/login";
}
