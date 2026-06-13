import * as React from "react";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useAuditLogs } from "@/hooks/useOrders";

const ACTION_VARIANT: Record<string, "success" | "info" | "destructive"> = {
  create: "success",
  update: "info",
  delete: "destructive",
};

export default function AuditLogs() {
  const [module, setModule] = React.useState("");
  const [action, setAction] = React.useState("");
  const { data: logs, isLoading } = useAuditLogs({ module: module || undefined, action: action || undefined });

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every create, update, and delete across all modules" />
      <div className="p-8">
        <div className="mb-4 flex gap-3">
          <Select value={module} onChange={(e) => setModule(e.target.value)} className="w-48">
            <option value="">All modules</option>
            <option value="products">Products</option>
            <option value="sales">Sales</option>
            <option value="purchase">Purchase</option>
            <option value="manufacturing">Manufacturing</option>
            <option value="bom">BoM</option>
            <option value="vendors">Vendors</option>
            <option value="users">Users</option>
          </Select>
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-40">
            <option value="">All actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </Select>
        </div>

        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Timestamp</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old → New</TableHead>
                <TableHead className="w-16">User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {logs?.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No log entries</TableCell></TableRow>}
              {logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell><Badge variant="muted">{log.module}</Badge></TableCell>
                  <TableCell className="text-sm">{log.record_type} {log.record_id ? `#${log.record_id}` : ""}</TableCell>
                  <TableCell><Badge variant={ACTION_VARIANT[log.action]}>{log.action}</Badge></TableCell>
                  <TableCell className="text-sm">{log.field_changed ?? "—"}</TableCell>
                  <TableCell className="text-xs">
                    {log.field_changed ? (
                      <span><span className="text-destructive line-through">{log.old_value ?? "∅"}</span>{" → "}<span className="text-green-700">{log.new_value ?? "∅"}</span></span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{log.user_id ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
