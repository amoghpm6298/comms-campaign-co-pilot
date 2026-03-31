"use client";

import { useState } from "react";

interface AvailableTemplate {
  id: string;
  title: string;
  channel: string;
}

interface TemplatePanelProps {
  nodeId: string;
  label: string;
  channel: string;
  brief: string;
  templates: AvailableTemplate[];
  assignedTemplate: string | null;
  onAssign: (nodeId: string, templateTitle: string) => void;
  onClose: () => void;
  showAssignment?: boolean;
}

export function TemplatePanel({ nodeId, label, channel, brief, templates, assignedTemplate, onAssign, onClose, showAssignment = true }: TemplatePanelProps) {
  const [showPicker, setShowPicker] = useState(false);
  const filteredTemplates = templates.filter((t) => t.channel === channel);

  return (
    <div className="flex-1 flex flex-col bg-white animate-fade-in">
      {/* Header */}
      <div className="px-4 h-[44px] flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: "#e5e7eb" }}>
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f1235" strokeWidth="1.8"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
          <div>
            <p className="text-[12px] font-semibold" style={{ color: "#0f1235" }}>{label}</p>
            <p className="text-[9px]" style={{ color: "#9ca3af" }}>{channel}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-[10px] px-2 py-1 rounded border transition-colors hover:bg-gray-50" style={{ color: "#6b7280", borderColor: "#e5e7eb" }}>
          Back to Chat
        </button>
      </div>

      {/* Brief */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {showAssignment && (
          <div className="px-3 py-2 rounded-lg text-[10px]" style={{ background: "rgba(107,57,215,0.04)", border: "1px solid rgba(107,57,215,0.08)", color: "var(--purple)" }}>
            Assign a template to this Send node to go live.
          </div>
        )}

        <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="p-3.5" style={{ background: "var(--ghost-white)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(15,18,53,0.04)", color: "var(--navy)" }}>
                {channel}
              </span>
              <span className="text-[9px]" style={{ color: "var(--body-text)" }}>Brief</span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--dark-text)" }}>{brief}</p>
          </div>

          {showAssignment && (
            <div className="px-3.5 py-2.5 border-t" style={{ borderColor: "var(--border)" }}>
              {assignedTemplate ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5"><polyline points="20,6 9,17 4,12" /></svg>
                    <span className="text-[10px] font-medium" style={{ color: "var(--teal)" }}>{assignedTemplate}</span>
                  </div>
                  <button onClick={() => onAssign(nodeId, "")} className="text-[9px]" style={{ color: "var(--body-text)" }}>Change</button>
                </div>
              ) : (
                <select
                  className="w-full text-[10px] py-1 px-2 rounded-lg border outline-none"
                  style={{ borderColor: "var(--border-strong)", color: "var(--navy)" }}
                  value=""
                  onChange={(e) => { if (e.target.value) onAssign(nodeId, e.target.value); }}
                >
                  <option value="">Select template...</option>
                  {filteredTemplates.map((t) => (
                    <option key={t.id} value={t.title}>{t.title}</option>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <option disabled>No {channel} templates available</option>
                  )}
                </select>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
