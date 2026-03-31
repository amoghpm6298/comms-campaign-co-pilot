"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";

interface Template {
  id: string;
  title: string;
  channel: "SMS" | "WhatsApp" | "Email" | "Push";
  type: string;
  description: string;
  body: string;
  subject: string | null;
  dltTemplateId: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  pushTitle: string | null;
  status: string;
  createdAt: string;
}

const channelConfig: Record<string, { color: string; bg: string }> = {
  SMS: { color: "var(--navy)", bg: "rgba(15,18,53,0.04)" },
  WhatsApp: { color: "#25D366", bg: "rgba(37,211,102,0.06)" },
  Email: { color: "var(--purple)", bg: "rgba(107,57,215,0.06)" },
  Push: { color: "#d97706", bg: "rgba(217,119,6,0.06)" },
};

const typeConfig: Record<string, { color: string; bg: string }> = {
  promotional: { color: "var(--navy)", bg: "rgba(15,18,53,0.04)" },
  transactional: { color: "var(--teal)", bg: "rgba(11,166,143,0.06)" },
  otp: { color: "var(--purple)", bg: "rgba(107,57,215,0.06)" },
};

type View = "list" | "create" | "detail";

function TemplatesPageInner() {
  const { selectedIssuer } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "", channel: "SMS" as Template["channel"], type: "promotional",
    description: "", body: "", subject: "", dltTemplateId: "", ctaText: "", ctaUrl: "", pushTitle: "",
  });

  const urlView = searchParams.get("view") as View | null;
  const urlId = searchParams.get("id");
  const view: View = urlView || "list";
  const selectedId = urlId || null;
  const selected = templates.find((t) => t.id === selectedId);
  const filtered = templates.filter((t) =>
    (filterChannel === "all" || t.channel === filterChannel) &&
    (filterType === "all" || t.type === filterType)
  );

  const setView = useCallback((v: View, id?: string | null) => {
    const params = new URLSearchParams();
    if (v !== "list") params.set("view", v);
    if (id) params.set("id", id);
    const qs = params.toString();
    router.push(`/templates${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!selectedIssuer) return;
    setLoading(true);
    fetch(`/api/templates?issuerId=${selectedIssuer.id}`)
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedIssuer]);

  const handleCreate = async () => {
    if (!createForm.title || !createForm.body) return;
    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((prev) => [data.template, ...prev]);
        setCreateForm({ title: "", channel: "SMS", type: "promotional", description: "", body: "", subject: "", dltTemplateId: "", ctaText: "", ctaUrl: "", pushTitle: "" });
        setView("list");
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  // === CREATE VIEW ===
  if (view === "create") {
    return (
      <div className="max-w-[600px] mx-auto px-8 py-8 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>Create Template</h1>
          <button onClick={() => setView("list")} className="text-[12px] px-3 py-1.5 rounded-full border hover:bg-gray-50" style={{ borderColor: "var(--border)", color: "var(--body-text)" }}>Cancel</button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Title</label>
            <input type="text" value={createForm.title} onChange={(e) => setCreateForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g., EMI Convert Urgency" className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none focus:border-[var(--navy)]" style={{ borderColor: "var(--border-strong)" }} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Channel</label>
              <div className="flex gap-2">
                {(["SMS", "WhatsApp", "Email", "Push"] as const).map((ch) => (
                  <button key={ch} onClick={() => setCreateForm(p => ({ ...p, channel: ch }))} className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-all text-center" style={{ background: createForm.channel === ch ? channelConfig[ch].bg : "var(--ghost-white)", color: createForm.channel === ch ? channelConfig[ch].color : "var(--body-text)", border: createForm.channel === ch ? `1px solid ${channelConfig[ch].color}` : "1px solid var(--border)" }}>
                    {ch}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Type</label>
              <div className="flex gap-2">
                {(["promotional", "transactional", "otp"] as const).map((tp) => (
                  <button key={tp} onClick={() => setCreateForm(p => ({ ...p, type: tp }))} className="flex-1 py-2 rounded-lg text-[11px] font-medium transition-all text-center capitalize" style={{ background: createForm.type === tp ? (typeConfig[tp]?.bg || "var(--ghost-white)") : "var(--ghost-white)", color: createForm.type === tp ? (typeConfig[tp]?.color || "var(--navy)") : "var(--body-text)", border: createForm.type === tp ? `1px solid ${typeConfig[tp]?.color || "var(--navy)"}` : "1px solid var(--border)" }}>
                    {tp}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Description</label>
            <input type="text" value={createForm.description} onChange={(e) => setCreateForm(p => ({ ...p, description: e.target.value }))} placeholder="What is this template for?" className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none focus:border-[var(--navy)]" style={{ borderColor: "var(--border-strong)" }} />
          </div>

          {createForm.channel === "Email" && (
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Subject Line</label>
              <input type="text" value={createForm.subject} onChange={(e) => setCreateForm(p => ({ ...p, subject: e.target.value }))} placeholder="Email subject..." className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none focus:border-[var(--navy)]" style={{ borderColor: "var(--border-strong)" }} />
            </div>
          )}

          {createForm.channel === "Push" && (
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Push Title</label>
              <input type="text" value={createForm.pushTitle} onChange={(e) => setCreateForm(p => ({ ...p, pushTitle: e.target.value }))} placeholder="Notification title..." className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none focus:border-[var(--navy)]" style={{ borderColor: "var(--border-strong)" }} />
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Body</label>
            <textarea value={createForm.body} onChange={(e) => setCreateForm(p => ({ ...p, body: e.target.value }))} placeholder="Template body... Use {name}, {os_amount}, {link} etc. for personalization" rows={5} className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none focus:border-[var(--navy)] resize-none font-mono" style={{ borderColor: "var(--border-strong)", fontSize: 12 }} />
            <p className="text-[10px] mt-1" style={{ color: "var(--body-text)" }}>{createForm.body.length} characters {createForm.channel === "SMS" && createForm.body.length > 160 ? "— exceeds SMS limit" : ""}</p>
          </div>

          {createForm.channel === "SMS" && (
            <div>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>DLT Template ID</label>
              <input type="text" value={createForm.dltTemplateId} onChange={(e) => setCreateForm(p => ({ ...p, dltTemplateId: e.target.value }))} placeholder="TRAI DLT registered template ID" className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none focus:border-[var(--navy)]" style={{ borderColor: "var(--border-strong)" }} />
            </div>
          )}

          {createForm.channel === "WhatsApp" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>CTA Text</label>
                <input type="text" value={createForm.ctaText} onChange={(e) => setCreateForm(p => ({ ...p, ctaText: e.target.value }))} placeholder="Button text" className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none focus:border-[var(--navy)]" style={{ borderColor: "var(--border-strong)" }} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>CTA URL</label>
                <input type="text" value={createForm.ctaUrl} onChange={(e) => setCreateForm(p => ({ ...p, ctaUrl: e.target.value }))} placeholder="Button link" className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none focus:border-[var(--navy)]" style={{ borderColor: "var(--border-strong)" }} />
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button onClick={handleCreate} disabled={!createForm.title || !createForm.body || saving} className="w-full py-3 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40" style={{ background: "var(--navy)" }}>
            {saving ? "Creating..." : "Create Template"}
          </button>
        </div>
      </div>
    );
  }

  // === DETAIL VIEW ===
  if (view === "detail" && selected) {
    const ch = channelConfig[selected.channel] || channelConfig.SMS;
    const tp = typeConfig[selected.type] || typeConfig.promotional;
    return (
      <div className="max-w-[700px] mx-auto px-8 py-8 h-full overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView("list")} className="w-7 h-7 rounded-lg flex items-center justify-center border hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="2"><polyline points="15,18 9,12 15,6" /></svg>
          </button>
          <h1 className="text-lg font-bold" style={{ color: "var(--navy)" }}>{selected.title}</h1>
        </div>

        <div className="flex gap-2 mb-6">
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: ch.bg, color: ch.color }}>{selected.channel}</span>
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: tp.bg, color: tp.color }}>{selected.type}</span>
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: selected.status === "approved" ? "rgba(11,166,143,0.06)" : "rgba(67,85,101,0.06)", color: selected.status === "approved" ? "var(--teal)" : "var(--body-text)" }}>{selected.status}</span>
        </div>

        {selected.description && (
          <p className="text-[13px] mb-6" style={{ color: "var(--body-text)" }}>{selected.description}</p>
        )}

        {/* Preview */}
        <div className="border rounded-xl overflow-hidden mb-6" style={{ borderColor: "var(--border)" }}>
          <div className="px-5 py-2.5" style={{ background: "var(--ghost-white)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Preview</p>
          </div>
          <div className="p-5">
            {selected.subject && <p className="text-[13px] font-semibold mb-3" style={{ color: "var(--navy)" }}>Subject: {selected.subject}</p>}
            {selected.pushTitle && <p className="text-[13px] font-semibold mb-2" style={{ color: "var(--navy)" }}>{selected.pushTitle}</p>}
            <div className="text-[13px] leading-relaxed whitespace-pre-line font-mono" style={{ color: "var(--dark-text)", fontSize: 12 }}>{selected.body}</div>
            {selected.ctaText && (
              <div className="mt-3 inline-block px-4 py-2 rounded-lg text-[12px] font-medium text-white" style={{ background: "#25D366" }}>{selected.ctaText}</div>
            )}
          </div>
        </div>

        {/* Details table */}
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[13px]">
            <tbody>
              {[
                { label: "Channel", value: selected.channel },
                { label: "Type", value: selected.type },
                ...(selected.dltTemplateId ? [{ label: "DLT Template ID", value: selected.dltTemplateId }] : []),
                { label: "Character Count", value: `${selected.body.length}` },
                { label: "Created", value: new Date(selected.createdAt).toLocaleDateString() },
              ].map((row) => (
                <tr key={row.label} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                  <td className="px-5 py-3 font-medium" style={{ color: "var(--body-text)", width: 160 }}>{row.label}</td>
                  <td className="px-5 py-3" style={{ color: "var(--navy)" }}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // === LIST VIEW ===
  return (
    <div className="max-w-[1200px] mx-auto px-8 py-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--navy)" }}>Templates</h1>
        <button onClick={() => setView("create")} className="px-5 py-2.5 rounded-full text-[13px] font-medium text-white inline-flex items-center gap-2 transition-opacity hover:opacity-90" style={{ background: "var(--navy)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Create Template
        </button>
      </div>

      {/* Filters */}
      {!loading && templates.length > 0 && (
        <div className="flex gap-4 mb-6">
          <div className="flex gap-1.5">
            {["all", "SMS", "WhatsApp", "Email", "Push"].map((ch) => (
              <button key={ch} onClick={() => setFilterChannel(ch)} className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all" style={{ background: filterChannel === ch ? "var(--navy)" : "transparent", color: filterChannel === ch ? "#fff" : "var(--body-text)", border: `1px solid ${filterChannel === ch ? "var(--navy)" : "var(--border)"}` }}>
                {ch === "all" ? "All Channels" : ch}
              </button>
            ))}
          </div>
          <div className="w-px" style={{ background: "var(--border)" }} />
          <div className="flex gap-1.5">
            {["all", "promotional", "transactional", "otp"].map((tp) => (
              <button key={tp} onClick={() => setFilterType(tp)} className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all capitalize" style={{ background: filterType === tp ? "var(--navy)" : "transparent", color: filterType === tp ? "#fff" : "var(--body-text)", border: `1px solid ${filterType === tp ? "var(--navy)" : "var(--border)"}` }}>
                {tp === "all" ? "All Types" : tp}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-[13px]" style={{ color: "var(--body-text)" }}>Loading...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13px]" style={{ color: "var(--body-text)" }}>No templates yet.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--ghost-white)" }}>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Template</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Channel</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Type</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Status</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const ch = channelConfig[t.channel] || channelConfig.SMS;
                const tp = typeConfig[t.type] || typeConfig.promotional;
                return (
                  <tr key={t.id} className="border-t cursor-pointer hover:bg-gray-50/50 transition-colors" style={{ borderColor: "var(--border)" }} onClick={() => setView("detail", t.id)}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium" style={{ color: "var(--navy)" }}>{t.title}</p>
                      <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--body-text)", maxWidth: 300 }}>{t.body.substring(0, 60)}...</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: ch.bg, color: ch.color }}>{t.channel}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize" style={{ background: tp.bg, color: tp.color }}>{t.type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: t.status === "approved" ? "var(--teal)" : "var(--body-text)" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.status === "approved" ? "var(--teal)" : "var(--body-text)" }} />
                        {t.status === "approved" ? "Approved" : t.status === "draft" ? "Draft" : "Archived"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px]" style={{ color: "var(--body-text)" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm animate-pulse" style={{ color: "var(--body-text)" }}>Loading...</p></div>}>
      <TemplatesPageInner />
    </Suspense>
  );
}
