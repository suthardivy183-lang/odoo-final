import { Badge, type BadgeProps } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  // Sales / Purchase / Manufacturing shared
  draft: { label: "Draft", variant: "muted" },
  confirmed: { label: "Confirmed", variant: "info" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  // Sales
  partially_delivered: { label: "Partially Delivered", variant: "warning" },
  fully_delivered: { label: "Fully Delivered", variant: "success" },
  // Purchase
  partially_received: { label: "Partially Received", variant: "warning" },
  fully_received: { label: "Fully Received", variant: "success" },
  // Manufacturing
  in_progress: { label: "In Progress", variant: "warning" },
  done: { label: "Done", variant: "success" },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "muted" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
