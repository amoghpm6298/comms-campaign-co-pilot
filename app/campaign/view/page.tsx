"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { JourneyFlowWrapper } from "@/components/journey/JourneyFlowWrapper";
import { WavePipelineList, type WaveData } from "@/components/WavePipeline";
import type { JourneyTreeNode } from "@/components/journey/layout";
import { convertStrategyToJourneyTree } from "@/lib/strategy-converter";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================

interface LayerUI {
  name: string; segment: string; segmentSize: number; channel: string[];
  timing: string; frequency: string; evolution: string; templates: number;
  templateBriefs?: { channel: string; content: string }[];
  exitCondition?: string;
  steps?: { id?: string; day: number; channel: string; timing: string; brief: string }[];
}

interface StrategyUI {
  id: string; name: string; recommended: boolean; approach: string;
  estimatedImpact: string; totalReach: number; totalEligible?: number;
  exclusions: Record<string, number>; layers: LayerUI[];
}

interface CampaignData {
  id: string; name: string; goal: string; status: string; mode?: string;
  activeStrategyId: string | null; goLiveAt?: string;
}

interface WaveAPI {
  id: string; waveNumber: number; name: string; status: string;
  version: number; journeyTree: JourneyTreeNode[]; audienceCount: number;
  blueprint: string; metrics: Record<string, number>;
}

interface VersionData {
  version: number; initiator: string; description: string; createdAt: string;
}

type Tab = "strategy" | "execution" | "performance";

// ============================================================
// STYLE CONFIG
// ============================================================

const statusConfig: Record<string, { bg: string; color: string; label: string }> = {
  live: { bg: "#E8F5E9", color: "#2E7D32", label: "Live" },
  scheduled: { bg: "#E3F2FD", color: "#1565C0", label: "Scheduled" },
  draft: { bg: "#F0F4FF", color: "#4A6FA5", label: "Draft" },
  completed: { bg: "#F5F5F5", color: "#757575", label: "Completed" },
};

const nudgeStatusStyles: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  sent: { bg: "rgba(11,166,143,0.06)", color: "var(--teal)", dot: "var(--teal)", label: "Sent" },
  scheduled: { bg: "rgba(107,57,215,0.06)", color: "var(--purple)", dot: "var(--purple)", label: "Scheduled" },
  archived: { bg: "rgba(67,85,101,0.06)", color: "var(--body-text)", dot: "var(--body-text)", label: "Archived" },
};

// ============================================================
// NUDGE + METRICS GENERATORS (work for both v1 and v2)
// ============================================================

interface NudgeRow {
  id: string; name: string; path: string; channel: string;
  audience: number; scheduled: string; status: "sent" | "scheduled" | "archived";
}

// Extract Send nodes from journey tree recursively
function extractSendNodes(nodes: JourneyTreeNode[], waveName: string): { label: string; channel: string; waveName: string }[] {
  const sends: { label: string; channel: string; waveName: string }[] = [];
  for (const node of nodes) {
    if (node.type === "send") {
      sends.push({ label: node.label, channel: (node.config?.channel as string) || "SMS", waveName });
    }
    if (node.branches) {
      for (const branch of node.branches) {
        sends.push(...extractSendNodes(branch.nodes, waveName));
      }
    }
  }
  return sends;
}

function generateNudgesFromWaves(waves: WaveAPI[], goLiveAt?: string): NudgeRow[] {
  const baseDate = goLiveAt ? new Date(goLiveAt) : new Date();
  const now = new Date();
  const nudges: NudgeRow[] = [];
  let idx = 0;

  for (const wave of waves) {
    const sends = extractSendNodes(wave.journeyTree, wave.name);
    for (const send of sends) {
      const sendDate = new Date(baseDate);
      sendDate.setDate(sendDate.getDate() + (wave.waveNumber - 1) * 3 + idx % 5);
      nudges.push({
        id: `n-${idx++}`,
        name: `${wave.name} — ${send.label}`,
        path: send.waveName,
        channel: send.channel,
        audience: Math.round(wave.audienceCount / sends.length),
        scheduled: sendDate.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }),
        status: sendDate < now ? "sent" : "scheduled",
      });
    }
  }
  return nudges;
}

function generateNudgesFromStrategy(strategy: StrategyUI, goLiveAt?: string): NudgeRow[] {
  const baseDate = goLiveAt ? new Date(goLiveAt) : new Date();
  const now = new Date();
  const nudges: NudgeRow[] = [];
  let idx = 0;

  for (const layer of strategy.layers) {
    const steps = layer.steps || [];
    if (steps.length > 0) {
      for (const step of steps) {
        const sendDate = new Date(baseDate);
        sendDate.setDate(sendDate.getDate() + step.day - 1);
        nudges.push({
          id: `n-${idx++}`,
          name: `${layer.name} — Day ${step.day} ${step.channel}`,
          path: layer.name,
          channel: step.channel,
          audience: layer.segmentSize,
          scheduled: sendDate.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }),
          status: sendDate < now ? "sent" : "scheduled",
        });
      }
    } else {
      for (const ch of layer.channel) {
        nudges.push({
          id: `n-${idx++}`,
          name: `${layer.name} — ${ch}`,
          path: layer.name,
          channel: ch,
          audience: layer.segmentSize,
          scheduled: baseDate.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }),
          status: baseDate < now ? "sent" : "scheduled",
        });
      }
    }
  }
  return nudges;
}

function generateMetrics(totalAudience: number, segmentNames: string[]) {
  const totalSent = Math.round(totalAudience * 0.85);
  const delivered = Math.round(totalSent * 0.95);
  const opened = Math.round(delivered * 0.56);
  const clicked = Math.round(opened * 0.32);
  const converted = Math.round(clicked * 0.29);

  const layers = segmentNames.map((name) => {
    const sent = Math.round(totalSent / segmentNames.length);
    const isHigh = name.toLowerCase().includes("high") || name.toLowerCase().includes("clicked") || name.toLowerCase().includes("intent");
    const ctr = isHigh ? 10 + Math.random() * 5 : 3 + Math.random() * 4;
    const conv = isHigh ? 4 + Math.random() * 4 : 0.5 + Math.random() * 1.5;
    return { name, sent, delivered: Math.round(sent * 0.95), ctr: Math.round(ctr * 10) / 10, conversion: Math.round(conv * 10) / 10 };
  });

  return { sent: totalSent, delivered, opened, clicked, converted, layers };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

function CampaignView() {
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id");
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [strategies, setStrategies] = useState<StrategyUI[]>([]);
  const [waves, setWaves] = useState<WaveAPI[]>([]);
  const [versions, setVersions] = useState<VersionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("strategy");
  const [selectedWaveId, setSelectedWaveId] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/campaign?id=${campaignId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.campaign) setCampaign(data.campaign);
        if (data.strategies) setStrategies(data.strategies);
        if (data.waves) {
          setWaves(data.waves);
          if (data.waves.length > 0) setSelectedWaveId(data.waves[0].id);
        }
        if (data.versions) setVersions(data.versions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  const isV2 = waves.length > 0;
  const activeStrategy = strategies.find((s) => s.id === campaign?.activeStrategyId) || strategies.find((s) => s.recommended) || strategies[0];
  const selectedWave = waves.find((w) => w.id === selectedWaveId);

  // Wave sidebar data
  const waveSidebarData: WaveData[] = useMemo(() => waves.map((w) => ({
    id: w.id, number: w.waveNumber, name: w.name,
    status: w.status as WaveData["status"], version: w.version,
    totalAudience: w.audienceCount, segments: [], blueprint: w.blueprint,
    metrics: w.metrics as WaveData["metrics"],
  })), [waves]);

  // Nudges (for execution tab)
  const nudges = useMemo(() => {
    if (isV2) return generateNudgesFromWaves(waves, campaign?.goLiveAt);
    if (activeStrategy) return generateNudgesFromStrategy(activeStrategy, campaign?.goLiveAt);
    return [];
  }, [isV2, waves, activeStrategy, campaign?.goLiveAt]);

  // Metrics (for performance tab)
  const metrics = useMemo(() => {
    if (isV2) {
      const totalAudience = waves[0]?.audienceCount || 0;
      const segmentNames = waves.flatMap((w) => {
        const names: string[] = [];
        function walk(nodes: JourneyTreeNode[]) {
          for (const n of nodes) {
            if (n.type === "segment") names.push(n.label);
            if (n.branches) n.branches.forEach((b) => { names.push(b.label); walk(b.nodes); });
          }
        }
        walk(w.journeyTree);
        return names;
      }).filter((n) => n && !n.includes("Entry") && !n.includes("Wave"));
      return generateMetrics(totalAudience, segmentNames.length > 0 ? segmentNames : ["Wave 1"]);
    }
    if (activeStrategy) {
      return generateMetrics(activeStrategy.totalReach, activeStrategy.layers.map((l) => l.name));
    }
    return null;
  }, [isV2, waves, activeStrategy]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><p className="text-sm animate-pulse" style={{ color: "var(--body-text)" }}>Loading campaign...</p></div>;
  }

  if (!campaign) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-3">
        <p className="text-sm" style={{ color: "var(--body-text)" }}>Campaign not found</p>
        <Link href="/campaign" className="text-[12px] font-medium underline" style={{ color: "var(--navy)" }}>Back to campaigns</Link>
      </div>
    );
  }

  const sc = statusConfig[campaign.status] || statusConfig.draft;
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "strategy", label: waves.length > 0 ? "Pipeline" : "Strategy" },
    { key: "execution", label: "Execution", count: nudges.filter((n) => n.status === "scheduled").length },
    { key: "performance", label: "Performance" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b px-6 py-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 mb-3">
          <Link href="/campaign" className="w-7 h-7 rounded-lg flex items-center justify-center border hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="2"><polyline points="15,18 9,12 15,6" /></svg>
          </Link>
          <h1 className="text-[16px] font-semibold" style={{ color: "var(--navy)" }}>{campaign.name}</h1>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
          {campaign.goLiveAt && (
            <span className="text-[11px]" style={{ color: "var(--body-text)" }}>
              {campaign.status === "scheduled" ? "Scheduled for" : "Live since"} {new Date(campaign.goLiveAt).toLocaleString()}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`/campaign/new?id=${campaign.id}`}
              className="px-3 py-1.5 rounded-lg text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors hover:opacity-90"
              style={{ background: "var(--navy)", color: "white" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" /></svg>
              Co-pilot
            </Link>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded cursor-pointer hover:bg-gray-100" style={{ color: "var(--body-text)", background: "var(--ghost-white)" }} title={campaign.id} onClick={() => navigator.clipboard.writeText(campaign.id)}>
              {campaign.id.substring(0, 8)}...
            </span>
            {isV2 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(107,57,215,0.06)", color: "var(--purple)" }}>{waves.length} waves</span>}
          </div>
        </div>

        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5" style={{ background: activeTab === tab.key ? "var(--navy)" : "transparent", color: activeTab === tab.key ? "white" : "var(--body-text)" }}>
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: activeTab === tab.key ? "rgba(255,255,255,0.2)" : "rgba(107,57,215,0.08)", color: activeTab === tab.key ? "white" : "var(--purple)" }}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">

        {/* === STRATEGY / PIPELINE TAB === */}
        {activeTab === "strategy" && (
          isV2 ? (
            /* V2: Wave pipeline */
            <div className="flex h-full">
              <div className="w-[260px] border-r flex-shrink-0" style={{ borderColor: "var(--border)" }}>
                <WavePipelineList waves={waveSidebarData} selectedId={selectedWaveId} onSelect={setSelectedWaveId} />
              </div>
              <div className="flex-1 overflow-hidden">
                {selectedWave && selectedWave.status !== "blueprint" ? (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--border)", background: "var(--ghost-white)" }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: "var(--navy)" }}>{selectedWave.waveNumber}</div>
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: "var(--navy)" }}>{selectedWave.name}</p>
                          <p className="text-[10px]" style={{ color: "var(--body-text)" }}>{(selectedWave.audienceCount || 0).toLocaleString()} customers{selectedWave.version > 1 ? ` · v${selectedWave.version}` : ""}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0">
                      <JourneyFlowWrapper nodes={selectedWave.journeyTree} />
                    </div>
                  </div>
                ) : selectedWave ? (
                  <div className="h-full flex items-center justify-center px-12">
                    <div className="max-w-md text-center">
                      <h3 className="text-[15px] font-semibold mb-2" style={{ color: "var(--navy)" }}>Blueprint Wave</h3>
                      <p className="text-[12px] leading-relaxed" style={{ color: "var(--body-text)" }}>{selectedWave.blueprint || "Will be defined after previous wave data."}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center"><p className="text-[13px]" style={{ color: "var(--body-text)" }}>Select a wave</p></div>
                )}
              </div>
            </div>
          ) : activeStrategy ? (
            /* V1: Strategy workflow */
            <div className="h-full">
              <div className="flex items-center gap-5 px-6 py-3 border-b text-[12px]" style={{ borderColor: "var(--border)", background: "var(--ghost-white)" }}>
                <div><span style={{ color: "var(--body-text)" }}>Strategy </span><span className="font-semibold" style={{ color: "var(--navy)" }}>{activeStrategy.name}</span></div>
                <div className="w-px h-4" style={{ background: "var(--border)" }} />
                <div><span style={{ color: "var(--body-text)" }}>Reach </span><span className="font-semibold" style={{ color: "var(--navy)" }}>{(activeStrategy.totalReach || 0).toLocaleString()}</span></div>
                <div className="w-px h-4" style={{ background: "var(--border)" }} />
                <div><span style={{ color: "var(--body-text)" }}>Excluded </span><span className="font-semibold" style={{ color: "var(--error-red)" }}>{activeStrategy.exclusions?.total || 0}</span></div>
                <div className="w-px h-4" style={{ background: "var(--border)" }} />
                <div><span style={{ color: "var(--body-text)" }}>Impact </span><span className="font-semibold" style={{ color: "var(--navy)" }}>{activeStrategy.estimatedImpact}</span></div>
              </div>
              {(() => {
                const journeyNodes = convertStrategyToJourneyTree(activeStrategy) as JourneyTreeNode[];
                return <JourneyFlowWrapper nodes={journeyNodes} />;
              })()}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center"><p className="text-[13px]" style={{ color: "var(--body-text)" }}>No strategy data</p></div>
          )
        )}

        {/* === EXECUTION TAB === */}
        {activeTab === "execution" && (
          <div className="px-6 py-6 overflow-y-auto h-full">
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Nudges", value: nudges.length, color: "var(--navy)" },
                { label: "Sent", value: nudges.filter((n) => n.status === "sent").length, color: "var(--teal)" },
                { label: "Scheduled", value: nudges.filter((n) => n.status === "scheduled").length, color: "var(--purple)" },
                { label: "Archived", value: nudges.filter((n) => n.status === "archived").length, color: "var(--body-text)" },
              ].map((s) => (
                <div key={s.label} className="border rounded-xl p-3.5" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--body-text)" }}>{s.label}</p>
                  <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>

            <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ background: "var(--ghost-white)" }}>
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Nudge</th>
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>{isV2 ? "Wave" : "Path"}</th>
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Channel</th>
                    <th className="text-right px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Audience</th>
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Scheduled</th>
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {nudges.map((n) => {
                    const s = nudgeStatusStyles[n.status];
                    return (
                      <tr key={n.id} className="border-t" style={{ borderColor: "var(--border)", opacity: n.status === "archived" ? 0.5 : 1 }}>
                        <td className="px-5 py-2.5" style={{ color: "var(--navy)" }}>{n.name}</td>
                        <td className="px-5 py-2.5" style={{ color: "var(--body-text)" }}>{n.path}</td>
                        <td className="px-5 py-2.5"><span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(15,18,53,0.04)", color: "var(--navy)" }}>{n.channel}</span></td>
                        <td className="px-5 py-2.5 text-right font-medium" style={{ color: "var(--navy)" }}>{(n.audience || 0).toLocaleString()}</td>
                        <td className="px-5 py-2.5 text-[12px]" style={{ color: "var(--body-text)" }}>{n.scheduled}</td>
                        <td className="px-5 py-2.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: s.bg, color: s.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />{s.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === PERFORMANCE TAB === */}
        {activeTab === "performance" && (
          <div className="p-6 overflow-y-auto h-full">
            {/* Campaign timing info */}
            {campaign.goLiveAt && (
              <div className="max-w-2xl mx-auto mb-6 p-3 rounded-lg border flex items-center gap-3" style={{ borderColor: "#e5e7eb", background: "#fafafa" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12,6 12,12 16,14" /></svg>
                <div>
                  <p className="text-[11px] font-medium" style={{ color: "#0f1235" }}>
                    {campaign.status === "scheduled" ? "Scheduled to launch" : "Launched"}: {new Date(campaign.goLiveAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  <p className="text-[9px]" style={{ color: "#9ca3af" }}>
                    {campaign.status === "scheduled" ? "First send triggers at the wave's defined time on the scheduled date" : "Campaign active — sends trigger at each wave's defined times"}
                    {isV2 && waves.length > 0 ? ` · ${waves.length} wave${waves.length > 1 ? "s" : ""} in pipeline` : ""}
                  </p>
                </div>
              </div>
            )}

            <div className="max-w-2xl mx-auto text-center py-8">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(15,18,53,0.04)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0f1235" strokeWidth="1.5" opacity="0.5"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
              </div>
              <h3 className="text-[14px] font-semibold mb-2" style={{ color: "#0f1235" }}>Performance Analytics</h3>
              <p className="text-[12px] mb-6" style={{ color: "#6b7280" }}>Coming soon — real-time campaign performance tracking</p>
              <div className="grid grid-cols-3 gap-4 text-left">
                {[
                  { title: "Engagement Funnel", desc: "Sent → Delivered → Opened → Clicked → Converted — full funnel visibility per wave", icon: "M22 12h-4l-3 9L9 3l-3 9H2" },
                  { title: "Per-Segment Metrics", desc: "CTR, conversion rate, and ROI breakdown per segment within each wave", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
                  { title: "AI Insights", desc: "Co-pilot analyzes live performance and suggests Wave 2+ optimizations automatically", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
                ].map(f => (
                  <div key={f.title} className="border rounded-xl p-4" style={{ borderColor: "var(--border)" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="1.5" className="mb-2 opacity-50"><path d={f.icon} /></svg>
                    <h4 className="text-[12px] font-semibold mb-1" style={{ color: "var(--navy)" }}>{f.title}</h4>
                    <p className="text-[10px] leading-relaxed" style={{ color: "var(--body-text)" }}>{f.desc}</p>
                  </div>
                ))}
              </div>

              {versions.length > 0 && (
                <div className="border rounded-xl p-5 mt-8 text-left" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--body-text)" }}>Version History</p>
                  <div className="space-y-3">
                    {versions.map((v) => (
                      <div key={v.version} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: v.initiator === "ai" ? "var(--purple)" : "var(--navy)" }} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium" style={{ color: "var(--navy)" }}>v{v.version}</span>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: v.initiator === "ai" ? "rgba(107,57,215,0.06)" : "rgba(15,18,53,0.04)", color: v.initiator === "ai" ? "var(--purple)" : "var(--navy)" }}>{v.initiator === "ai" ? "AI" : "User"}</span>
                            <span className="text-[10px]" style={{ color: "var(--body-text)" }}>{new Date(v.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--body-text)" }}>{v.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignViewPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm animate-pulse" style={{ color: "var(--body-text)" }}>Loading...</p></div>}>
      <CampaignView />
    </Suspense>
  );
}
