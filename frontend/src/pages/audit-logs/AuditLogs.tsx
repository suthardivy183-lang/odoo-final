import * as React from "react";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useAuditLogs } from "@/hooks/useOrders";

const ACTION_VARIANT: Record<string, "success" | "info" | "destructive" | "warning"> = {
  INSERT: "success",
  UPDATE: "info",
  DELETE: "destructive",
  create: "success",
  update: "info",
  delete: "destructive",
};

export default function AuditLogs() {
  const [tableName, setTableName] = React.useState("");
  const [action, setAction] = React.useState("");
  const { data: logs, isLoading } = useAuditLogs({
    table_name: tableName || undefined,
    action: action || undefined,
  });

  return (
    <div>
      <PageHeader title="Audit Logs" description="Every create, update, and delete across all modules" />
      <div className="p-8">
        <div className="mb-4 flex gap-3">
          <Select value={tableName} onChange={(e) => setTableName(e.target.value)} className="w-48">
            <option value="">All tables</option>
            <option value="products">products</option>
            <option value="sales_orders">sales_orders</option>
            <option value="purchase_orders">purchase_orders</option>
            <option value="manufacturing_orders">manufacturing_orders</option>
            <option value="boms">boms</option>
            <option value="users">users</option>
          </Select>
          <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-40">
            <option value="">All actions</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </Select>
        </div>

        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>}
              {!isLoading && logs?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No log entries</TableCell></TableRow>}
              {logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{log.username ?? log.user_id ?? "—"}</TableCell>
                  <TableCell><Badge variant="muted">{log.table_name}</Badge></TableCell>
                  <TableCell className="text-sm">#{log.record_id ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[log.action] ?? "muted"}>{log.action}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {log.new_values ? (
                      <span title={log.new_values}>{log.new_values.slice(0, 80)}{log.new_values.length > 80 ? "…" : ""}</span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
