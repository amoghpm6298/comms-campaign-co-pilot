"use client";

import dynamic from "next/dynamic";
import type { JourneyTreeNode } from "./layout";
import type { SendNodeInfo } from "./JourneyFlow";

const JourneyFlowLazy = dynamic(
  () => import("./JourneyFlow").then((mod) => ({ default: mod.JourneyFlow })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: "var(--body-text)" }}>Loading journey...</p>
      </div>
    ),
  }
);

export function JourneyFlowWrapper({ nodes, onSendNodeClick, selectedNodeId, templateAssignments }: {
  nodes: JourneyTreeNode[];
  onSendNodeClick?: (info: SendNodeInfo) => void;
  selectedNodeId?: string | null;
  templateAssignments?: Record<string, string>;
}) {
  return <JourneyFlowLazy nodes={nodes} onSendNodeClick={onSendNodeClick} selectedNodeId={selectedNodeId} templateAssignments={templateAssignments} />;
}

export type { SendNodeInfo };
