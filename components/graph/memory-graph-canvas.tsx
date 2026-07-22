"use client";

import { useEffect, useRef, useState } from "react";
import type { GraphDataset, GraphEdge, GraphNode, GraphRelationshipType, GraphRenderNode } from "@/types/graph";
import { cn } from "@/lib/utils";

type CanvasTransform = {
  x: number;
  y: number;
  scale: number;
};

const relationshipColors: Record<GraphRelationshipType, string> = {
  REFERENCED_IN: "#60a5fa",
  ASSIGNED_TO: "#f59e0b",
  DISCUSSED_WITH: "#a78bfa",
  RELATED_TO: "#34d399",
};

function getNodeRadius(node: GraphNode) {
  return 10 + node.importance * 18;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(aX: number, aY: number, bX: number, bY: number) {
  return Math.hypot(aX - bX, aY - bY);
}

function screenToWorld(point: { x: number; y: number }, transform: CanvasTransform) {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  };
}

function worldToScreen(point: { x: number; y: number }, transform: CanvasTransform) {
  return {
    x: point.x * transform.scale + transform.x,
    y: point.y * transform.scale + transform.y,
  };
}

function layoutInitialPositions(nodes: GraphNode[], previousNodes?: GraphRenderNode[]) {
  const angleStep = (Math.PI * 2) / Math.max(nodes.length, 1);
  const grouped = nodes.reduce<Record<string, number>>((accumulator, node) => {
    accumulator[node.group] = (accumulator[node.group] ?? 0) + 1;
    return accumulator;
  }, {});
  const groupOffsets = new Map<string, number>();
  const previousMap = previousNodes ? buildNodeMap(previousNodes) : new Map<string, GraphRenderNode>();

  return nodes.map((node, index) => {
    const previous = previousMap.get(node.id);
    if (previous) {
      return {
        ...node,
        x: previous.x,
        y: previous.y,
        vx: previous.vx * 0.45,
        vy: previous.vy * 0.45,
      };
    }

    const groupIndex = groupOffsets.get(node.group) ?? 0;
    groupOffsets.set(node.group, groupIndex + 1);
    const radius = 140 + (groupIndex % 4) * 28;
    const groupAngle = (Object.keys(grouped).indexOf(node.group) * Math.PI) / 2;
    const angle = index * angleStep + groupAngle;
    return {
      ...node,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    };
  });
}

function buildNodeMap(nodes: GraphRenderNode[]) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function resolveEdgePoints(
  source: GraphNode,
  target: GraphNode,
  transform: CanvasTransform,
  highlight: boolean,
) {
  const sourceScreen = worldToScreen({ x: source.x, y: source.y }, transform);
  const targetScreen = worldToScreen({ x: target.x, y: target.y }, transform);
  const sourceRadius = getNodeRadius(source) * transform.scale;
  const targetRadius = getNodeRadius(target) * transform.scale;
  const dx = targetScreen.x - sourceScreen.x;
  const dy = targetScreen.y - sourceScreen.y;
  const angle = Math.atan2(dy, dx);
  return {
    x1: sourceScreen.x + Math.cos(angle) * sourceRadius * 0.65,
    y1: sourceScreen.y + Math.sin(angle) * sourceRadius * 0.65,
    x2: targetScreen.x - Math.cos(angle) * targetRadius * 0.65,
    y2: targetScreen.y - Math.sin(angle) * targetRadius * 0.65,
    alpha: highlight ? 1 : 0.25,
  };
}

export type MemoryGraphCanvasProps = {
  dataset: GraphDataset;
  highlightedNodeId: string | null;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  relationshipFilter: GraphRelationshipType[];
  onSelectNode: (node: GraphNode | null) => void;
  onHoverNode: (node: GraphNode | null, clientX: number, clientY: number) => void;
  onTransformChange?: (transform: CanvasTransform) => void;
  className?: string;
};

export function MemoryGraphCanvas({
  dataset,
  highlightedNodeId,
  selectedNodeId,
  hoveredNodeId,
  relationshipFilter,
  onSelectNode,
  onHoverNode,
  onTransformChange,
  className,
}: MemoryGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const nodesRef = useRef<GraphRenderNode[]>(layoutInitialPositions(dataset.nodes) as GraphRenderNode[]);
  const edgesRef = useRef<GraphEdge[]>(dataset.edges);
  const transformRef = useRef<CanvasTransform>({ x: 0, y: 0, scale: 1 });
  const draggingNodeRef = useRef<string | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    nodesRef.current = layoutInitialPositions(dataset.nodes, nodesRef.current);
    edgesRef.current = dataset.edges;
  }, [dataset.nodes, dataset.edges]);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;

    function resizeCanvas() {
      const parent = canvas.parentElement;
      if (!parent) return;
      const { width, height } = parent.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (transformRef.current.x === 0 && transformRef.current.y === 0) {
        transformRef.current = { x: width / 2, y: height / 2, scale: 1 };
      }
      draw();
    }

    function applyPhysics() {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const centerX = 0;
      const centerY = 0;
      const clusterStrength = nodes.length > 100 ? 0.006 : 0.012;
      const linkStrength = nodes.length > 100 ? 0.0016 : 0.0024;
      const chargeStrength = nodes.length > 100 ? 1400 : 2200;

      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (draggingNodeRef.current === node.id) continue;

        const groupAngle = (Math.abs(node.group.charCodeAt(0) - 96) % 8) * (Math.PI / 4);
        node.vx += Math.cos(groupAngle) * clusterStrength;
        node.vy += Math.sin(groupAngle) * clusterStrength;
        node.vx += (centerX - node.x) * 0.0005;
        node.vy += (centerY - node.y) * 0.0005;

        if (nodes.length <= 120) {
          for (let j = i + 1; j < nodes.length; j += 1) {
            const other = nodes[j];
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.max(60, Math.hypot(dx, dy));
            const force = chargeStrength / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            node.vx += fx;
            node.vy += fy;
            other.vx -= fx;
            other.vy -= fy;
          }
        }
      }

      for (const edge of edges) {
        const source = nodes.find((node) => node.id === edge.source);
        const target = nodes.find((node) => node.id === edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const targetDistance = 160 + (1 - edge.weight) * 120;
        const force = (dist - targetDistance) * linkStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      for (const node of nodes) {
        if (draggingNodeRef.current === node.id) continue;
        node.x += node.vx;
        node.y += node.vy;
        node.vx *= 0.86;
        node.vy *= 0.86;
      }
    }

    function drawBackground() {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(8, 15, 29, 0.24)");
      gradient.addColorStop(1, "rgba(15, 23, 42, 0.38)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.scale, transformRef.current.scale);

      const gridStep = 80;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(148, 163, 184, 0.05)";
      for (let x = -2000; x < 2000; x += gridStep) {
        ctx.moveTo(x, -2000);
        ctx.lineTo(x, 2000);
      }
      for (let y = -2000; y < 2000; y += gridStep) {
        ctx.moveTo(-2000, y);
        ctx.lineTo(2000, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      const { width, height } = canvas.getBoundingClientRect();
      const transform = transformRef.current;
      drawBackground();

      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.scale, transform.scale);

      const nodeMap = buildNodeMap(nodesRef.current);
      const highlightNodeId = highlightedNodeId ?? hoveredNodeId ?? selectedNodeId;
      const edges = edgesRef.current.filter(
        (edge) => relationshipFilter.length === 0 || relationshipFilter.includes(edge.type),
      );

      for (const edge of edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;

        const isHighlighted =
          !highlightNodeId || source.id === highlightNodeId || target.id === highlightNodeId;
        const { x1, y1, x2, y2, alpha } = resolveEdgePoints(source, target, transform, isHighlighted);
        ctx.beginPath();
        ctx.lineWidth = isHighlighted ? 2.4 : 1.2;
        ctx.strokeStyle = `rgba(100, 116, 139, ${alpha})`;
        if (isHighlighted) {
          ctx.strokeStyle = relationshipColors[edge.type] ?? "rgba(148, 163, 184, 0.9)";
        }
        if (!isHighlighted) ctx.setLineDash(edge.decay > 0.4 ? [6, 8] : []);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const groupedNodes = nodesRef.current.reduce<Record<string, GraphRenderNode[]>>((accumulator, node) => {
        const bucket = accumulator[node.group] ?? [];
        bucket.push(node as GraphRenderNode);
        accumulator[node.group] = bucket;
        return accumulator;
      }, {});

      for (const groupNodes of Object.values(groupedNodes)) {
        if (groupNodes.length < 3) continue;
        const clusterOpacity = 0.05 + Math.min(0.12, groupNodes.length * 0.008);
        const xs = groupNodes.map((node) => worldToScreen({ x: node.x, y: node.y }, transform).x);
        const ys = groupNodes.map((node) => worldToScreen({ x: node.x, y: node.y }, transform).y);
        const minX = Math.min(...xs) - 28;
        const maxX = Math.max(...xs) + 28;
        const minY = Math.min(...ys) - 28;
        const maxY = Math.max(...ys) + 28;
        ctx.fillStyle = `rgba(56, 189, 248, ${clusterOpacity})`;
        ctx.strokeStyle = `rgba(148, 163, 184, ${clusterOpacity * 1.5})`;
        ctx.lineWidth = 1;
        roundRect(ctx, minX, minY, maxX - minX, maxY - minY, 24);
        ctx.fill();
        ctx.stroke();
      }

      for (const node of nodesRef.current) {
        const isHighlighted = !highlightNodeId || node.id === highlightNodeId;
        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;
        const pulse = isSelected || isHovered ? 1 + Math.sin(performance.now() / 180) * 0.05 : 1;
        const radius = getNodeRadius(node) * (isSelected ? 1.12 : isHovered ? 1.08 : 1) * pulse;
        const { x, y } = worldToScreen({ x: node.x, y: node.y }, transform);

        ctx.beginPath();
        ctx.fillStyle = nodeFill(node.type, isHighlighted, node.decay);
        ctx.shadowColor = isHighlighted ? "rgba(56, 189, 248, 0.35)" : "transparent";
        ctx.shadowBlur = isHighlighted ? 24 : 0;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.lineWidth = isSelected ? 3 : 1.2;
        ctx.strokeStyle = isSelected ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.18)";
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(15, 23, 42, 0.96)";
        ctx.font = `${Math.max(11, 12 * transform.scale)}px Inter, ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const showLabel = transform.scale > 0.72 || isSelected || isHovered || nodesRef.current.length <= 35;
        if (showLabel) {
          ctx.fillText(node.label, x, y + radius + 8);
        }
      }

      ctx.restore();

      onTransformChange?.(transform);
      if (ready) {
        frame += 1;
      }
      if (frame % 2 === 0) {
        applyPhysics();
      }
    }

    function nodeFill(type: GraphNode["type"], highlight: boolean, decay: number) {
      const base = {
        people: "rgba(96, 165, 250, 0.95)",
        projects: "rgba(168, 85, 247, 0.95)",
        emails: "rgba(34, 197, 94, 0.95)",
        meetings: "rgba(251, 191, 36, 0.95)",
        files: "rgba(56, 189, 248, 0.95)",
        tasks: "rgba(249, 115, 22, 0.95)",
        goals: "rgba(236, 72, 153, 0.95)",
      }[type];

      if (highlight) return base;
      const alpha = clamp(0.38 + (1 - decay) * 0.36, 0.2, 0.86);
      return base.replace("0.95", `${alpha.toFixed(2)}`);
    }

    function tick() {
      if (!canvas.parentElement) return;
      draw();
      rafRef.current = window.requestAnimationFrame(tick);
    }

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      resizeObserver.disconnect();
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [highlightedNodeId, hoveredNodeId, onHoverNode, onTransformChange, ready, relationshipFilter, selectedNodeId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handlePointerDown(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const transform = transformRef.current;
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const world = screenToWorld(pointer, transform);

      let pickedNode: GraphNode | null = null;
      let pickedDistance = Number.POSITIVE_INFINITY;
      for (const node of nodesRef.current) {
        const dist = distance(node.x, node.y, world.x, world.y);
        const nodeRadius = getNodeRadius(node);
        if (dist < nodeRadius * 1.2 && dist < pickedDistance) {
          pickedDistance = dist;
          pickedNode = node;
        }
      }

      if (pickedNode) {
        draggingNodeRef.current = pickedNode.id;
        onSelectNode(pickedNode);
      } else {
        panStartRef.current = { x: transform.x, y: transform.y };
        pointerStartRef.current = { x: event.clientX, y: event.clientY };
        onSelectNode(null);
      }
    }

    function handlePointerMove(event: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const transform = transformRef.current;
      const pointer = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const world = screenToWorld(pointer, transform);

      if (draggingNodeRef.current) {
        const node = nodesRef.current.find((item) => item.id === draggingNodeRef.current);
        if (node) {
          node.x = world.x;
          node.y = world.y;
          node.vx = 0;
          node.vy = 0;
        }
        onHoverNode(null, event.clientX, event.clientY);
        return;
      }

      if (panStartRef.current && pointerStartRef.current) {
        const deltaX = event.clientX - pointerStartRef.current.x;
        const deltaY = event.clientY - pointerStartRef.current.y;
        transformRef.current = {
          ...transformRef.current,
          x: panStartRef.current.x + deltaX,
          y: panStartRef.current.y + deltaY,
        };
        return;
      }

      let pickedNode: GraphNode | null = null;
      let pickedDistance = Number.POSITIVE_INFINITY;
      for (const node of nodesRef.current) {
        const dist = distance(node.x, node.y, world.x, world.y);
        const nodeRadius = getNodeRadius(node);
        if (dist < nodeRadius * 1.2 && dist < pickedDistance) {
          pickedDistance = dist;
          pickedNode = node;
        }
      }

      onHoverNode(pickedNode, event.clientX, event.clientY);
      canvas.style.cursor = pickedNode ? "pointer" : panStartRef.current ? "grabbing" : "grab";
    }

    function handlePointerUp() {
      draggingNodeRef.current = null;
      panStartRef.current = null;
      pointerStartRef.current = null;
    }

    function handlePointerLeave() {
      onHoverNode(null, 0, 0);
      canvas.style.cursor = "grab";
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cursor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const before = screenToWorld(cursor, transformRef.current);
      const nextScale = clamp(transformRef.current.scale * (event.deltaY > 0 ? 0.92 : 1.08), 0.35, 2.6);
      transformRef.current = {
        scale: nextScale,
        x: cursor.x - before.x * nextScale,
        y: cursor.y - before.y * nextScale,
      };
    }

    canvas.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [onHoverNode, onSelectNode]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-3xl border border-border/60", className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/80 px-4 py-2 text-sm text-muted-foreground shadow-soft">
            interactive graph loading...
          </div>
        </div>
      ) : null}
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const normalizedRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + normalizedRadius, y);
  ctx.lineTo(x + width - normalizedRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + normalizedRadius);
  ctx.lineTo(x + width, y + height - normalizedRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - normalizedRadius, y + height);
  ctx.lineTo(x + normalizedRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - normalizedRadius);
  ctx.lineTo(x, y + normalizedRadius);
  ctx.quadraticCurveTo(x, y, x + normalizedRadius, y);
  ctx.closePath();
}
