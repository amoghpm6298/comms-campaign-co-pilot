"use client";

import { JourneyFlowWrapper, type SendNodeInfo } from "@/components/journey/JourneyFlowWrapper";
import { TemplatePanel } from "@/components/journey/TemplatePanel";
import { WavePipelineList, type WaveData } from "@/components/WavePipeline";
import type { JourneyTreeNode } from "@/components/journey/layout";
import { convertStrategyToJourneyTree } from "@/lib/strategy-converter";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useApp } from "@/components/AppProvider";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
}

interface StrategyUI {
  id: string;
  name: string;
  recommended: boolean;
  approach: string;
  estimatedImpact: string;
  totalReach: number;
  totalEligible?: number;
  exclusions: Record<string, number>;
  layers: {
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
    steps?: { id?: string; day: number; channel: string; timing: string; brief: string }[];
  }[];
}

type CanvasState = "empty" | "analyzing" | "strategies" | "waves";

// Extract Send nodes from journey tree
function extractSendNodes(nodes: JourneyTreeNode[]): { label: string; channel: string }[] {
  const sends: { label: string; channel: string }[] = [];
  for (const node of nodes) {
    if (node.type === "send") sends.push({ label: node.label, channel: (node.config?.channel as string) || "SMS" });
    if (node.branches) for (const b of node.branches) sends.push(...extractSendNodes(b.nodes));
  }
  return sends;
}

function WaveDetail({ wave, journeyNodes, onSendNodeClick, selectedSendNodeId, templateAssignments, campaignId, router }: {
  wave: WaveData;
  journeyNodes: JourneyTreeNode[];
  onSendNodeClick: (info: import("@/components/journey/JourneyFlowWrapper").SendNodeInfo) => void;
  selectedSendNodeId: string | null;
  templateAssignments: Record<string, string>;
  campaignId: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [launchMode, setLaunchMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [goingLive, setGoingLive] = useState(false);
  const statusColors: Record<string, { bg: string; color: string; dot: string }> = {
    draft: { bg: "rgba(74,111,165,0.08)", color: "#4A6FA5", dot: "#4A6FA5" },
    live: { bg: "rgba(11,166,143,0.08)", color: "#0ba68f", dot: "#0ba68f" },
    scheduled: { bg: "rgba(21,101,192,0.08)", color: "#1565C0", dot: "#1565C0" },
    completed: { bg: "#F5F5F5", color: "#757575", dot: "#757575" },
  };
  const sc = statusColors[wave.status] || statusColors.draft;

  const handleLaunch = async () => {
    if (!campaignId) return;
    setGoingLive(true);
    try {
      const status = launchMode === "now" ? "live" : "scheduled";
      const scheduledAt = launchMode === "schedule" ? `${scheduleDate}T${scheduleTime}:00` : undefined;
      await fetch("/api/campaign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, status, scheduledAt }),
      });
      router.push(`/campaign/view?id=${campaignId}`);
    } catch { setGoingLive(false); }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Wave header */}
      <div className="flex items-center justify-between px-4 h-[44px] border-b flex-shrink-0" style={{ borderColor: "#e5e7eb" }}>
        <div className="flex items-center gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] font-semibold" style={{ color: "#0f1235" }}>{wave.name}</p>
              <span className="inline-flex items-center gap-1 text-[8px] font-semibold px-1.5 py-0.5 rounded" style={{ background: sc.bg, color: sc.color }}>
                <span className="w-1 h-1 rounded-full" style={{ background: sc.dot }} />
                {wave.status}
              </span>
            </div>
            <p className="text-[9px] font-mono" style={{ color: "#9ca3af" }}>
              {(wave.totalAudience || 0).toLocaleString()} customers{wave.version > 1 ? ` · v${wave.version}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {wave.status === "draft" && (
            <button
              onClick={() => setShowLaunchModal(true)}
              className="px-3 py-1.5 rounded-md text-[10px] font-semibold text-white transition-all hover:opacity-90 hover:shadow-md"
              style={{ background: "#0f1235" }}
            >
              Execute Wave
            </button>
          )}
          {wave.status === "live" && (
            <span className="text-[9px] font-mono" style={{ color: "#9ca3af" }}>Running</span>
          )}
        </div>
      </div>

      {/* Launch modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,18,53,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-xl p-5 w-[400px]" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#0f1235" }}>Execute Wave</h3>

            <div className="flex gap-2 mb-4">
              {([["now", "Execute now", "First communication sent at the next scheduled time"], ["schedule", "Schedule for later", "Pick a date — first send triggers at the wave's defined time"]] as const).map(([mode, title, desc]) => (
                <button
                  key={mode}
                  onClick={() => setLaunchMode(mode)}
                  className="flex-1 text-left px-3 py-2.5 rounded-lg border transition-all"
                  style={{
                    borderColor: launchMode === mode ? "#0f1235" : "#e5e7eb",
                    boxShadow: launchMode === mode ? "0 0 0 1px #0f1235" : undefined,
                    background: launchMode === mode ? "rgba(15,18,53,0.02)" : "#fff",
                  }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: "#0f1235" }}>{title}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: "#9ca3af" }}>{desc}</p>
                </button>
              ))}
            </div>

            {launchMode === "schedule" && (
              <div className="flex gap-2 mb-4">
                <div className="flex-1">
                  <label className="block text-[9px] font-medium mb-1" style={{ color: "#6b7280" }}>Date</label>
                  <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]}
                    className="w-full text-[11px] px-2.5 py-1.5 rounded-md border outline-none" style={{ borderColor: "#e5e7eb" }} />
                </div>
                <div className="w-[100px]">
                  <label className="block text-[9px] font-medium mb-1" style={{ color: "#6b7280" }}>Time</label>
                  <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                    className="w-full text-[11px] px-2.5 py-1.5 rounded-md border outline-none" style={{ borderColor: "#e5e7eb" }} />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowLaunchModal(false)} className="flex-1 py-1.5 rounded-md text-[11px] font-medium border transition-colors hover:bg-gray-50" style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button
                onClick={handleLaunch}
                disabled={goingLive || (launchMode === "schedule" && !scheduleDate)}
                className="flex-1 py-1.5 rounded-md text-[11px] font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                style={{ background: "#0f1235" }}
              >
                {goingLive ? "Executing..." : launchMode === "now" ? "Execute Now" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journey — key forces remount when wave data changes */}
      <div className="flex-1 min-h-0" key={`${wave.id}-v${wave.version}-${journeyNodes.length}`}>
        <JourneyFlowWrapper nodes={journeyNodes} onSendNodeClick={onSendNodeClick} selectedNodeId={selectedSendNodeId} templateAssignments={templateAssignments} />
      </div>
    </div>
  );
}

function CampaignBuilder() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { selectedIssuer } = useApp();
  const urlCampaignId = searchParams.get("id");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [dbTemplates, setDbTemplates] = useState<{ id: string; title: string; channel: string }[]>([]);
  const [input, setInput] = useState("");
  const [canvas, setCanvas] = useState<CanvasState>("empty");
  const [strategies, setStrategies] = useState<StrategyUI[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(urlCampaignId);
  const [loading, setLoading] = useState(false);
  const [showGoLive, setShowGoLive] = useState(false);
  const [goLiveMode, setGoLiveMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [goingLive, setGoingLive] = useState(false);
  const [allTemplatesAssigned, setAllTemplatesAssigned] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!urlCampaignId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Template panel state
  const [selectedSendNode, setSelectedSendNode] = useState<SendNodeInfo | null>(null);
  const [templateAssignments, setTemplateAssignments] = useState<Record<string, string>>({});

  // DB data
  const [dbDatasets, setDbDatasets] = useState<{ id: string; title: string; type: string; rowCount: number }[]>([]);

  // v2 wave state
  const [campaignMode, setCampaignMode] = useState<"v1" | "v2">("v2"); // unified — all new campaigns use waves
  const [waves, setWaves] = useState<WaveData[]>([]);
  const [selectedWaveId, setSelectedWaveId] = useState<string | null>(null);
  const [waveJourneys, setWaveJourneys] = useState<Record<string, JourneyTreeNode[]>>({});

  const selectedPlan = strategies.find((s) => s.id === selectedId);

  // Load existing campaign state from DB
  useEffect(() => {
    if (!urlCampaignId) return;

    async function load() {
      try {
        const res = await fetch(`/api/campaign?id=${urlCampaignId}`);
        const data = await res.json();
        if (data.error) { setInitialLoading(false); return; }

        if (data.messages?.length > 0) {
          setMessages(data.messages);
        }

        // Detect campaign mode from data — waves take priority
        if (data.waves?.length > 0) {
          setCampaignMode("v2");
        } else if (data.strategies?.length > 0) {
          setCampaignMode("v1");
        }

        if (data.waves?.length > 0) {
          // v2: load waves
          const waveDataList: WaveData[] = data.waves.map((w: Record<string, unknown>) => ({
            id: w.id as string,
            number: w.waveNumber as number,
            name: w.name as string,
            status: (w.status as string) as WaveData["status"],
            version: w.version as number,
            totalAudience: w.audienceCount as number,
            segments: [],
            blueprint: w.blueprint as string,
            metrics: w.metrics as WaveData["metrics"],
          }));
          setWaves(waveDataList);

          const journeyMap: Record<string, JourneyTreeNode[]> = {};
          for (const w of data.waves as Record<string, unknown>[]) {
            journeyMap[w.id as string] = w.journeyTree as JourneyTreeNode[];
          }
          setWaveJourneys(journeyMap);

          const lastWave = waveDataList[waveDataList.length - 1];
          setSelectedWaveId(lastWave?.id || null);
          setCanvas("waves");
        } else if (data.strategies?.length > 0) {
          // v1: load strategies
          setStrategies(data.strategies);
          const rec = data.strategies.find((s: StrategyUI) => s.recommended) || data.strategies[0];
          setSelectedId(rec?.id || null);
          setCanvas("strategies");
        }
      } catch (err) {
        console.error("Failed to load campaign:", err);
      }
      setInitialLoading(false);
    }
    load();
  }, [urlCampaignId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch datasets + templates for the selected issuer
  useEffect(() => {
    if (!selectedIssuer) return;
    fetch(`/api/datasets?issuerId=${selectedIssuer.id}`)
      .then((r) => r.json())
      .then((data) => setDbDatasets((data.datasets || []).map((d: { id: string; title: string; type: string; rowCount: number }) => ({ id: d.id, title: d.title, type: d.type, rowCount: d.rowCount }))))
      .catch(() => {});
    fetch(`/api/templates?issuerId=${selectedIssuer.id}`)
      .then((r) => r.json())
      .then((data) => setDbTemplates((data.templates || []).map((t: { id: string; title: string; channel: string }) => ({ id: t.id, title: t.title, channel: t.channel }))))
      .catch(() => {});
  }, [selectedIssuer]);

  const addMsg = (role: "ai" | "user", content: string) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}-${Math.random()}`, role, content }]);
  };

  // --- API call ---
  const callChat = async (userMessage: string, isFirstMessage: boolean) => {
    setLoading(true);

    // Dataset IDs — hardcoded for now, will come from selection widget
    const dataDatasetIds = ["seed-customers.csv", "seed-transactions.csv", "seed-emi_eligibility.csv"];
    const exclusionDatasetIds = ["seed-npa_list.csv", "seed-dnc_list.csv", "seed-fraud_list.csv", "seed-cooling_off_list.csv", "seed-complaint_list.csv"];

    try {
      // Unified: all new campaigns use wave mode. Existing v1 campaigns use legacy mode.
      const chatMode = campaignMode === "v1"
        ? (strategies.length > 0 ? "feedback" : "creation")
        : (waves.length > 0 ? "wave_feedback" : "wave_creation");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaignId || undefined,
          issuerId: "demo-bank",
          mode: chatMode,
          campaignMode: campaignMode || "v1",
          message: userMessage,
          dataDatasetIds: isFirstMessage ? dataDatasetIds : undefined,
          exclusionDatasetIds: isFirstMessage ? exclusionDatasetIds : undefined,
        }),
      });

      const data = await res.json();

      if (data.error) {
        addMsg("ai", `Something went wrong: ${data.error}. Please try again.`);
        setLoading(false);
        return;
      }

      if (data.campaignId && data.campaignId !== campaignId) {
        setCampaignId(data.campaignId);
        // Update URL so refresh preserves state
        router.replace(`/campaign/new?id=${data.campaignId}`, { scroll: false });
      }

      if (data.type === "ask_user") {
        addMsg("ai", data.message);
      } else if (data.type === "strategies" && data.strategies) {
        // v1 mode: strategies with paths/steps
        const uiStrategies: StrategyUI[] = data.strategies.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: s.name as string,
          recommended: s.recommended as boolean,
          approach: s.approach as string,
          estimatedImpact: (s.estimatedImpact || s.estimated_impact) as string,
          totalReach: s.totalReach as number,
          totalEligible: (s.totalEligible as number) || 0,
          exclusions: s.exclusions as Record<string, number>,
          layers: s.layers as StrategyUI["layers"],
        }));

        setStrategies(uiStrategies);
        const recommended = uiStrategies.find((s) => s.recommended) || uiStrategies[0];
        setSelectedId(recommended?.id || null);
        setCanvas("strategies");
        addMsg("ai", data.message);
      } else if (data.type === "wave" && data.wave) {
        // v2 mode: wave with journey tree
        const w = data.wave as { id: string; waveNumber: number; name: string; status: string; version: number; journeyTree: JourneyTreeNode[]; audienceCount: number; blueprint?: string; metrics?: { sent: number; opened: number; clicked: number; converted: number } };
        const waveData: WaveData = {
          id: w.id,
          number: w.waveNumber,
          name: w.name,
          status: w.status as WaveData["status"],
          version: w.version,
          totalAudience: w.audienceCount,
          segments: [], // Derived from journey tree in production
          blueprint: w.blueprint,
          metrics: w.metrics,
        };
        setWaves(prev => {
          const existing = prev.findIndex(p => p.id === w.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = waveData;
            return updated;
          }
          return [...prev, waveData];
        });
        setWaveJourneys(prev => ({ ...prev, [w.id]: w.journeyTree }));
        setSelectedWaveId(w.id);
        setCanvas("waves");
        addMsg("ai", data.message);
      } else {
        addMsg("ai", data.message || "I'm ready to help.");
      }
    } catch (err) {
      addMsg("ai", "Connection error. Please try again.");
      console.error("Chat API error:", err);
    }

    setLoading(false);
  };

  const send = (msg: string) => {
    if (!msg.trim() || loading) return;
    addMsg("user", msg.trim());
    setInput("");

    const isFirst = messages.length === 0 || (messages.length === 1 && messages[0].role === "ai");

    if (canvas === "empty") setCanvas("analyzing");
    callChat(msg.trim(), isFirst);
  };

  const selectStrategy = (id: string) => {
    setSelectedId(id);
  };

  if (initialLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm animate-pulse" style={{ color: "var(--body-text)" }}>Loading campaign...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* === CANVAS === */}
      <div className="flex-1 overflow-hidden border-r" style={{ borderColor: "#e5e7eb" }}>

        {canvas === "empty" && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: "rgba(107,57,215,0.04)", border: "1px solid rgba(107,57,215,0.06)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5" opacity="0.6"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--navy)" }}>Campaign Journey</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--body-text)", maxWidth: 300 }}>Start a conversation to design your campaign. The journey will appear here as the AI builds it.</p>
          </div>
        )}

        {canvas === "analyzing" && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 animate-gentle-pulse" style={{ background: "rgba(107,57,215,0.04)", border: "1px solid rgba(107,57,215,0.06)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            </div>
            <h2 className="text-base font-semibold mb-2" style={{ color: "var(--navy)" }}>Analyzing datasets...</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--body-text)", maxWidth: 300 }}>Exploring your data to design the campaign journey.</p>
          </div>
        )}

        {canvas === "strategies" && (
          <div className="flex h-full">
            {/* Strategy tabs (left strip) */}
            <div className="flex flex-col gap-1 p-2 border-r flex-shrink-0" style={{ borderColor: "#e5e7eb", width: 200 }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1" style={{ color: "var(--body-text)" }}>Strategies</p>
              {strategies.map((plan) => {
                const sel = selectedId === plan.id;
                return (
                  <button key={plan.id} onClick={() => { selectStrategy(plan.id); setSelectedSendNode(null); }}
                    className="text-left px-3 py-2.5 rounded-lg text-[11px] transition-all"
                    style={{ background: sel ? "rgba(15,18,53,0.03)" : "white", border: sel ? "1.5px solid var(--navy)" : "1px solid var(--border)", boxShadow: sel ? "0 2px 8px rgba(15,18,53,0.1)" : "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <p className="font-semibold" style={{ color: sel ? "var(--navy)" : "var(--dark-text)" }}>{plan.name}</p>
                    {plan.recommended && <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded mt-0.5 inline-block" style={{ background: "rgba(107,57,215,0.06)", color: "var(--purple)" }}>Recommended</span>}
                    <p className="text-[9px] mt-0.5" style={{ color: "var(--body-text)" }}>{(plan.totalReach || 0).toLocaleString()} reach · {(plan.layers || []).length} paths</p>
                  </button>
                );
              })}
              <div className="mt-auto p-2">
                <button onClick={() => setShowGoLive(true)} className="w-full py-1.5 rounded-md text-[11px] font-semibold text-white transition-all hover:opacity-90" style={{ background: "#0f1235" }}>Execute</button>
              </div>
            </div>

            {/* Journey (center) */}
            {selectedPlan && (() => {
              const journeyNodes = convertStrategyToJourneyTree(selectedPlan) as JourneyTreeNode[];
              return (
                <div className="flex-1 min-h-0">
                  <JourneyFlowWrapper nodes={journeyNodes} onSendNodeClick={setSelectedSendNode} selectedNodeId={selectedSendNode?.nodeId} templateAssignments={templateAssignments} />
                </div>
              );
            })()}

          </div>
        )}

        {/* === v2 WAVE PIPELINE CANVAS === */}
        {canvas === "waves" && campaignMode === "v2" && (
          <div className="flex h-full">
            {/* Wave sidebar */}
            <div className="w-[200px] border-r flex-shrink-0" style={{ borderColor: "#e5e7eb" }}>
              <WavePipelineList
                waves={waves}
                selectedId={selectedWaveId}
                onSelect={setSelectedWaveId}
              />
            </div>

            {/* Journey visualizer */}
            <div className="flex-1 overflow-hidden">
              {selectedWaveId && waveJourneys[selectedWaveId] ? (
                <WaveDetail
                  wave={waves.find(w => w.id === selectedWaveId)!}
                  journeyNodes={waveJourneys[selectedWaveId]}
                  onSendNodeClick={setSelectedSendNode}
                  selectedSendNodeId={selectedSendNode?.nodeId || null}
                  templateAssignments={templateAssignments}
                  campaignId={campaignId}
                  router={router}
                />
              ) : selectedWaveId && waves.find(w => w.id === selectedWaveId)?.status === "blueprint" ? (
                <div className="h-full flex items-center justify-center px-12">
                  <div className="max-w-md text-center">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(107,57,215,0.06)" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="1.5" opacity="0.6">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" />
                      </svg>
                    </div>
                    <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--navy)" }}>Blueprint Wave</h3>
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--body-text)" }}>
                      {waves.find(w => w.id === selectedWaveId)?.blueprint || "This wave will be defined after previous wave data comes in."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[13px]" style={{ color: "var(--body-text)" }}>Select a wave to view its journey</p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* === RIGHT PANEL: Chat or Template === */}
      <div className="w-[400px] flex flex-col flex-shrink-0 bg-white" style={{ boxShadow: "-1px 0 3px rgba(0,0,0,0.03)" }}>

        {/* Template Panel (when a Send node is selected) */}
        {selectedSendNode ? (
          <TemplatePanel
            nodeId={selectedSendNode.nodeId}
            label={selectedSendNode.label}
            channel={selectedSendNode.channel}
            brief={selectedSendNode.brief}
            templates={dbTemplates}
            assignedTemplate={templateAssignments[selectedSendNode.nodeId] || null}
            onAssign={(id, title) => setTemplateAssignments(prev => ({ ...prev, [id]: title }))}
            onClose={() => setSelectedSendNode(null)}
          />
        ) : (
        <>
        {/* Chat Header */}
        <div className="px-4 h-[44px] flex items-center justify-between border-b" style={{ borderColor: "#e5e7eb" }}>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" /></svg>
            <span className="text-[12px] font-semibold" style={{ color: "#0f1235" }}>Co-pilot</span>
            {loading && <span className="text-[9px] animate-pulse" style={{ color: "var(--purple)" }}>Thinking...</span>}
          </div>
          <Link href="/campaign" className="text-[10px] px-2 py-1 rounded border transition-colors hover:bg-gray-50" style={{ color: "#6b7280", borderColor: "#e5e7eb" }}>Back</Link>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
          {messages.length === 0 && (
            <div>
              <div className="ai-message mb-4">
                <p className="text-sm" style={{ color: "var(--navy)" }}>Let&apos;s build a campaign. Select datasets and tell me your goal.</p>
              </div>

              {/* Dataset selector — from DB */}
              <div className="mb-4">
                {dbDatasets.filter(d => d.type === "data").length > 0 && (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--body-text)" }}>Data</p>
                    <div className="space-y-1.5 mb-3">
                      {dbDatasets.filter(d => d.type === "data").map((ds) => (
                        <label key={ds.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: "#e5e7eb" }}>
                          <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded accent-[#0F1235]" />
                          <span className="text-[12px] font-medium flex-1" style={{ color: "var(--navy)" }}>{ds.title}</span>
                          <span className="text-[10px] font-mono" style={{ color: "var(--body-text)" }}>{ds.rowCount >= 1000 ? `${(ds.rowCount / 1000).toFixed(0)}K` : ds.rowCount}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {dbDatasets.filter(d => d.type === "exclusion").length > 0 && (
                  <>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--body-text)" }}>Exclusion Lists</p>
                    <div className="space-y-1.5 mb-4">
                      {dbDatasets.filter(d => d.type === "exclusion").map((ds) => (
                        <label key={ds.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer hover:bg-gray-50" style={{ borderColor: "rgba(229,83,75,0.12)" }}>
                          <input type="checkbox" defaultChecked className="w-3.5 h-3.5 rounded accent-[#0F1235]" />
                          <span className="text-[12px] font-medium flex-1" style={{ color: "var(--navy)" }}>{ds.title}</span>
                          <span className="text-[10px] font-mono" style={{ color: "var(--error-red)" }}>{ds.rowCount >= 1000 ? `${(ds.rowCount / 1000).toFixed(1)}K` : ds.rowCount}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
                {dbDatasets.length === 0 && (
                  <p className="text-[11px] py-4 text-center" style={{ color: "#9ca3af" }}>No datasets available for this issuer</p>
                )}
              </div>

              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--body-text)" }}>What&apos;s your goal?</p>
              <div className="space-y-1.5">
                {(selectedIssuer?.slug === "axis-bank" ? [
                  "Activate new Flipkart Axis Bank cards",
                  "Drive festive spend on Ace cards",
                  "Convert outstanding to EMI for high-utilization customers",
                  "Re-engage dormant Magnus cardholders",
                ] : [
                  "Convert outstanding balance to EMI",
                  "Drive EMI conversion for high-utilization customers",
                  "Re-engage customers with past EMI conversions",
                  "Target high outstanding balance customers for EMI",
                ]).map((s) => (
                  <button key={s} onClick={() => send(s)} className="w-full text-left text-[12px] px-3.5 py-2.5 rounded-lg border hover:bg-gray-50 transition-colors" style={{ borderColor: "#e5e7eb", color: "var(--navy)" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={msg.role === "ai" ? "ai-message" : "user-message"}>
              <p className="text-sm whitespace-pre-line" dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          ))}

          {loading && messages.length > 0 && (
            <div className="ai-message">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="px-5 py-4 border-t" style={{ borderColor: "#e5e7eb" }}>
          <div className="flex gap-2.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Type a message..."
              className="chat-input flex-1 text-sm px-4 py-2.5 rounded-full border outline-none"
              style={{ borderColor: "var(--border-strong)" }}
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-md flex items-center justify-center text-white disabled:opacity-30 transition-all hover:opacity-90"
              style={{ background: "#0f1235" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22,2 15,22 11,13 2,9" /></svg>
            </button>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Go Live Modal */}
      {showGoLive && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,18,53,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl p-6 w-[460px] animate-scale-in" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <h3 className="text-[14px] font-semibold mb-4" style={{ color: "#0f1235" }}>Execute Campaign</h3>

            {/* Strategy summary */}
            <div className="border rounded-xl p-4 mb-5" style={{ borderColor: "#e5e7eb", background: "var(--ghost-white)" }}>
              <div className="space-y-2 text-[12px]">
                <div className="flex justify-between"><span style={{ color: "var(--body-text)" }}>Strategy</span><span className="font-semibold" style={{ color: "var(--navy)" }}>{selectedPlan.name}</span></div>
                <div className="flex justify-between"><span style={{ color: "var(--body-text)" }}>Reachable</span><span className="font-semibold" style={{ color: "var(--navy)" }}>{(selectedPlan.totalReach || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span style={{ color: "var(--body-text)" }}>Impact</span><span className="font-semibold" style={{ color: "var(--navy)" }}>{selectedPlan.estimatedImpact}</span></div>
              </div>
            </div>

            {/* Launch mode selector */}
            <p className="text-[12px] font-semibold mb-2" style={{ color: "var(--navy)" }}>When should this go live?</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setGoLiveMode("now")}
                className="flex-1 text-left px-4 py-3 rounded-xl border transition-all"
                style={{
                  borderColor: goLiveMode === "now" ? "var(--navy)" : "var(--border)",
                  boxShadow: goLiveMode === "now" ? "0 0 0 1px var(--navy)" : undefined,
                  background: goLiveMode === "now" ? "rgba(15,18,53,0.02)" : "#fff",
                }}
              >
                <p className="text-[12px] font-semibold" style={{ color: "var(--navy)" }}>Go live now</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--body-text)" }}>First send at the next scheduled time</p>
              </button>
              <button
                onClick={() => setGoLiveMode("schedule")}
                className="flex-1 text-left px-4 py-3 rounded-xl border transition-all"
                style={{
                  borderColor: goLiveMode === "schedule" ? "var(--navy)" : "var(--border)",
                  boxShadow: goLiveMode === "schedule" ? "0 0 0 1px var(--navy)" : undefined,
                  background: goLiveMode === "schedule" ? "rgba(15,18,53,0.02)" : "#fff",
                }}
              >
                <p className="text-[12px] font-semibold" style={{ color: "var(--navy)" }}>Schedule for later</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--body-text)" }}>Pick a date and time</p>
              </button>
            </div>

            {/* Schedule picker */}
            {goLiveMode === "schedule" && (
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--body-text)" }}>Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full text-[12px] px-3 py-2 rounded-lg border outline-none focus:border-[var(--navy)]"
                    style={{ borderColor: "var(--border-strong)" }}
                  />
                </div>
                <div className="w-[120px]">
                  <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--body-text)" }}>Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full text-[12px] px-3 py-2 rounded-lg border outline-none focus:border-[var(--navy)]"
                    style={{ borderColor: "var(--border-strong)" }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => { setShowGoLive(false); setGoLiveMode("now"); }} className="flex-1 py-1.5 rounded-md text-[11px] font-medium border transition-colors hover:bg-gray-50" style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button
                disabled={goingLive || (goLiveMode === "schedule" && !scheduledDate)}
                onClick={async () => {
                  if (!campaignId) return;
                  setGoingLive(true);
                  try {
                    const status = goLiveMode === "now" ? "live" : "scheduled";
                    const scheduledAt = goLiveMode === "schedule" ? `${scheduledDate}T${scheduledTime}:00` : undefined;
                    await fetch("/api/campaign", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ campaignId, status, scheduledAt }),
                    });
                    router.push(`/campaign/view?id=${campaignId}`);
                  } catch {
                    setGoingLive(false);
                  }
                }}
                className="flex-1 py-1.5 rounded-md text-[11px] font-semibold text-white text-center transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: "var(--navy)" }}
              >
                {goingLive ? "Executing..." : goLiveMode === "now" ? "Execute Now" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewCampaignV2Page() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm animate-pulse" style={{ color: "var(--body-text)" }}>Loading...</p></div>}>
      <CampaignBuilder />
    </Suspense>
  );
}
