import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, RefreshCw, X, AlertCircle, Info, HelpCircle, Plus, Minus, Maximize2 } from "lucide-react";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  status: "green" | "yellow" | "red";
  details: any;
  x?: number;
  y?: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  quantity?: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: {
    total_revenue_at_risk: number;
    critical_shortages_count: number;
    delayed_orders_count: number;
  };
}

export default function DigitalTwin() {
  // 1. Fetch initial graph data
  const { data: rawData, isLoading, refetch } = useQuery<GraphData>({
    queryKey: ["digital-twin-graph"],
    queryFn: async () => (await api.get<GraphData>("/digital-twin/graph")).data,
  });

  const [nodes, setNodes] = React.useState<GraphNode[]>([]);
  const [edges, setEdges] = React.useState<GraphEdge[]>([]);
  const [summary, setSummary] = React.useState<GraphData["summary"] | null>(null);
  const [selectedNode, setSelectedNode] = React.useState<GraphNode | null>(null);

  // Find all available finished goods from raw graph data
  const finishedGoods = React.useMemo(() => {
    if (!rawData) return [];
    return rawData.nodes.filter(
      (node) =>
        node.type === "product" &&
        node.details?.category === "Finished Good"
    );
  }, [rawData]);

  // Zoom and Pan state
  const [scale, setScale] = React.useState<number>(0.7);
  const [offset, setOffset] = React.useState<{ x: number; y: number }>({ x: 80, y: 40 });
  const [isDragging, setIsDragging] = React.useState<boolean>(false);
  const dragStart = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDragged = React.useRef<boolean>(false);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Simulation Center state
  const [simSku, setSimSku] = React.useState<string>("");
  const [simQty, setSimQty] = React.useState<number>(1);
  const [isSimulating, setIsSimulating] = React.useState<boolean>(false);
  const [simResults, setSimResults] = React.useState<{
    feasible: boolean;
    revenueAtRisk: number;
    shortages: { rmSku: string; name: string; needed: number; available: number; missing: number }[];
  } | null>(null);

  // Process raw data into layered columns
  React.useEffect(() => {
    if (!rawData) return;
    if (isSimulating) return; // Do not overwrite if currently in a simulation

    layoutGraph(rawData.nodes, rawData.edges, rawData.summary);
  }, [rawData]);

  const layoutGraph = (rawNodes: GraphNode[], rawEdges: GraphEdge[], rawSummary: GraphData["summary"]) => {
    const processedNodes = JSON.parse(JSON.stringify(rawNodes)) as GraphNode[];
    const processedEdges = JSON.parse(JSON.stringify(rawEdges)) as GraphEdge[];

    // Classify Finished Goods vs Raw Materials for column mapping
    processedNodes.forEach((node) => {
      if (node.type === "product") {
        if (node.details.category === "Finished Good") {
          node.type = "product_fg";
        } else {
          node.type = "product_rm";
        }
      }
    });

    // Column mapping index
    const colMap: Record<string, number> = {
      customer: 0,
      sales_order: 1,
      product_fg: 2,
      bom: 3,
      manufacturing_order: 3,
      product_rm: 4,
      shelf: 5,
      warehouse: 5,
      purchase_order: 6,
      supplier: 7,
    };

    // Group nodes into columns
    const columns: Record<number, GraphNode[]> = {};
    for (let i = 0; i <= 7; i++) {
      columns[i] = [];
    }

    processedNodes.forEach((node) => {
      const col = colMap[node.type] ?? 0;
      columns[col].push(node);
    });

    // Layout configuration
    const colWidth = 260;
    const rowHeight = 90;
    const maxNodes = Math.max(...Object.values(columns).map((col) => col.length));
    const maxHeight = maxNodes * rowHeight;

    // Position each node
    Object.keys(columns).forEach((colIdxStr) => {
      const colIdx = parseInt(colIdxStr, 10);
      const colNodes = columns[colIdx];
      const colHeight = colNodes.length * rowHeight;
      const startY = (maxHeight - colHeight) / 2;

      colNodes.forEach((node, nodeIdx) => {
        node.x = colIdx * colWidth + colWidth / 2;
        node.y = startY + nodeIdx * rowHeight + rowHeight / 2;
      });
    });

    setNodes(processedNodes);
    setEdges(processedEdges);
    setSummary(rawSummary);
  };

  // Zoom and Pan Handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    hasDragged.current = false;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      const dx = Math.abs(e.clientX - (dragStart.current.x + offset.x));
      const dy = Math.abs(e.clientY - (dragStart.current.y + offset.y));
      if (dx > 3 || dy > 3) {
        hasDragged.current = true;
      }
      setOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Helper to zoom centered at a specific SVG container point (x, y)
  const zoomAtPoint = React.useCallback((x: number, y: number, factor: number) => {
    setScale((prevScale) => {
      const newScale = Math.max(0.15, Math.min(prevScale * factor, 4));
      if (newScale === prevScale) return prevScale;

      setOffset((prevOffset) => {
        const xs = (x - prevOffset.x) / prevScale;
        const ys = (y - prevOffset.y) / prevScale;
        return {
          x: x - xs * newScale,
          y: y - ys * newScale,
        };
      });
      return newScale;
    });
  }, []);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Smooth exponential zoom based on deltaY (prevents wild zooming on trackpads and mice)
    const factor = Math.max(0.8, Math.min(1.2, Math.exp(-e.deltaY * 0.001)));
    zoomAtPoint(mouseX, mouseY, factor);
  };

  const handleZoomIn = () => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    zoomAtPoint(centerX, centerY, 1.15);
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    zoomAtPoint(centerX, centerY, 1 / 1.15);
  };

  // Auto-fit / Center Graph in viewport
  const fitToScreen = React.useCallback((customNodes?: GraphNode[]) => {
    const nodesToUse = customNodes || nodes;
    if (!nodesToUse || nodesToUse.length === 0 || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const width = rect.width || svgRef.current.clientWidth || 800;
    const height = rect.height || svgRef.current.clientHeight || 600;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodesToUse.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined) {
        const nMinX = node.x - 75;
        const nMaxX = node.x + 75;
        const nMinY = node.y - 25;
        const nMaxY = node.y + 25;

        if (nMinX < minX) minX = nMinX;
        if (nMaxX > maxX) maxX = nMaxX;
        if (nMinY < minY) minY = nMinY;
        if (nMaxY > maxY) maxY = nMaxY;
      }
    });

    if (minX === Infinity || minY === Infinity) return;

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    const padding = 60;
    const scaleX = (width - padding * 2) / graphWidth;
    const scaleY = (height - padding * 2) / graphHeight;
    let newScale = Math.min(scaleX, scaleY);

    newScale = Math.max(0.15, Math.min(newScale, 1.2));

    const centerX = minX + graphWidth / 2;
    const centerY = minY + graphHeight / 2;

    const newOffsetX = width / 2 - centerX * newScale;
    const newOffsetY = height / 2 - centerY * newScale;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  }, [nodes]);

  // Run fitToScreen when nodes are loaded/updated
  React.useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitToScreen(nodes);
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [nodes, fitToScreen]);

  // Simulation Logic
  const runSimulation = () => {
    if (!rawData) return;
    if (!simSku.trim()) return;

    const targetFG = rawData.nodes.find(
      (n) =>
        n.type === "product" &&
        n.details.category === "Finished Good" &&
        n.details.sku.toLowerCase() === simSku.trim().toLowerCase()
    );

    if (!targetFG) {
      alert(`SKU '${simSku}' not found or is not a Finished Good.`);
      return;
    }

    setIsSimulating(true);

    // Deep copy nodes and edges for virtual mutations
    const simNodes = JSON.parse(JSON.stringify(rawData.nodes)) as GraphNode[];
    const simEdges = JSON.parse(JSON.stringify(rawData.edges)) as GraphEdge[];

    // Rename node types for classification
    simNodes.forEach((node) => {
      if (node.type === "product") {
        if (node.details.category === "Finished Good") {
          node.type = "product_fg";
        } else {
          node.type = "product_rm";
        }
      }
    });

    const fgNodeId = targetFG.id;
    const virtualRequirements: Record<string, number> = {};

    // Recursive BOM explosion in frontend
    const explode = (nodeId: string, qty: number) => {
      const bomEdge = simEdges.find((e) => e.source === nodeId && e.type === "manufactured_via");
      if (!bomEdge) {
        // Raw material/leaf
        virtualRequirements[nodeId] = (virtualRequirements[nodeId] || 0) + qty;
        return;
      }
      const bomId = bomEdge.target;
      const requiresEdges = simEdges.filter((e) => e.source === bomId && e.type === "requires");
      requiresEdges.forEach((reqEdge) => {
        const componentId = reqEdge.target;
        const compQty = (reqEdge.quantity || 0) * qty;
        explode(componentId, compQty);
      });
    };

    explode(fgNodeId, simQty);

    // Evaluate shortages
    const shortagesList: { rmSku: string; name: string; needed: number; available: number; missing: number }[] = [];
    let isFeasible = true;

    simNodes.forEach((node) => {
      if (node.type === "product_rm") {
        const required = virtualRequirements[node.id] || 0;
        if (required > 0) {
          const available = node.details.free_to_use;
          if (required > available) {
            isFeasible = false;
            const missing = required - available;
            node.status = "red";
            node.details = {
              ...node.details,
              simulated_required: required,
              simulated_shortage: missing,
            };
            shortagesList.push({
              rmSku: node.details.sku,
              name: node.label,
              needed: required,
              available: available,
              missing: missing,
            });
          } else {
            node.status = "yellow";
            node.details = {
              ...node.details,
              simulated_required: required,
              simulated_shortage: 0,
            };
          }
        }
      }
    });

    // Compute virtual revenue at risk
    const fgNode = simNodes.find((n) => n.id === fgNodeId);
    let simulatedRevAtRisk = 0;
    if (fgNode) {
      if (!isFeasible) {
        fgNode.status = "red";
        simulatedRevAtRisk = simQty * (fgNode.details.sales_price || 0);
      } else {
        fgNode.status = "green";
      }
    }

    // Refresh layout coordinates
    layoutGraph(simNodes, simEdges, {
      total_revenue_at_risk: simulatedRevAtRisk,
      critical_shortages_count: shortagesList.length,
      delayed_orders_count: isFeasible ? 0 : 1,
    });

    setSimResults({
      feasible: isFeasible,
      revenueAtRisk: simulatedRevAtRisk,
      shortages: shortagesList,
    });
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setSimResults(null);
    if (rawData) {
      layoutGraph(rawData.nodes, rawData.edges, rawData.summary);
    }
  };

  const getStatusColor = (status: string, opacity: string = "1") => {
    if (status === "red") return `rgba(239, 68, 68, ${opacity})`;   // Red-500
    if (status === "yellow") return `rgba(234, 179, 8, ${opacity})`; // Yellow-500
    return `rgba(16, 185, 129, ${opacity})`;                       // Emerald-500
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      <PageHeader
        title="Company Digital Twin Map"
        description="Interactive supply chain visualization mapping dependencies and real-time risks."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 flex-1 overflow-hidden">
        {/* Left Control Panel / Simulation Center */}
        <div className="lg:col-span-1 border-r border-border bg-card p-4 flex flex-col gap-4 overflow-y-auto">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <Play className="h-4 w-4 text-primary" />
                Simulation Center
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 pt-0">
              <p className="text-xs text-muted-foreground">
                Simulate manufacturing orders in-memory to test BoM feasibility and calculate potential blocked revenue without altering the database.
              </p>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold">Select Finished Good</label>
                <div className="max-h-32 overflow-y-auto border border-border rounded-md p-1 bg-muted/30 flex flex-col gap-1 select-none">
                  {finishedGoods.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground p-2 text-center">No finished goods loaded</div>
                  ) : (
                    finishedGoods.map((fg) => {
                      const isSelected = simSku.toLowerCase() === fg.details?.sku?.toLowerCase();
                      return (
                        <button
                          key={fg.id}
                          type="button"
                          onClick={() => setSimSku(fg.details?.sku || "")}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                            isSelected
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <span className="truncate mr-2 font-medium">{fg.label}</span>
                          <span className={`text-[10px] font-mono shrink-0 ${isSelected ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                            {fg.details?.sku}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold">Finished Good SKU</label>
                <Input
                  placeholder="e.g. FG001"
                  value={simSku}
                  onChange={(e) => setSimSku(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold">Simulated Qty</label>
                <Input
                  type="number"
                  min={1}
                  value={simQty}
                  onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={runSimulation} size="sm" className="flex-1 gap-1">
                  <Play className="h-3 w-3" /> Run
                </Button>
                {isSimulating && (
                  <Button onClick={resetSimulation} variant="outline" size="sm" className="gap-1">
                    <RefreshCw className="h-3 w-3" /> Reset
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Real-time Summary Card */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-primary" />
                Supply Chain Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 pt-0 text-xs">
              <div className="flex justify-between border-b border-border pb-1.5">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-bold ${isSimulating ? "text-purple-600" : "text-primary"}`}>
                  {isSimulating ? "Simulation Mode" : "Live Database"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-1.5">
                <span className="text-muted-foreground">Blocked Revenue:</span>
                <span className={`font-bold ${summary?.total_revenue_at_risk && summary.total_revenue_at_risk > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  ₹{summary?.total_revenue_at_risk?.toLocaleString() ?? "0"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border pb-1.5">
                <span className="text-muted-foreground">Critical Shortages:</span>
                <span className={`font-bold ${summary?.critical_shortages_count && summary.critical_shortages_count > 0 ? "text-destructive" : "text-emerald-600"}`}>
                  {summary?.critical_shortages_count ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Impacted Orders:</span>
                <span className="font-semibold">{summary?.delayed_orders_count ?? 0}</span>
              </div>
            </CardContent>
          </Card>


        </div>

        {/* SVG Canvas Map */}
        <div className="lg:col-span-3 bg-card relative flex-1 flex flex-col overflow-hidden">

          {/* Graph Viewport Container */}
          <div className="flex-1 relative bg-muted/20 w-full overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 text-sm font-semibold">
                Loading Twin Graph...
              </div>
            )}

            <div className="absolute top-3 left-3 bg-card border border-border px-2.5 py-1 rounded shadow-sm text-[10px] text-muted-foreground z-10 flex gap-4 select-none pointer-events-none">
              <div><span className="inline-block w-2 h-2 rounded-full mr-1 bg-emerald-500" /> Healthy</div>
              <div><span className="inline-block w-2 h-2 rounded-full mr-1 bg-yellow-500" /> Warning</div>
              <div><span className="inline-block w-2 h-2 rounded-full mr-1 bg-red-500" /> Critical Shortage</div>
              <div className="text-slate-500">Drag to Pan • Scroll to Zoom</div>
            </div>

            <svg
              ref={svgRef}
              className="w-full h-full cursor-grab active:cursor-grabbing outline-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            {/* Draw a dynamic grid background that moves and scales with the graph */}
            <rect width="100%" height="100%" fill="url(#grid)" className="svg-bg" />

            <defs>
              <pattern
                id="grid"
                width="30"
                height="30"
                patternUnits="userSpaceOnUse"
                patternTransform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}
              >
                <circle cx="1.5" cy="1.5" r="1.2" fill="#94a3b8" opacity="0.22" />
              </pattern>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="18"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>

            <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
              {/* Draw Edges / Connections */}
              {edges.map((edge) => {
                const src = nodes.find((n) => n.id === edge.source);
                const tgt = nodes.find((n) => n.id === edge.target);
                if (!src || !tgt || src.x === undefined || tgt.x === undefined || src.y === undefined || tgt.y === undefined) return null;

                const sx = src.x;
                const sy = src.y;
                const tx = tgt.x;
                const ty = tgt.y;

                // Cubic bezier path for organic-looking routing between columns
                const cx1 = sx + 80;
                const cy1 = sy;
                const cx2 = tx - 80;
                const cy2 = ty;
                const pathData = `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;

                // Highlight paths linked to red nodes
                const isShortageLink = src.status === "red" || tgt.status === "red";
                const strokeColor = isShortageLink ? "rgba(239, 68, 68, 0.4)" : "#cbd5e1";
                const strokeWidth = isShortageLink ? 2 : 1;

                return (
                  <g key={edge.id}>
                    <path
                      d={pathData}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      markerEnd="url(#arrow)"
                    />
                    {edge.quantity !== undefined && (
                      <text
                        x={(sx + tx) / 2}
                        y={(sy + ty) / 2 - 4}
                        textAnchor="middle"
                        fontSize="8"
                        className="fill-slate-500 font-medium select-none pointer-events-none"
                      >
                        {edge.quantity}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Draw Nodes */}
              {nodes.map((node) => {
                if (node.x === undefined || node.y === undefined) return null;
                const isSelected = selectedNode?.id === node.id;
                const nodeColor = getStatusColor(node.status);
                const bgColor = getStatusColor(node.status, "0.08");

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasDragged.current) return;
                      setSelectedNode(node);
                    }}
                  >
                    {/* Node Rectangle */}
                    <rect
                      x="-75"
                      y="-25"
                      width="150"
                      height="50"
                      rx="6"
                      fill={isSelected ? "rgba(255, 255, 255, 0.95)" : bgColor}
                      stroke={nodeColor}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="transition-all duration-200"
                    />

                    {/* Node Type tag */}
                    <text
                      x="0"
                      y="-12"
                      textAnchor="middle"
                      fontSize="7"
                      fontWeight="bold"
                      fill={nodeColor}
                      className="uppercase tracking-wider select-none pointer-events-none"
                    >
                      {node.type.replace("_", " ")}
                    </text>

                    {/* Node Label */}
                    <text
                      x="0"
                      y="5"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill={isSelected ? "#000" : "currentColor"}
                      className="select-none pointer-events-none"
                    >
                      {node.label.length > 22 ? `${node.label.slice(0, 20)}...` : node.label}
                    </text>

                    {/* Subtext info (e.g. SKU/Status) */}
                    <text
                      x="0"
                      y="18"
                      textAnchor="middle"
                      fontSize="8"
                      fill={isSelected ? "#475569" : "gray"}
                      className="select-none pointer-events-none"
                    >
                      {node.type.startsWith("product") && node.details?.sku ? node.details.sku : ""}
                      {node.type === "sales_order" && node.details?.status ? `Status: ${node.details.status}` : ""}
                      {node.type === "purchase_order" && node.details?.status ? `Status: ${node.details.status}` : ""}
                      {node.type === "manufacturing_order" && node.details?.status ? `Status: ${node.details.status}` : ""}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Zoom & Navigation Controls */}
          <div className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm border border-border shadow-lg rounded-lg p-1 flex items-center gap-1 z-10">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <Plus className="h-4 w-4 text-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-muted"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <Minus className="h-4 w-4 text-foreground" />
            </Button>
            <div className="w-[1px] h-5 bg-border mx-0.5" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs font-semibold gap-1 hover:bg-muted text-foreground"
              onClick={() => fitToScreen()}
              title="Fit View"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Fit View
            </Button>
          </div>

        </div> {/* End of Graph Viewport Container */}

        {/* Simulation Results Report Section */}
        {simResults && (
          <div className="border-t border-border bg-card p-6 flex flex-col gap-5 shadow-sm z-10 transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <div className="flex items-center gap-3">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Simulation Report</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  simResults.feasible
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-destructive/10 text-destructive"
                }`}>
                  {simResults.feasible ? "✓ FEASIBLE (Adequate Stock)" : "⚠ INFEASIBLE (Shortages Detected)"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setSimResults(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Grid Content with 40% / 30% / 30% columns */}
            <div className="grid grid-cols-10 gap-8 divide-x divide-border">
              {/* Column 1: Simulation Overview (40% width -> col-span-4) */}
              <div className="col-span-4 pr-8 flex flex-col justify-between min-h-[150px] text-xs">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Simulation Overview</h4>
                  <div className="text-base font-bold text-foreground">
                    Produce {simQty} units of SKU {simSku}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-auto">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Blocked Revenue</span>
                    <span className={`text-xl font-black ${simResults.revenueAtRisk > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      ₹{simResults.revenueAtRisk.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Shortages Count</span>
                    <span className={`text-xl font-black ${simResults.shortages.length > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {simResults.shortages.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Column 2: Material Impact (30% width -> col-span-3) */}
              <div className="col-span-3 pl-8 pr-8 flex flex-col min-h-[150px] text-xs">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Material Impact</h4>
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 max-h-[110px]">
                  {simResults.shortages.length === 0 ? (
                    <div className="text-emerald-600 font-semibold flex items-center gap-1.5 py-4 text-xs">
                      All materials have 100% available stock.
                    </div>
                  ) : (
                    simResults.shortages.map((sh, idx) => {
                      const pct = sh.needed > 0 ? Math.min(100, Math.round((sh.available / sh.needed) * 100)) : 100;
                      return (
                        <div key={idx} className="flex flex-col gap-1.5 text-xs">
                          <div className="flex justify-between font-semibold">
                            <span className="truncate mr-2 text-foreground/90">{sh.name}</span>
                            <span className="text-destructive font-bold shrink-0">-{sh.missing}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Free Stock: {sh.available}</span>
                            <span>Required: {sh.needed}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden border border-border/40">
                            <div
                              className="bg-destructive h-full transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Column 3: Recommended Actions (30% width -> col-span-3) */}
              <div className="col-span-3 pl-8 flex flex-col min-h-[150px] text-xs">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Recommended Actions</h4>
                <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 max-h-[110px]">
                  {simResults.feasible ? (
                    <div className="text-emerald-800 dark:text-emerald-300 leading-relaxed text-xs">
                      No immediate action required. Warehouse has sufficient stock to fulfill this simulation quantity. Proceed to create the Manufacturing Order.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {simResults.shortages.map((sh, idx) => (
                        <div key={idx} className="border-l-2 border-destructive pl-2.5 py-0.5 text-xs">
                          <span className="font-semibold text-foreground block">Procurement recommendation:</span>
                          <span className="text-muted-foreground">
                            Create PO for <span className="font-semibold text-foreground">{sh.missing} units</span> of {sh.name} ({sh.rmSku}).
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

          {/* Floating Detail Drawer (Right Sidebar Card) */}
          {selectedNode && (
            <Card className="absolute top-4 right-4 w-80 bg-background border border-border shadow-xl z-20">
              <CardHeader className="py-3 flex flex-row items-center justify-between border-b border-border">
                <CardTitle className="text-sm font-bold capitalize flex items-center gap-1.5">
                  <Info className="h-4 w-4 text-primary" />
                  {selectedNode.type.replace("_", " ")} Details
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedNode(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 flex flex-col gap-2.5 text-xs text-foreground">
                <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                  <span className="text-muted-foreground font-medium col-span-1">Label:</span>
                  <span className="col-span-2 font-semibold text-right">{selectedNode.label}</span>
                </div>

                <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                  <span className="text-muted-foreground font-medium col-span-1">Status:</span>
                  <span className="col-span-2 text-right font-bold capitalize" style={{ color: getStatusColor(selectedNode.status) }}>
                    {selectedNode.status === "red" ? "Critical Shortage" : selectedNode.status === "yellow" ? "Warning" : "Healthy"}
                  </span>
                </div>

                {selectedNode.type.startsWith("product") && (
                  <>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">SKU:</span>
                      <span className="col-span-2 text-right">{selectedNode.details?.sku}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Category:</span>
                      <span className="col-span-2 text-right">{selectedNode.details?.category}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">On Hand Qty:</span>
                      <span className="col-span-2 text-right font-semibold">{selectedNode.details?.on_hand}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Reserved Qty:</span>
                      <span className="col-span-2 text-right">{selectedNode.details?.reserved}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Free stock:</span>
                      <span className="col-span-2 text-right font-semibold text-primary">{selectedNode.details?.free_to_use}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Min Level:</span>
                      <span className="col-span-2 text-right">{selectedNode.details?.min_stock}</span>
                    </div>
                    {selectedNode.type === "product_fg" && (
                      <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                        <span className="text-muted-foreground font-medium col-span-1">Price:</span>
                        <span className="col-span-2 text-right font-semibold text-emerald-600">₹{selectedNode.details?.sales_price}</span>
                      </div>
                    )}
                    {selectedNode.type === "product_rm" && (
                      <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                        <span className="text-muted-foreground font-medium col-span-1">Cost:</span>
                        <span className="col-span-2 text-right font-semibold">₹{selectedNode.details?.cost_price}</span>
                      </div>
                    )}
                    {selectedNode.details?.simulated_required !== undefined && (
                      <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted bg-primary/5 p-1 rounded">
                        <span className="text-primary font-semibold col-span-1">Sim Req:</span>
                        <span className="col-span-2 text-right font-bold">{selectedNode.details?.simulated_required}</span>
                      </div>
                    )}
                    {selectedNode.details?.simulated_shortage > 0 && (
                      <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted bg-destructive/5 p-1 rounded">
                        <span className="text-destructive font-semibold col-span-1">Sim Short:</span>
                        <span className="col-span-2 text-right font-bold text-destructive">{selectedNode.details?.simulated_shortage}</span>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === "sales_order" && (
                  <>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Customer:</span>
                      <span className="col-span-2 text-right font-semibold">{selectedNode.details?.customer}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Order Status:</span>
                      <span className="col-span-2 text-right capitalize font-medium">{selectedNode.details?.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Total Amount:</span>
                      <span className="col-span-2 text-right font-semibold">₹{selectedNode.details?.total_amount?.toLocaleString()}</span>
                    </div>
                    {selectedNode.details?.revenue_at_risk > 0 && (
                      <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted bg-destructive/5 p-1 rounded">
                        <span className="text-destructive font-semibold col-span-1">Blocked Revenue:</span>
                        <span className="col-span-2 text-right font-bold text-destructive">₹{selectedNode.details?.revenue_at_risk?.toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === "purchase_order" && (
                  <>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Supplier:</span>
                      <span className="col-span-2 text-right font-semibold">{selectedNode.details?.vendor}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Order Status:</span>
                      <span className="col-span-2 text-right capitalize font-medium">{selectedNode.details?.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Total Amount:</span>
                      <span className="col-span-2 text-right font-semibold">₹{selectedNode.details?.total_amount?.toLocaleString()}</span>
                    </div>
                  </>
                )}

                {selectedNode.type === "manufacturing_order" && (
                  <>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">MO Status:</span>
                      <span className="col-span-2 text-right capitalize font-semibold">{selectedNode.details?.status}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 py-1 border-b border-muted">
                      <span className="text-muted-foreground font-medium col-span-1">Quantity:</span>
                      <span className="col-span-2 text-right font-semibold">{selectedNode.details?.quantity}</span>
                    </div>
                  </>
                )}

                {selectedNode.type === "customer" && (
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    This node represents customer <span className="text-foreground font-semibold">{selectedNode.label}</span>. It connects to the Sales Orders placed by this customer.
                  </p>
                )}

                {selectedNode.type === "supplier" && (
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    This node represents supplier <span className="text-foreground font-semibold">{selectedNode.label}</span>. It connects to Purchase Orders and products supplied by this vendor.
                  </p>
                )}

                {selectedNode.type === "bom" && (
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    This node represents the Bill of Materials recipe for producing the Finished Good. It connects the Finished Good to its required Component Raw Materials.
                  </p>
                )}

                {selectedNode.type === "shelf" && (
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    This node represents physical Warehouse Shelf <span className="text-foreground font-semibold">{selectedNode.label}</span>. It connects stored products to their designated locations inside the Warehouse.
                  </p>
                )}

                {selectedNode.type === "warehouse" && (
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    This node represents Warehouse <span className="text-foreground font-semibold">{selectedNode.label}</span> located at <span className="text-foreground font-semibold">{selectedNode.details?.location || "N/A"}</span>.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
