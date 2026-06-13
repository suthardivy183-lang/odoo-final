import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  Draft: { label: "Draft", variant: "muted" },
  Confirmed: { label: "Confirmed", variant: "info" },
  Planned: { label: "Planned", variant: "info" },
  "In Progress": { label: "In Progress", variant: "warning" },
  "Partially Delivered": { label: "Partially Delivered", variant: "warning" },
  "Fully Delivered": { label: "Fully Delivered", variant: "success" },
  "Partially Received": { label: "Partially Received", variant: "warning" },
  "Fully Received": { label: "Fully Received", variant: "success" },
  Completed: { label: "Completed", variant: "success" },
  Cancelled: { label: "Cancelled", variant: "destructive" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
