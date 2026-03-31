import dagre from "@dagrejs/dagre";
import { type Node, type Edge, Position, MarkerType } from "@xyflow/react";

// ============================================================
// JOURNEY NODE TREE (input format — what AI outputs)
// ============================================================

export interface JourneyTreeNode {
  id: string;
  type: "segment" | "event_trigger" | "send" | "pause" | "wait_until" | "conditional_split" | "random_split" | "exit" | "goal_exit" | "branch_label";
  label: string;
  config: Record<string, unknown>;
  branches?: {
    label: string;
    color?: string;
    nodes: JourneyTreeNode[];
  }[];
}

// ============================================================
// NODE DIMENSIONS (per type)
// ============================================================

const NODE_DIMS: Record<string, { width: number; height: number }> = {
  segment: { width: 280, height: 85 },
  event_trigger: { width: 280, height: 75 },
  send: { width: 270, height: 75 },
  pause: { width: 240, height: 60 },
  wait_until: { width: 280, height: 75 },
  conditional_split: { width: 300, height: 75 },
  random_split: { width: 300, height: 75 },
  exit: { width: 220, height: 55 },
  goal_exit: { width: 260, height: 65 },
  branch_label: { width: 160, height: 45 },
};

// ============================================================
// EDGE COLORS BY BRANCH LABEL COLOR
// ============================================================

const branchColors: Record<string, string> = {
  green: "#0ba68f",
  red: "#e5534b",
  purple: "#6b39d7",
  blue: "#1565C0",
};

// ============================================================
// TREE → FLAT NODES + EDGES
// ============================================================

export function treeToFlow(rootNodes: JourneyTreeNode[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function addNode(treeNode: JourneyTreeNode) {
    const dims = NODE_DIMS[treeNode.type] || { width: 240, height: 70 };

    // Build data object based on type
    const data: Record<string, unknown> = {
      label: treeNode.label,
      desc: treeNode.config.desc,
      detail: treeNode.config.detail,
    };

    if (treeNode.type === "conditional_split" || treeNode.type === "random_split") {
      data.branchCount = treeNode.branches?.length || 2;
    }
    if (treeNode.type === "wait_until" && treeNode.branches && treeNode.branches.length > 1) {
      data.timeout = "true";
    }
    if (treeNode.type === "send") {
      data.channel = treeNode.config.channel;
      data.timing = treeNode.config.timing;
    }
    if (treeNode.type === "branch_label") {
      data.color = treeNode.config.color;
      data.size = treeNode.config.size;
      data.condition = treeNode.config.condition;
      data.sql = treeNode.config.sql;
    }

    nodes.push({
      id: treeNode.id,
      type: treeNode.type,
      data,
      position: { x: 0, y: 0 }, // dagre will set this
      ...dims,
    });
  }

  function traverse(treeNode: JourneyTreeNode, parentId?: string, branchIndex?: number, branchLabel?: string, branchColor?: string) {
    addNode(treeNode);

    // Edge from parent
    if (parentId) {
      const edgeColor = branchColor ? (branchColors[branchColor] || "#d4d8de") : "#d4d8de";
      edges.push({
        id: `e-${parentId}-${treeNode.id}`,
        source: parentId,
        sourceHandle: branchIndex !== undefined ? `branch-${branchIndex}` : undefined,
        target: treeNode.id,
        type: "smoothstep",
        // No edge labels — branch_label nodes handle this
        style: { stroke: edgeColor, strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor, width: 14, height: 14 },
      });
    }

    // Recurse into branches
    if (treeNode.branches && treeNode.branches.length > 0) {
      treeNode.branches.forEach((branch, bi) => {
        // Traverse each node in the branch sequentially
        let prevId = treeNode.id;
        let prevBranchIndex: number | undefined = bi;
        let prevLabel: string | undefined = branch.label;
        let prevColor: string | undefined = branch.color;

        branch.nodes.forEach((childNode, ci) => {
          if (ci === 0) {
            traverse(childNode, prevId, prevBranchIndex, prevLabel, prevColor);
          } else {
            traverse(childNode, prevId, undefined, undefined, undefined);
          }
          prevId = childNode.id;
          prevBranchIndex = undefined;
          prevLabel = undefined;
          prevColor = undefined;
        });
      });
    }
  }

  // Traverse root nodes sequentially
  rootNodes.forEach((rootNode, i) => {
    if (i === 0) {
      traverse(rootNode);
    } else {
      traverse(rootNode, rootNodes[i - 1].id);
    }
  });

  return { nodes, edges };
}

// ============================================================
// DAGRE LAYOUT
// ============================================================

export function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 150, ranksep: 100, edgesep: 40, marginx: 40, marginy: 40 });

  nodes.forEach((node) => {
    const dims = NODE_DIMS[node.type || "exit"] || { width: 240, height: 70 };
    g.setNode(node.id, { width: dims.width, height: dims.height });
  });

  edges.forEach((edge) => {
    // Higher weight = dagre tries harder to keep this edge short and straight
    g.setEdge(edge.source, edge.target, { weight: 2 });
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    const dims = NODE_DIMS[node.type || "exit"] || { width: 240, height: 70 };
    return {
      ...node,
      position: {
        x: dagreNode.x - dims.width / 2,
        y: dagreNode.y - dims.height / 2,
      },
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
    };
  });

  // Fix branch edge ordering: assign sourceHandle based on target x-position
  // so leftmost target gets branch-0, next gets branch-1, etc.
  const layoutedEdges = [...edges];
  const edgesBySource: Record<string, Edge[]> = {};
  layoutedEdges.forEach(e => {
    if (!edgesBySource[e.source]) edgesBySource[e.source] = [];
    edgesBySource[e.source].push(e);
  });

  // For nodes with multiple outgoing edges (splits), sort by target x and assign handles
  const nodeMap = new Map(layoutedNodes.map(n => [n.id, n]));
  Object.values(edgesBySource).forEach(group => {
    if (group.length <= 1) return;
    // Sort by target node x position (left to right)
    group.sort((a, b) => {
      const aTarget = nodeMap.get(a.target);
      const bTarget = nodeMap.get(b.target);
      return (aTarget?.position?.x || 0) - (bTarget?.position?.x || 0);
    });
    // Assign sourceHandle index
    group.forEach((edge, i) => {
      edge.sourceHandle = `branch-${i}`;
    });
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

// ============================================================
// COMBINED: tree → layout
// ============================================================

export function buildJourneyFlow(rootNodes: JourneyTreeNode[]) {
  const { nodes, edges } = treeToFlow(rootNodes);
  return layoutWithDagre(nodes, edges);
}
