"use client";

import { useMemo, useCallback } from "react";
import { ReactFlow, Controls, Background, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "./nodes";
import { buildJourneyFlow, type JourneyTreeNode } from "./layout";

export interface SendNodeInfo {
  nodeId: string;
  label: string;
  channel: string;
  brief: string;
  timing: string;
}

export function JourneyFlow({ nodes: treeNodes, onSendNodeClick, selectedNodeId, templateAssignments }: {
  nodes: JourneyTreeNode[];
  onSendNodeClick?: (info: SendNodeInfo) => void;
  selectedNodeId?: string | null;
  templateAssignments?: Record<string, string>;
}) {
  const { nodes, edges } = useMemo(() => buildJourneyFlow(treeNodes), [treeNodes]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "send" && onSendNodeClick) {
      const data = node.data as Record<string, unknown>;
      onSendNodeClick({
        nodeId: node.id,
        label: (data.label as string) || "",
        channel: (data.channel as string) || "SMS",
        brief: (data.desc as string) || "",
        timing: (data.timing as string) || "",
      });
    }
  }, [onSendNodeClick]);

  // Inject template assignment status into Send nodes + highlight selected
  const styledNodes = useMemo(() => nodes.map(n => {
    const updated = { ...n };
    if (n.type === "send" && templateAssignments) {
      updated.data = { ...n.data, templateAssigned: templateAssignments[n.id] || undefined };
    }
    if (n.id === selectedNodeId) {
      updated.style = { outline: "2px solid #0f1235", outlineOffset: 2, borderRadius: 12 };
    }
    return updated;
  }), [nodes, selectedNodeId, templateAssignments]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={styledNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={handleNodeClick}
      >
        <Controls showInteractive={false} />
        <Background color="#e8ecf0" gap={20} size={1} />
      </ReactFlow>
    </div>
  );
}
