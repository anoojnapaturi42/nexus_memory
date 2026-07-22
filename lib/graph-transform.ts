import type { GraphCluster, GraphDataset, GraphEdge, GraphFilters, GraphNode } from "@/types/graph";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function matchesQuery(node: GraphNode, query: string) {
  if (!query) return true;
  const normalized = normalizeText(query);
  return (
    normalizeText(node.label).includes(normalized) ||
    normalizeText(node.summary).includes(normalized) ||
    node.tags.some((tag) => normalizeText(tag).includes(normalized))
  );
}

function matchesImportance(node: GraphNode, minImportance: number) {
  return node.importance >= minImportance;
}

function matchesDecay(showDecayed: boolean, node: GraphNode, edgeMap: Map<string, GraphEdge[]>) {
  if (showDecayed) return true;
  const edgeDecay = edgeMap.get(node.id)?.some((edge) => edge.decay >= 0.55) ?? false;
  return node.decay < 0.55 && !edgeDecay;
}

export function filterGraphDataset(dataset: GraphDataset, filters: GraphFilters): GraphDataset {
  const edgeMap = buildEdgeMap(dataset.edges);
  const nodes = dataset.nodes.filter(
    (node) =>
      matchesQuery(node, filters.query) &&
      matchesImportance(node, filters.minImportance) &&
      matchesDecay(filters.showDecayed, node, edgeMap),
  );

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = dataset.edges.filter(
    (edge) =>
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target) &&
      (filters.relationshipTypes.length === 0 || filters.relationshipTypes.includes(edge.type)),
  );

  const connectedIds = new Set<string>(edges.flatMap((edge) => [edge.source, edge.target]));
  const connectedNodes = nodes.filter((node) => connectedIds.has(node.id) || edges.length === 0);

  return {
    nodes: connectedNodes,
    edges,
  };
}

export function getVisibleNodeIds(dataset: GraphDataset, filters: GraphFilters) {
  return new Set(filterGraphDataset(dataset, filters).nodes.map((node) => node.id));
}

export function buildEdgeMap(edges: GraphEdge[]) {
  const map = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    const sourceEdges = map.get(edge.source) ?? [];
    sourceEdges.push(edge);
    map.set(edge.source, sourceEdges);

    const targetEdges = map.get(edge.target) ?? [];
    targetEdges.push(edge);
    map.set(edge.target, targetEdges);
  }
  return map;
}

export function groupNodesByCluster(nodes: GraphNode[]) {
  return nodes.reduce<Record<string, GraphNode[]>>((accumulator, node) => {
    const bucket = accumulator[node.group] ?? [];
    bucket.push(node);
    accumulator[node.group] = bucket;
    return accumulator;
  }, {});
}

export function computeGraphClusters(dataset: GraphDataset): GraphCluster[] {
  return Object.entries(groupNodesByCluster(dataset.nodes)).map(([clusterId, nodes]) => ({
    id: clusterId,
    label: clusterId,
    nodeIds: nodes.map((node) => node.id),
    nodeCount: nodes.length,
    averageImportance:
      nodes.length > 0 ? nodes.reduce((sum, node) => sum + node.importance, 0) / nodes.length : 0,
    averageDecay: nodes.length > 0 ? nodes.reduce((sum, node) => sum + node.decay, 0) / nodes.length : 0,
  }));
}

export function getNeighborIds(dataset: GraphDataset, nodeId: string) {
  const ids = new Set<string>([nodeId]);
  for (const edge of dataset.edges) {
    if (edge.source === nodeId) ids.add(edge.target);
    if (edge.target === nodeId) ids.add(edge.source);
  }
  return ids;
}

export function computeDecayScore(node: GraphNode, referenceDate = new Date()) {
  const createdAt = node.createdAt ? new Date(node.createdAt).getTime() : referenceDate.getTime();
  const ageInDays = Math.max(0, (referenceDate.getTime() - createdAt) / (1000 * 60 * 60 * 24));
  const freshness = Math.exp(-ageInDays / 42);
  return Math.max(0, Math.min(1, node.importance * freshness * (1 - node.decay * 0.4)));
}

export function getGraphStats(dataset: GraphDataset) {
  const byType = dataset.nodes.reduce<Record<string, number>>((accumulator, node) => {
    accumulator[node.type] = (accumulator[node.type] ?? 0) + 1;
    return accumulator;
  }, {});

  return {
    nodeCount: dataset.nodes.length,
    edgeCount: dataset.edges.length,
    byType,
    averageImportance:
      dataset.nodes.length > 0
        ? dataset.nodes.reduce((sum, node) => sum + node.importance, 0) / dataset.nodes.length
        : 0,
  };
}
