export type GraphNodeType = "people" | "projects" | "emails" | "meetings" | "files" | "tasks" | "goals";

export type GraphRelationshipType = "REFERENCED_IN" | "ASSIGNED_TO" | "DISCUSSED_WITH" | "RELATED_TO";

export type GraphNode = {
  id: string;
  label: string;
  type: GraphNodeType;
  importance: number;
  decay: number;
  group: string;
  summary: string;
  tags: string[];
  createdAt?: string;
  sourceApp?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: GraphRelationshipType;
  weight: number;
  timestamp: string;
  decay: number;
};

export type GraphDataset = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type GraphRenderNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type GraphCluster = {
  id: string;
  label: string;
  nodeIds: string[];
  nodeCount: number;
  averageImportance: number;
  averageDecay: number;
};

export type GraphFilters = {
  query: string;
  relationshipTypes: GraphRelationshipType[];
  minImportance: number;
  showDecayed: boolean;
};
