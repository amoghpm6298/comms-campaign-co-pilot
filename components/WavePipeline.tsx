"use client";

// --- Types ---

interface Step {
  day: number;
  channel: string;
  timing: string;
  brief: string;
}

interface Segment {
  name: string;
  audienceRule: string;
  size: number;
  steps: Step[];
}

export interface WaveData {
  id: string;
  number: number;
  name: string;
  status: "live" | "scheduled" | "draft" | "blueprint";
  version: number;
  segments: Segment[];
  blueprint?: string;
  totalAudience: number;
  excluded?: number;
  metrics?: { sent: number; opened: number; clicked: number; converted: number };
}

// --- Status config ---

const statusConfig: Record<string, { bg: string; color: string; label: string; dot: string }> = {
  live: { bg: "rgba(11,166,143,0.08)", color: "#0ba68f", label: "Live", dot: "#0ba68f" },
  scheduled: { bg: "rgba(21,101,192,0.08)", color: "#1565C0", label: "Scheduled", dot: "#1565C0" },
  draft: { bg: "rgba(74,111,165,0.08)", color: "#4A6FA5", label: "Draft", dot: "#4A6FA5" },
  blueprint: { bg: "rgba(107,57,215,0.06)", color: "#6b39d7", label: "Planned", dot: "#6b39d7" },
};

// --- Wave list item ---

function WaveListItem({ wave, selected, onClick }: { wave: WaveData; selected: boolean; onClick: () => void }) {
  const sc = statusConfig[wave.status] || statusConfig.draft;

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-1.5 rounded transition-all"
      style={{
        background: selected ? "#f0f2ff" : "transparent",
        borderLeft: selected ? "2px solid var(--navy)" : "2px solid transparent",
      }}
    >
      <p className="text-[10px] font-medium leading-snug" style={{ color: selected ? "var(--navy)" : "#374151" }}>{wave.name}</p>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
        <span className="text-[8px]" style={{ color: sc.color }}>{sc.label}</span>
        {wave.version > 1 && <span className="text-[8px] font-mono" style={{ color: "#9ca3af" }}>v{wave.version}</span>}
      </div>
    </button>
  );
}

// --- Connector ---

function WaveConnector() {
  return (
    <div className="flex" style={{ marginLeft: 12 }}>
      <div style={{ width: 1, height: 8, background: "#e5e7eb" }} />
    </div>
  );
}

// --- Main component ---

export function WavePipelineList({ waves, selectedId, onSelect }: {
  waves: WaveData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-3 h-[44px] flex items-center border-b flex-shrink-0" style={{ borderColor: "#e5e7eb" }}>
        <div>
          <p className="text-[11px] font-semibold" style={{ color: "#0f1235" }}>Pipeline</p>
          <p className="text-[9px]" style={{ color: "#9ca3af" }}>
            {waves.length} wave{waves.length !== 1 ? "s" : ""}{waves.filter(w => w.status === "live").length > 0 ? ` · ${waves.filter(w => w.status === "live").length} live` : ""}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-3">
        {waves.map((wave, i) => (
          <div key={wave.id}>
            <WaveListItem wave={wave} selected={selectedId === wave.id} onClick={() => onSelect(wave.id)} />
            {i < waves.length - 1 && <WaveConnector />}
          </div>
        ))}

      </div>
    </div>
  );
}
