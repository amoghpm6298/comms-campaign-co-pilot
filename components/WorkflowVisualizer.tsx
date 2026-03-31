"use client";

import { useState, useRef, useCallback } from "react";

interface StepData {
  id?: string;
  day: number;
  channel: string;
  timing: string;
  brief: string;
}

interface Layer {
  name: string;
  segment: string;
  segmentSize: number;
  channel: string[];
  timing: string;
  frequency: string;
  evolution: string;
  templates: number;
  templateBriefs?: { channel: string; content: string }[];
  exitCondition?: string;
  steps?: StepData[];
}

interface TemplatePreview { channel: string; content: string; }

const layerTemplates: Record<string, TemplatePreview[]> = {
  "Broad Hook": [
    { channel: "SMS", content: "Hi {name}, your outstanding of ₹{os_amount} is eligible for easy EMI. Convert now → {link}" },
    { channel: "WhatsApp", content: "Hey {name}! ₹{os_amount} outstanding. Convert to EMI — 0% processing fee this month. Tap →" },
  ],
  "High Propensity": [
    { channel: "SMS", content: "{name}, payment due in {days} days. Convert ₹{os_amount} to EMI at 1.2% pm →" },
    { channel: "SMS", content: "Don't pay full ₹{os_amount}. Split into {tenure}m EMI of ₹{emi_amount}/m →" },
    { channel: "SMS", content: "₹{os_amount} outstanding? Pay just ₹{emi_amount}/month. 0% processing fee →" },
    { channel: "SMS", content: "{name}, you're pre-approved for EMI on ₹{os_amount}. One-tap convert →" },
    { channel: "SMS", content: "Smart move: convert ₹{os_amount} to {tenure}m EMI. Your limit stays intact →" },
    { channel: "SMS", content: "EMI available on your ₹{os_amount} outstanding. Choose 3/6/9/12 months →" },
    { channel: "SMS", content: "{name}, why pay ₹{os_amount} at once? EMI from ₹{emi_amount}/m →" },
    { channel: "SMS", content: "Last day: convert ₹{os_amount} to EMI with 0% fee. Expires tonight →" },
  ],
  "High Propensity Only": [
    { channel: "SMS", content: "{name}, ₹{os_amount} due in {days}d. Convert to {tenure}m EMI — ₹{emi_amount}/m →" },
    { channel: "SMS", content: "Don't pay full ₹{os_amount}. Split into easy EMI →" },
    { channel: "SMS", content: "₹{os_amount} outstanding? Convert before {payment_date} →" },
    { channel: "SMS", content: "{name}, EMI available at 1.2% pm on your ₹{os_amount} balance →" },
    { channel: "SMS", content: "Smart choice: ₹{emi_amount}/m instead of ₹{os_amount} at once →" },
  ],
  "Retargeting": [
    { channel: "WhatsApp", content: "You were checking EMI options for ₹{os_amount}. Complete in 30 seconds → {link}" },
    { channel: "WhatsApp", content: "Still thinking about EMI? Your ₹{os_amount} conversion is just one tap away → {link}" },
  ],
  "Phase 1 — Test": [
    { channel: "SMS", content: "{name}, convert ₹{os_amount} to EMI before {payment_date}. Instant approval →" },
    { channel: "SMS", content: "₹{os_amount} due soon. Split into {tenure}m EMI — ₹{emi_amount}/m →" },
    { channel: "SMS", content: "{name}, EMI on your outstanding? One tap to convert →" },
    { channel: "SMS", content: "Don't pay ₹{os_amount} at once. EMI from ₹{emi_amount}/month →" },
  ],
  "Phase 2 — Expand": [
    { channel: "SMS", content: "Your ₹{os_amount} outstanding is EMI-eligible. Split into easy monthly payments →" },
    { channel: "WhatsApp", content: "Hi {name}, convert your ₹{os_amount} outstanding to EMI. Choose 3/6/9/12 months →" },
  ],
};

// --- Visual pieces ---

const colors = {
  entrance: { icon: "#435565", iconBg: "#f0f2f5", border: "var(--border-strong)" },
  guardrail: { icon: "var(--error-red)", iconBg: "rgba(229,83,75,0.06)", border: "rgba(229,83,75,0.18)" },
  send: { icon: "var(--navy)", iconBg: "rgba(15,18,53,0.05)", border: "var(--navy)" },
  condition: { icon: "var(--purple)", iconBg: "rgba(107,57,215,0.06)", border: "rgba(107,57,215,0.18)" },
  wait: { icon: "var(--purple)", iconBg: "rgba(107,57,215,0.04)", border: "var(--border)" },
  exit: { icon: "var(--error-red)", iconBg: "rgba(229,83,75,0.04)", border: "rgba(229,83,75,0.12)" },
};

function NodeCard({
  variant, label, desc, detail, schedule, onClick, active, width, assignmentStatus,
}: {
  variant: keyof typeof colors;
  label: string;
  desc?: string;
  detail?: string;
  schedule?: string;
  onClick?: () => void;
  active?: boolean;
  width?: number;
  templateName?: string | null;
  onAssignTemplate?: () => void;
  assignmentStatus?: { assigned: number; total: number; hasAny: boolean } | null;
}) {
  const c = colors[variant];
  const isSend = variant === "send";
  const isExit = variant === "exit";

  return (
    <div
      onClick={onClick}
      className={`rounded-xl bg-white ${isSend ? "border-2 cursor-pointer hover:shadow-md" : "border"} transition-shadow`}
      style={{
        width: width || 300,
        borderColor: active ? "var(--navy)" : c.border,
        borderStyle: isExit ? "dashed" : "solid",
        boxShadow: active ? "0 0 0 2px rgba(15,18,53,0.08), 0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.05)",
        padding: "12px 16px",
      }}
    >
      <div className={`flex gap-3 ${isExit ? "items-center" : "items-start"}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isExit ? "" : "mt-0.5"}`} style={{ background: c.iconBg }}>
          {variant === "entrance" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
          {variant === "guardrail" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
          {variant === "send" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22,2 15,22 11,13 2,9" /></svg>}
          {variant === "condition" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="1.8"><circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 012 2v7" /><path d="M6 9v12" /></svg>}
          {variant === "wait" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>}
          {variant === "exit" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.icon} strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold flex-1" style={{ color: isExit ? "var(--error-red)" : "var(--navy)" }}>{label}</p>
            {isSend && (
              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors" style={{ background: active ? "var(--navy)" : "rgba(15,18,53,0.04)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={active ? "#fff" : "var(--navy)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {active ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                </svg>
              </div>
            )}
          </div>
          {desc && <p className="text-[10px] leading-snug mt-0.5" style={{ color: "var(--body-text)" }}>{desc}</p>}
          {schedule && (
            <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--ghost-white)" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>
              <span className="text-[11px] font-semibold" style={{ color: "var(--navy)" }}>{schedule}</span>
            </div>
          )}
          {detail && <p className="text-[10px] mt-1.5" style={{ color: "var(--purple)" }}>{detail}</p>}
          {assignmentStatus && (
            <div className="flex items-center gap-1.5 mt-2 text-[10px]">
              {assignmentStatus.hasAny ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>
                  <span style={{ color: "var(--teal)" }}>Template assigned</span>
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <span style={{ color: "#d97706" }}>No template — click to assign</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VLine({ height = 24 }: { height?: number }) {
  return <div className="mx-auto" style={{ width: 1.5, height, background: "#d4d8de" }} />;
}

function BranchLine({ label, side }: { label: string; side: "left" | "right" }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full mb-1" style={{ background: "#f0f1f4", color: "var(--body-text)" }}>{label}</span>
      <div style={{ width: 1.5, height: 16, background: "#d4d8de" }} />
    </div>
  );
}

interface AvailableTemplate {
  id: string;
  title: string;
  channel: string;
}

export function WorkflowVisualizer({ layers, exclusions, totalEligible: totalEligibleProp, showAssignment = false, onAllAssigned, campaignGoal, availableTemplates = [] }: {
  layers: Layer[];
  exclusions?: { npa: number; dnc: number; fraud: number; cooling_off: number; complaint: number; total: number };
  totalEligible?: number;
  showAssignment?: boolean;
  onAllAssigned?: (allAssigned: boolean) => void;
  campaignGoal?: string;
  availableTemplates?: AvailableTemplate[];
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string | null>>({});
  const [splitExpanded, setSplitExpanded] = useState(false);
  const [segmentPopover, setSegmentPopover] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState<string | null>(null);

  // Zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(1.5, Math.max(0.3, z + delta)));
  }, []);

  const handleFit = useCallback(() => {
    setZoom(0.6);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't pan if clicking on interactive elements
    if ((e.target as HTMLElement).closest("button, select, a, [role=button]")) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
    }
  }, [handleZoom]);

  // Get briefs — handle step-level previews (format: "layerName__stepN") or layer-level
  const isStepPreview = preview?.includes("__step");
  const previewLayerName = isStepPreview ? preview!.split("__step")[0] : preview;
  const previewStepIndex = isStepPreview ? parseInt(preview!.split("__step")[1]) : -1;
  const previewLayer = previewLayerName ? layers.find(l => l.name === previewLayerName) : null;
  const templates: TemplatePreview[] = (() => {
    if (!previewLayer) return preview ? layerTemplates[preview] || [] : [];
    if (isStepPreview && previewLayer.steps && previewLayer.steps[previewStepIndex]) {
      const step = previewLayer.steps[previewStepIndex];
      return [{ channel: step.channel, content: step.brief }];
    }
    return previewLayer.templateBriefs || layerTemplates[previewLayer.name] || [];
  })();
  const reachable = layers.reduce((a, l) => a + l.segmentSize, 0);
  const excluded = exclusions?.total || 0;
  // Use AI's total_eligible if available, otherwise fall back to reachable + excluded
  const totalEntrance = totalEligibleProp || (reachable + excluded);
  const reachableAfterExclusions = totalEntrance - excluded;
  const nodeW = 300;
  const branchW = 260;

  const checkAllAssigned = (updated: Record<string, string | null>) => {
    const allAssigned = layers.every(layer => {
      const steps = layer.steps || [];
      if (steps.length > 0) {
        // Multi-step: EVERY step must have a template assigned
        return steps.every((_, si) => updated[`${layer.name}__step${si}-0`]);
      }
      // Legacy: every brief must have a template
      const briefs = layer.templateBriefs || layerTemplates[layer.name] || [];
      return briefs.every((_, ti) => updated[`${layer.name}-${ti}`]);
    });
    onAllAssigned?.(allAssigned);
  };

  // Per-step assignment check (for multi-step nodes)
  const getStepAssignmentStatus = (layerName: string, stepIndex: number) => {
    if (!showAssignment) return null;
    const key = `${layerName}__step${stepIndex}-0`;
    const hasAssignment = !!assignments[key];
    return { assigned: hasAssignment ? 1 : 0, total: 1, hasAny: hasAssignment };
  };

  // Per-layer assignment check (for legacy single-send nodes)
  const getAssignmentStatus = (layerName: string) => {
    if (!showAssignment) return null;
    const layer = layers.find(l => l.name === layerName);
    if (!layer) return null;

    const briefs = layer.templateBriefs || layerTemplates[layerName] || [];
    const assigned = briefs.filter((_, ti) => assignments[`${layerName}-${ti}`]).length;
    return { assigned, total: briefs.length, hasAny: assigned > 0 };
  };

  const getTemplateProps = (layerName: string) => {
    return {};
  };

  const togglePreview = (name: string) => setPreview(prev => prev === name ? null : name);

  // Build the journey based on number of layers
  return (
    <div className="flex h-full relative">
      {/* Journey canvas — zoomable + pannable */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative"
        style={{ background: "#fafcfe", cursor: isPanning ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
      <div
        className="py-6 px-4 origin-top-left"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: isPanning ? "none" : "transform 0.15s ease" }}
      >
      <div className="flex flex-col items-center">

        {/* Entrance */}
        <NodeCard variant="entrance" label="Entrance" desc={`${totalEntrance.toLocaleString()} eligible customers`} width={nodeW} />
        <VLine />

        {/* Guardrails */}
        <NodeCard variant="guardrail" label="Apply Guardrails" desc={`Exclude ${excluded.toLocaleString()} customers (NPA, DNC, fraud, cooling-off)`} detail={`${reachableAfterExclusions.toLocaleString()} reachable after exclusions`} width={nodeW} />
        <VLine height={28} />

        {/* Single path — linear */}
        {layers.length === 1 && (() => {
          const l = layers[0];
          const steps = l.steps || [];
          return (
            <>
              {steps.length > 0 ? (
                // Multi-step sequence
                steps.map((step, si) => (
                  <div key={si} className="flex flex-col items-center">
                    <NodeCard variant="wait" label={`Day ${step.day}`} desc={`${step.timing}`} width={nodeW} />
                    <VLine height={12} />
                    <NodeCard variant="send" label={`Send ${step.channel}`} width={nodeW} onClick={() => togglePreview(`${l.name}__step${si}`)} active={preview === `${l.name}__step${si}`} assignmentStatus={getStepAssignmentStatus(l.name, si)} />
                    <VLine />
                  </div>
                ))
              ) : (
                // Legacy single send
                <>
                  <NodeCard variant="send" label={`${l.name}: Send ${l.channel.join(" + ")}`} desc={`${l.segmentSize.toLocaleString()} customers · ${l.templates} briefs`} schedule={`${l.timing} · ${l.frequency}`} detail={l.evolution} width={nodeW} onClick={() => togglePreview(l.name)} active={preview === l.name} assignmentStatus={getAssignmentStatus(l.name)} />
                  <VLine />
                </>
              )}
              <NodeCard variant="exit" label="Exit" desc={l.exitCondition || "Campaign ends"} width={nodeW} />
            </>
          );
        })()}

        {/* Multiple paths — split into parallel branches */}
        {layers.length >= 2 && (
          <>
            {/* Split node — compact */}
            <NodeCard variant="condition" label="Split by Segment" desc={`${layers.length} parallel paths based on customer segments`} width={nodeW} />
            <VLine height={16} />

            {/* Parallel branches */}
            <div style={{ display: "grid", gridTemplateColumns: layers.map(() => `${branchW}px`).join(" "), gap: 24, alignItems: "start" }}>
              {layers.map((layer, i) => (
                <div key={i} className="flex flex-col items-center" style={{ minHeight: "100%" }}>
                  {/* Branch label with letter + info icon */}
                  <div className="flex flex-col items-center mb-2 relative">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "rgba(107,57,215,0.06)" }}>
                      <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: "var(--purple)" }}>{String.fromCharCode(65 + i)}</span>
                      <span className="text-[10px] font-semibold" style={{ color: "var(--navy)" }}>{layer.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSegmentPopover(segmentPopover === i ? null : i); }}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-purple-100 transition-colors"
                        style={{ background: segmentPopover === i ? "rgba(107,57,215,0.15)" : "transparent" }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
                      </button>
                    </div>

                    {/* Segment popover */}
                    {segmentPopover === i && (
                      <div className="absolute top-full mt-1 z-20 animate-fade-in" style={{ width: 280 }}>
                        <div className="bg-white rounded-xl border p-4" style={{ borderColor: "var(--border-strong)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: "var(--purple)" }}>{String.fromCharCode(65 + i)}</span>
                              <span className="text-[12px] font-semibold" style={{ color: "var(--navy)" }}>{layer.name}</span>
                            </div>
                            <button onClick={() => setSegmentPopover(null)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-gray-100">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                          </div>

                          <div className="text-[10px] mb-3 p-2 rounded-lg leading-relaxed" style={{ background: "var(--ghost-white)", color: "var(--navy)" }}>
                            {layer.segment}
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div>
                              <p style={{ color: "var(--body-text)" }}>Customers</p>
                              <p className="font-semibold" style={{ color: "var(--navy)" }}>{layer.segmentSize.toLocaleString()}</p>
                            </div>
                            <div>
                              <p style={{ color: "var(--body-text)" }}>Channel</p>
                              <p className="font-semibold" style={{ color: "var(--navy)" }}>{layer.channel.join(" + ")}</p>
                            </div>
                            <div>
                              <p style={{ color: "var(--body-text)" }}>Timing</p>
                              <p className="font-semibold" style={{ color: "var(--navy)" }}>{layer.timing}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ width: 1.5, height: 12, background: "#d4d8de" }} />
                  </div>

                  {/* Steps or legacy send */}
                  {(layer.steps && layer.steps.length > 0) ? (
                    // Multi-step vertical sequence
                    layer.steps.map((step, si) => (
                      <div key={si} className="flex flex-col items-center">
                        <NodeCard variant="wait" label={`Day ${step.day}`} desc={step.timing} width={branchW} />
                        <VLine height={10} />
                        <NodeCard variant="send" label={`Send ${step.channel}`} width={branchW} onClick={() => togglePreview(`${layer.name}__step${si}`)} active={preview === `${layer.name}__step${si}`} assignmentStatus={getStepAssignmentStatus(layer.name, si)} />
                        {si < (layer.steps!.length - 1) && <VLine height={10} />}
                      </div>
                    ))
                  ) : (
                    // Legacy single send
                    <NodeCard variant="send" label={`Send ${layer.channel.join(" + ")}`} desc={`${layer.segmentSize.toLocaleString()} customers · ${layer.templates} briefs`} schedule={`${layer.timing} · ${layer.frequency}`} detail={layer.evolution} width={branchW} onClick={() => togglePreview(layer.name)} active={preview === layer.name} assignmentStatus={getAssignmentStatus(layer.name)} />
                  )}

                  <VLine />
                  <NodeCard variant="exit" label="Exit" desc={layer.exitCondition || ""} width={branchW} />
                </div>
              ))}
            </div>
          </>
        )}
      {/* close content div */}
      </div>
      {/* close transform wrapper */}
      </div>

      {/* Zoom controls — positioned inside canvas ref */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-white rounded-lg border px-1 py-1 z-10" style={{ borderColor: "var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <button onClick={() => handleZoom(-0.1)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-50 transition-colors" title="Zoom out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <span className="text-[10px] font-medium w-10 text-center" style={{ color: "var(--body-text)" }}>{Math.round(zoom * 100)}%</span>
        <button onClick={() => handleZoom(0.1)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-50 transition-colors" title="Zoom in">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <div className="w-px h-4 mx-0.5" style={{ background: "var(--border)" }} />
        <button onClick={handleFit} className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-50 transition-colors" title="Fit to view">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="1.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </button>
      </div>
      {/* close canvas ref */}
      </div>

      {/* Template preview — right side panel */}
      {preview && templates.length > 0 && (
        <div className="w-[320px] border-l bg-white flex flex-col flex-shrink-0 animate-fade-in" style={{ borderColor: "var(--border)" }}>
          {/* Panel header */}
          <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: "var(--navy)" }}>
                {previewLayer?.name || preview}
                {isStepPreview && previewLayer?.steps?.[previewStepIndex] && (
                  <span className="font-normal" style={{ color: "var(--body-text)" }}> — Day {previewLayer.steps[previewStepIndex].day}</span>
                )}
              </p>
              <p className="text-[10px]" style={{ color: "var(--body-text)" }}>{templates.length} brief{templates.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={() => setPreview(null)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Brief + template assignment */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {showAssignment && (
              <div className="px-3 py-2 rounded-lg text-[10px] mb-2" style={{ background: "rgba(107,57,215,0.04)", border: "1px solid rgba(107,57,215,0.08)", color: "var(--purple)" }}>
                Assign at least 1 template to go live. Unassigned briefs will rotate the assigned template.
              </div>
            )}
            {templates.map((t, ti) => {
              const briefKey = `${preview}-${ti}`;
              const assignedTemplate = assignments[briefKey] || null;
              return (
                <div key={ti} className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)", background: "#fff" }}>
                  <div className="p-3.5" style={{ background: "var(--ghost-white)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(15,18,53,0.04)", color: "var(--navy)" }}>
                        {t.channel}
                      </span>
                      <span className="text-[9px]" style={{ color: "var(--body-text)" }}>Brief #{ti + 1}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--dark-text)" }}>{t.content}</p>
                  </div>
                  {showAssignment && (
                    <div className="px-3.5 py-2.5 border-t" style={{ borderColor: "var(--border)" }}>
                      {assignedTemplate ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>
                            <span className="text-[10px] font-medium" style={{ color: "var(--teal)" }}>{assignedTemplate}</span>
                          </div>
                          <button onClick={() => { const updated = { ...assignments }; delete updated[briefKey]; setAssignments(updated); checkAllAssigned(updated); }} className="text-[9px]" style={{ color: "var(--body-text)" }}>Change</button>
                        </div>
                      ) : (
                        <select
                          className="w-full text-[10px] py-1 px-2 rounded-lg border outline-none"
                          style={{ borderColor: "var(--border-strong)", color: "var(--navy)" }}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              const updated = { ...assignments, [briefKey]: e.target.value };
                              setAssignments(updated);
                              checkAllAssigned(updated);
                            }
                          }}
                        >
                          <option value="">Select template...</option>
                          {availableTemplates
                            .filter((tmpl) => !t.channel || tmpl.channel === t.channel)
                            .map((tmpl) => (
                              <option key={tmpl.id} value={tmpl.title}>{tmpl.title}</option>
                            ))}
                        </select>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
