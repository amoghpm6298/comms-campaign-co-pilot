"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

// ============================================================
// NODE DATA TYPES
// ============================================================

export type SegmentNodeData = { label: string; desc?: string; detail?: string };
export type EventTriggerNodeData = { label: string; desc?: string };
export type SendNodeData = { label: string; channel: string; desc?: string; timing?: string; templateAssigned?: string };
export type PauseNodeData = { label: string; desc?: string };
export type WaitUntilNodeData = { label: string; desc?: string; timeout?: string };
export type ConditionalSplitNodeData = { label: string; desc?: string; branchCount: number };
export type RandomSplitNodeData = { label: string; desc?: string; branchCount: number };
export type ExitNodeData = { label: string; desc?: string };
export type GoalExitNodeData = { label: string; desc?: string };

// ============================================================
// NODE TYPES (union)
// ============================================================

export type AppNode =
  | Node<SegmentNodeData, "segment">
  | Node<EventTriggerNodeData, "event_trigger">
  | Node<SendNodeData, "send">
  | Node<PauseNodeData, "pause">
  | Node<WaitUntilNodeData, "wait_until">
  | Node<ConditionalSplitNodeData, "conditional_split">
  | Node<RandomSplitNodeData, "random_split">
  | Node<ExitNodeData, "exit">
  | Node<GoalExitNodeData, "goal_exit">;

// ============================================================
// STYLE CONFIG
// ============================================================

const styles: Record<string, { iconColor: string; iconBg: string; borderColor: string; svgPath: string }> = {
  segment: {
    iconColor: "#435565", iconBg: "#f0f2f5", borderColor: "#c8cdd3",
    svgPath: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  },
  event_trigger: {
    iconColor: "#d97706", iconBg: "rgba(217,119,6,0.06)", borderColor: "rgba(217,119,6,0.3)",
    svgPath: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  send: {
    iconColor: "#0f1235", iconBg: "rgba(15,18,53,0.05)", borderColor: "#0f1235",
    svgPath: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  },
  pause: {
    iconColor: "#6b39d7", iconBg: "rgba(107,57,215,0.04)", borderColor: "#d4d8de",
    svgPath: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  },
  wait_until: {
    iconColor: "#6b39d7", iconBg: "rgba(107,57,215,0.06)", borderColor: "rgba(107,57,215,0.25)",
    svgPath: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  },
  conditional_split: {
    iconColor: "#6b39d7", iconBg: "rgba(107,57,215,0.06)", borderColor: "rgba(107,57,215,0.25)",
    svgPath: "M12 2l10 10-10 10L2 12z",
  },
  random_split: {
    iconColor: "#1565C0", iconBg: "rgba(21,101,192,0.06)", borderColor: "rgba(21,101,192,0.25)",
    svgPath: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
  },
  exit: {
    iconColor: "#e5534b", iconBg: "rgba(229,83,75,0.04)", borderColor: "rgba(229,83,75,0.2)",
    svgPath: "M18.36 6.64a9 9 0 11-12.73 0M12 2v10",
  },
  goal_exit: {
    iconColor: "#0ba68f", iconBg: "rgba(11,166,143,0.06)", borderColor: "rgba(11,166,143,0.25)",
    svgPath: "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3",
  },
};

// ============================================================
// BASE NODE SHELL
// ============================================================

function NodeShell({ type, label, desc, detail, badge, children, isSend, isExit, isTerminal, handleCount = 1 }: {
  type: string;
  label: string;
  desc?: string;
  detail?: string;
  badge?: string;
  children?: React.ReactNode;
  isSend?: boolean;
  isExit?: boolean;
  isTerminal?: boolean;
  handleCount?: number;
}) {
  const s = styles[type] || styles.exit;

  return (
    <div
      className={`rounded-xl bg-white ${isSend ? "border-2" : "border"} transition-shadow`}
      style={{
        minWidth: 210,
        maxWidth: 300,
        borderColor: s.borderColor,
        borderStyle: isExit ? "dashed" : "solid",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        opacity: isExit ? 0.85 : 1,
      }}
    >
      {/* Target handle (top) */}
      <Handle type="target" position={Position.Top} style={{ background: "#d4d8de", width: 8, height: 8, border: "2px solid white" }} />

      <div className="px-3.5 py-2.5 flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: s.iconBg }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.iconColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={s.svgPath} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[12px] font-semibold truncate" style={{ color: isExit ? s.iconColor : "#0f1235" }}>{label}</p>
            {badge && (
              <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(107,57,215,0.06)", color: "#6b39d7" }}>{badge}</span>
            )}
          </div>
          {desc && <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: "#435565" }}>{desc}</p>}
          {detail && <p className="text-[10px] mt-1 font-medium" style={{ color: "#0ba68f" }}>{detail}</p>}
          {children}
        </div>
      </div>

      {/* Source handles (bottom) */}
      {!isTerminal && handleCount <= 1 && (
        <Handle type="source" position={Position.Bottom} style={{ background: "#d4d8de", width: 8, height: 8, border: "2px solid white" }} />
      )}
      {!isTerminal && handleCount > 1 && (
        Array.from({ length: handleCount }).map((_, i) => (
          <Handle
            key={i}
            type="source"
            position={Position.Bottom}
            id={`branch-${i}`}
            style={{
              background: "#d4d8de", width: 8, height: 8, border: "2px solid white",
              left: `${((i + 1) / (handleCount + 1)) * 100}%`,
            }}
          />
        ))
      )}
    </div>
  );
}

// ============================================================
// 9 NODE COMPONENTS
// ============================================================

export function SegmentNodeComponent({ data }: NodeProps<Node<SegmentNodeData>>) {
  return <NodeShell type="segment" label={data.label} desc={data.desc} detail={data.detail} />;
}

export function EventTriggerNodeComponent({ data }: NodeProps<Node<EventTriggerNodeData>>) {
  return <NodeShell type="event_trigger" label={data.label} desc={data.desc} badge="Event" />;
}

export function SendNodeComponent({ data }: NodeProps<Node<SendNodeData>>) {
  return (
    <NodeShell type="send" label={data.label} desc={data.timing || undefined} isSend>
      {data.templateAssigned ? (
        <div className="flex items-center gap-1 mt-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0ba68f" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>
          <span className="text-[9px] font-medium" style={{ color: "#0ba68f" }}>{data.templateAssigned}</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 mt-1.5">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span className="text-[9px]" style={{ color: "#d97706" }}>Assign template</span>
        </div>
      )}
    </NodeShell>
  );
}

export function PauseNodeComponent({ data }: NodeProps<Node<PauseNodeData>>) {
  return <NodeShell type="pause" label={data.label} desc={data.desc} />;
}

export function WaitUntilNodeComponent({ data }: NodeProps<Node<WaitUntilNodeData>>) {
  return <NodeShell type="wait_until" label={data.label} desc={data.desc} badge="Timeout" handleCount={data.timeout ? 2 : 1} />;
}

export function ConditionalSplitNodeComponent({ data }: NodeProps<Node<ConditionalSplitNodeData>>) {
  return <NodeShell type="conditional_split" label={data.label} desc={data.desc} handleCount={data.branchCount || 2} />;
}

export function RandomSplitNodeComponent({ data }: NodeProps<Node<RandomSplitNodeData>>) {
  return <NodeShell type="random_split" label={data.label} desc={data.desc} badge="A/B" handleCount={data.branchCount || 2} />;
}

export function ExitNodeComponent({ data }: NodeProps<Node<ExitNodeData>>) {
  return <NodeShell type="exit" label={data.label} desc={data.desc} isExit isTerminal />;
}

export function GoalExitNodeComponent({ data }: NodeProps<Node<GoalExitNodeData>>) {
  return <NodeShell type="goal_exit" label={data.label} desc={data.desc} isExit isTerminal />;
}

export type BranchLabelNodeData = { label: string; color?: string; size?: number; condition?: string; sql?: string };

export function BranchLabelNodeComponent({ data }: NodeProps<Node<BranchLabelNodeData>>) {
  const [showCondition, setShowCondition] = useState(false);
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    green: { bg: "rgba(11,166,143,0.08)", text: "#0ba68f", border: "rgba(11,166,143,0.2)" },
    red: { bg: "rgba(229,83,75,0.06)", text: "#e5534b", border: "rgba(229,83,75,0.15)" },
    purple: { bg: "rgba(107,57,215,0.06)", text: "#6b39d7", border: "rgba(107,57,215,0.15)" },
    blue: { bg: "rgba(21,101,192,0.06)", text: "#1565C0", border: "rgba(21,101,192,0.15)" },
  };
  const c = colorMap[data.color || "purple"] || colorMap.purple;

  return (
    <div className="relative">
      <div
        className="px-3 py-1.5 rounded-lg text-center cursor-pointer hover:shadow-md transition-shadow"
        style={{ background: c.bg, border: `1px solid ${c.border}`, minWidth: 120 }}
        onClick={() => data.condition && setShowCondition(!showCondition)}
      >
        <Handle type="target" position={Position.Top} style={{ background: "transparent", width: 1, height: 1, border: "none" }} />
        <p className="text-[10px] font-semibold" style={{ color: c.text }}>{data.label}</p>
        {data.size != null && data.size > 0 && <p className="text-[9px]" style={{ color: c.text, opacity: 0.7 }}>{data.size.toLocaleString()} customers</p>}
        <Handle type="source" position={Position.Bottom} style={{ background: "transparent", width: 1, height: 1, border: "none" }} />
      </div>

      {/* Condition + SQL popover */}
      {showCondition && (data.condition || data.sql) && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50" style={{ width: 280 }}>
          <div className="bg-white rounded-lg border p-3" style={{ borderColor: c.border, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-semibold uppercase" style={{ color: c.text }}>Segment Filter</span>
              <button onClick={(e) => { e.stopPropagation(); setShowCondition(false); }} className="text-[10px]" style={{ color: "#435565" }}>✕</button>
            </div>
            {data.condition && (
              <p className="text-[10px] leading-relaxed mb-2" style={{ color: "#0f1235" }}>{data.condition}</p>
            )}
            {data.sql && (
              <div className="rounded p-2 mt-1" style={{ background: "#f8f9fa", border: "1px solid #e5e7eb" }}>
                <p className="text-[8px] font-semibold uppercase mb-1" style={{ color: "#9ca3af" }}>Query</p>
                <p className="text-[9px] font-mono leading-relaxed" style={{ color: "#374151" }}>{data.sql}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// NODE TYPES MAP (for React Flow)
// ============================================================

export const nodeTypes = {
  segment: SegmentNodeComponent,
  event_trigger: EventTriggerNodeComponent,
  send: SendNodeComponent,
  pause: PauseNodeComponent,
  wait_until: WaitUntilNodeComponent,
  branch_label: BranchLabelNodeComponent,
  conditional_split: ConditionalSplitNodeComponent,
  random_split: RandomSplitNodeComponent,
  exit: ExitNodeComponent,
  goal_exit: GoalExitNodeComponent,
};
