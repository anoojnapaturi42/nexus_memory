"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Brain,
  Filter,
  GitBranch,
  Layers3,
  Maximize2,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type ElementType } from "react";
import { MemoryGraphCanvas } from "@/components/graph/memory-graph-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { layoutContainer } from "@/lib/layout";
import { computeGraphClusters, filterGraphDataset, getGraphStats, getNeighborIds } from "@/lib/graph-transform";
import { cn } from "@/lib/utils";
import { mockMemoryGraphData } from "@/mock/graph-data";
import { useNavigationStore } from "@/store/navigation-store";
import type { GraphDataset, GraphEdge, GraphNode, GraphRelationshipType } from "@/types/graph";

const relationshipOptions: GraphRelationshipType[] = [
  "REFERENCED_IN",
  "ASSIGNED_TO",
  "DISCUSSED_WITH",
  "RELATED_TO",
];

const relationshipLabels: Record<GraphRelationshipType, string> = {
  REFERENCED_IN: "referenced in",
  ASSIGNED_TO: "assigned to",
  DISCUSSED_WITH: "discussed with",
  RELATED_TO: "related to",
};

const relationshipPalette: Record<GraphRelationshipType, string> = {
  REFERENCED_IN: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  ASSIGNED_TO: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  DISCUSSED_WITH: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  RELATED_TO: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const typeLabels: Record<GraphNode["type"], string> = {
  people: "people",
  projects: "projects",
  emails: "emails",
  meetings: "meetings",
  files: "files",
  tasks: "tasks",
  goals: "goals",
};

function formatDate(value?: string) {
  if (!value) return "unknown";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function RelationshipPill({
  type,
  active,
  onClick,
}: {
  type: GraphRelationshipType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn(
        "rounded-full capitalize",
        !active && "border-border/60 bg-background/60 text-muted-foreground hover:text-foreground",
      )}
    >
      <span className={cn("mr-2 inline-flex h-2 w-2 rounded-full", relationshipPalette[type])} />
      {relationshipLabels[type]}
    </Button>
  );
}

function NodeBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/60 bg-background/40 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function GraphTooltip({
  node,
  position,
}: {
  node: GraphNode | null;
  position: { x: number; y: number } | null;
}) {
  if (!node || !position) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 6 }}
      transition={{ duration: 0.16 }}
      className="pointer-events-none fixed z-50 max-w-xs rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur"
      style={{
        left: Math.max(
          16,
          Math.min(position.x + 16, typeof window !== "undefined" ? window.innerWidth - 320 : position.x),
        ),
        top: Math.max(
          16,
          Math.min(position.y + 16, typeof window !== "undefined" ? window.innerHeight - 240 : position.y),
        ),
      }}
    >
      <p className="text-sm font-semibold text-foreground">{node.label}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {typeLabels[node.type]} - {node.group}
      </p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{node.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {node.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground">
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

export function MemoryGraphWorkspace() {
  const setActivePath = useNavigationStore((state) => state.setActivePath);
  const [query, setQuery] = useState("");
  const [relationshipFilters, setRelationshipFilters] = useState<GraphRelationshipType[]>([]);
  const [minImportance, setMinImportance] = useState(0.35);
  const [showDecay, setShowDecay] = useState(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [focusGroup, setFocusGroup] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setActivePath("/memory-graph");
  }, [setActivePath]);

  const filteredDataset = useMemo(() => {
    const dataset: GraphDataset = {
      nodes: mockMemoryGraphData.nodes.map((node) => ({ ...node })),
      edges: mockMemoryGraphData.edges,
    };

    const filtered = filterGraphDataset(dataset, {
      query: deferredQuery,
      relationshipTypes: relationshipFilters,
      minImportance,
      showDecayed: showDecay,
    });

    if (!focusGroup) return filtered;

    const nodes = filtered.nodes.filter((node) => node.group === focusGroup);
    const nodeIds = new Set(nodes.map((node) => node.id));
    const edges = filtered.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

    return { nodes, edges };
  }, [deferredQuery, focusGroup, minImportance, relationshipFilters, showDecay]);

  const graphStats = useMemo(() => getGraphStats(filteredDataset), [filteredDataset]);
  const clusters = useMemo(() => computeGraphClusters(filteredDataset), [filteredDataset]);
  const inspectionNode = selectedNode ?? hoveredNode;
  const neighborIds = useMemo(() => {
    if (!inspectionNode) return new Set<string>();
    return getNeighborIds(filteredDataset, inspectionNode.id);
  }, [filteredDataset, inspectionNode]);

  const selectedEdges = useMemo(() => {
    if (!inspectionNode) return [] as GraphEdge[];
    return filteredDataset.edges.filter((edge) => edge.source === inspectionNode.id || edge.target === inspectionNode.id);
  }, [filteredDataset.edges, inspectionNode]);

  const visibleNode = inspectionNode;
  const visibleTooltipPosition = hoverPosition;

  const toggleRelationship = (type: GraphRelationshipType) => {
    setRelationshipFilters((current) =>
      current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type],
    );
  };

  const handleSelectNode = useCallback((node: GraphNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleHoverNode = useCallback((node: GraphNode | null, x: number, y: number) => {
    setHoveredNode(node);
    setHoverPosition(node ? { x, y } : null);
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.10),_transparent_26%)]" />
      <div className="absolute inset-0 bg-grid-fade bg-[length:28px_28px] opacity-[0.05]" />

      <div className={layoutContainer("relative z-10 min-h-screen py-4 lg:py-6")}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32 }}
              className="rounded-[1.75rem] border border-border/70 bg-card/80 p-6 shadow-soft backdrop-blur"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                    memory graph
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                    relationship graph for workspace memory
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    explore people, projects, emails, meetings, files, tasks, and goals as a connected
                    knowledge graph with live filtering, clustering, and decay-aware rendering.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" className="border-border/60 bg-background/60" onClick={() => setFocusGroup(null)}>
                    <Maximize2 className="mr-2 h-4 w-4" />
                    reset focus
                  </Button>
                  <Button
                    onClick={() => {
                      setQuery("");
                      setRelationshipFilters([]);
                      setMinImportance(0.35);
                      setShowDecay(true);
                      setSelectedNode(null);
                      setHoveredNode(null);
                      setHoverPosition(null);
                      setFocusGroup(null);
                    }}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    clear filters
                  </Button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="search nodes, tags, summaries..."
                    className="h-12 pl-9"
                    aria-label="search graph"
                  />
                </label>
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>importance {minImportance.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {relationshipOptions.map((type) => (
                  <RelationshipPill
                    key={type}
                    type={type}
                    active={relationshipFilters.includes(type)}
                    onClick={() => toggleRelationship(type)}
                  />
                ))}
                <Button
                  type="button"
                  variant={showDecay ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDecay((current) => !current)}
                  className={!showDecay ? "border-border/60 bg-background/60 text-muted-foreground" : ""}
                >
                  decay view
                </Button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                        memory importance
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        filter out lower-signal memories before rendering
                      </p>
                    </div>
                    <Brain className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={minImportance}
                    onChange={(event) => setMinImportance(Number(event.target.value))}
                    className="mt-4 w-full accent-primary"
                    aria-label="memory importance slider"
                  />
                </div>

                <StatCard
                  label="visible nodes"
                  value={String(filteredDataset.nodes.length)}
                  description="nodes remaining after query, relationship, and importance filters"
                  icon={Layers3}
                />
                <StatCard
                  label="visible edges"
                  value={String(filteredDataset.edges.length)}
                  description="linked relationships that stay in frame for the current view"
                  icon={GitBranch}
                />
              </div>
            </motion.div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.06 }}
                className="min-h-[640px]"
              >
                <MemoryGraphCanvas
                  dataset={filteredDataset}
                  highlightedNodeId={hoveredNode?.id ?? selectedNode?.id ?? null}
                  selectedNodeId={selectedNode?.id ?? null}
                  hoveredNodeId={hoveredNode?.id ?? null}
                  relationshipFilter={relationshipFilters}
                  onSelectNode={handleSelectNode}
                  onHoverNode={handleHoverNode}
                  className="h-full min-h-[640px] bg-card/60"
                />
              </motion.div>

              <motion.aside
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="space-y-4"
              >
                <Card className="border-border/70 bg-card/80 shadow-soft">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base">active node</CardTitle>
                    <CardDescription>hover or select a node to inspect its connected context.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {visibleNode ? (
                      <div className="space-y-4">
                        <div>
                          <p className="text-xl font-semibold">{visibleNode.label}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                            {typeLabels[visibleNode.type]} - {visibleNode.group}
                          </p>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{visibleNode.summary}</p>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                            <p className="text-xs text-muted-foreground">importance</p>
                            <p className="mt-1 text-lg font-semibold">{visibleNode.importance.toFixed(2)}</p>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
                            <p className="text-xs text-muted-foreground">decay</p>
                            <p className="mt-1 text-lg font-semibold">{visibleNode.decay.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {visibleNode.tags.map((tag) => (
                            <NodeBadge key={tag} label={tag} active={neighborIds.has(visibleNode.id)} />
                          ))}
                        </div>

                        <Separator className="bg-border/60" />

                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                            connected edges
                          </p>
                          {selectedEdges.length > 0 ? (
                            selectedEdges.map((edge) => {
                              const otherId = edge.source === visibleNode.id ? edge.target : edge.source;
                              const other = filteredDataset.nodes.find((node) => node.id === otherId);
                              return (
                                <div
                                  key={edge.id}
                                  className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
                                >
                                  <p className="font-medium">
                                    {relationshipLabels[edge.type]} - {other?.label ?? otherId}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {formatDate(edge.timestamp)}
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              no direct edges selected. click a node to pin its context here.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted-foreground">
                        hover nodes for quick context or click one to pin its full relationship trail.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/70 bg-card/80 shadow-soft">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-base">cluster focus</CardTitle>
                    <CardDescription>group nodes by their workspace domain.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {clusters.map((cluster) => (
                      <button
                        type="button"
                        key={cluster.id}
                        onClick={() => setFocusGroup((current) => (current === cluster.id ? null : cluster.id))}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-accent/50",
                          focusGroup === cluster.id
                            ? "border-primary/30 bg-primary/10"
                            : "border-border/60 bg-background/60",
                        )}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium capitalize">{cluster.label}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {cluster.nodeCount} nodes - avg importance {cluster.averageImportance.toFixed(2)}
                            </p>
                          </div>
                          <Filter className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </motion.aside>
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:h-fit">
            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">graph overview</CardTitle>
                <CardDescription>live stats for the current filtered view.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="nodes"
                    value={String(graphStats.nodeCount)}
                    description="visible graph nodes"
                    icon={Activity}
                  />
                  <StatCard
                    label="edges"
                    value={String(graphStats.edgeCount)}
                    description="visible graph edges"
                    icon={GitBranch}
                  />
                </div>

                <Separator className="bg-border/60" />

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    types in view
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(graphStats.byType).map(([type, count]) => (
                      <span
                        key={type}
                        className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {type} - {count}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    graph states
                  </p>
                  <div className="grid gap-2">
                    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm">
                      search query: <span className="text-foreground">{deferredQuery || "none"}</span>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm">
                      decay view: <span className="text-foreground">{showDecay ? "on" : "off"}</span>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm">
                      cluster focus: <span className="text-foreground">{focusGroup ?? "all clusters"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-card/80 shadow-soft backdrop-blur">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">relationship legend</CardTitle>
                <CardDescription>edge styling for the current memory graph.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {relationshipOptions.map((type) => (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm"
                  >
                    <span className="capitalize">{relationshipLabels[type]}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                        relationshipPalette[type],
                      )}
                    >
                      {type}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        <GraphTooltip node={visibleNode} position={visibleTooltipPosition} />
      </AnimatePresence>
    </main>
  );
}
