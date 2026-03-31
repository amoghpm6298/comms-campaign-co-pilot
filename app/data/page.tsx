"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";

interface Dataset {
  id: string;
  title: string;
  description: string;
  type: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  columns: string;
  status: string;
  processingStatus: string;
  createdAt: string;
}

const processingColors: Record<string, { bg: string; color: string; dot: string }> = {
  successful: { bg: "rgba(11,166,143,0.06)", color: "var(--teal)", dot: "var(--teal)" },
  pending: { bg: "rgba(107,57,215,0.06)", color: "var(--purple)", dot: "var(--purple)" },
  failed: { bg: "rgba(229,83,75,0.06)", color: "var(--error-red)", dot: "var(--error-red)" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type View = "list" | "create" | "detail";

function DataPageInner() {
  const { selectedIssuer } = useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [createForm, setCreateForm] = useState({ title: "", description: "", type: "data" as "data" | "exclusion", file: null as File | null });
  const [saving, setSaving] = useState(false);

  // Derive view and selectedId from URL
  const urlView = searchParams.get("view") as View | null;
  const urlId = searchParams.get("id");
  const view: View = urlView || "list";
  const selectedId = urlId || null;
  const selected = datasets.find((d) => d.id === selectedId);

  const setView = useCallback((v: View, id?: string | null) => {
    const params = new URLSearchParams();
    if (v !== "list") params.set("view", v);
    if (id) params.set("id", id);
    const qs = params.toString();
    router.push(`/data${qs ? `?${qs}` : ""}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!selectedIssuer) return;
    setLoading(true);
    fetch(`/api/datasets?issuerId=${selectedIssuer.id}`)
      .then((r) => r.json())
      .then((data) => setDatasets(data.datasets || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedIssuer]);

  const handleCreate = async () => {
    if (!createForm.title || !createForm.file) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("title", createForm.title);
      formData.append("description", createForm.description);
      formData.append("type", createForm.type);
      formData.append("file", createForm.file);

      const res = await fetch("/api/datasets", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setDatasets((prev) => [data.dataset, ...prev]);
        setCreateForm({ title: "", description: "", type: "data", file: null });
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
          <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>Upload Dataset</h1>
          <button onClick={() => setView("list")} className="text-[12px] px-3 py-1.5 rounded-full border hover:bg-gray-50" style={{ borderColor: "var(--border)", color: "var(--body-text)" }}>Cancel</button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Title</label>
            <input type="text" value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., Customer Master, Transaction History" className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none transition-colors focus:border-[var(--navy)]" style={{ borderColor: "var(--border-strong)" }} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Type</label>
            <div className="flex gap-2">
              {([["data", "Data", "Used for targeting and analysis"], ["exclusion", "Exclusion List", "Customers to exclude from campaigns"]] as const).map(([val, label, desc]) => (
                <button key={val} onClick={() => setCreateForm((p) => ({ ...p, type: val }))} className="flex-1 text-left px-4 py-3 rounded-xl border transition-all" style={{ borderColor: createForm.type === val ? "var(--navy)" : "var(--border)", boxShadow: createForm.type === val ? "0 0 0 1px var(--navy)" : undefined, background: createForm.type === val ? "rgba(15,18,53,0.02)" : "#fff" }}>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--navy)" }}>{label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--body-text)" }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>Description</label>
            <textarea value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} placeholder="What does this dataset contain?" rows={3} className="w-full text-[13px] px-4 py-2.5 rounded-xl border outline-none transition-colors focus:border-[var(--navy)] resize-none" style={{ borderColor: "var(--border-strong)" }} />
          </div>

          <div>
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: "var(--navy)" }}>File</label>
            {createForm.file ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--ghost-white)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
                <div className="flex-1">
                  <p className="text-[12px] font-medium" style={{ color: "var(--navy)" }}>{createForm.file.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--body-text)" }}>{formatSize(createForm.file.size)}</p>
                </div>
                <button onClick={() => setCreateForm((p) => ({ ...p, file: null }))} className="text-[10px] px-2 py-1 rounded-full hover:bg-gray-100" style={{ color: "var(--body-text)" }}>Remove</button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed cursor-pointer hover:bg-gray-50 transition-colors" style={{ borderColor: "var(--border-strong)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="1.5" className="opacity-40"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17,8 12,3 7,8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                <span className="text-[12px]" style={{ color: "var(--body-text)" }}>Click to upload CSV</span>
                <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCreateForm((p) => ({ ...p, file: f })); }} />
              </label>
            )}
          </div>
        </div>

        <div className="mt-8">
          <button onClick={handleCreate} disabled={!createForm.title || !createForm.file || saving} className="w-full py-3 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40" style={{ background: "var(--navy)" }}>
            {saving ? "Uploading..." : "Upload Dataset"}
          </button>
        </div>
      </div>
    );
  }

  // === DETAIL VIEW ===
  if (view === "detail" && selected) {
    const ps = processingColors[selected.processingStatus] || processingColors.pending;
    const columns: string[] = (() => { try { return JSON.parse(selected.columns); } catch { return []; } })();
    return (
      <div className="max-w-[700px] mx-auto px-8 py-8 h-full overflow-y-auto">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => setView("list")} className="w-8 h-8 rounded-lg flex items-center justify-center border hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6" /></svg>
          </button>
          <h1 className="text-xl font-bold" style={{ color: "var(--navy)" }}>{selected.title}</h1>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border rounded-xl p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--body-text)" }}>Status</p>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: selected.status === "enabled" ? "var(--teal)" : "var(--body-text)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: selected.status === "enabled" ? "var(--teal)" : "var(--body-text)" }} />
              {selected.status === "enabled" ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="border rounded-xl p-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--body-text)" }}>Processing</p>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ background: ps.bg, color: ps.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: ps.dot }} />
              {selected.processingStatus === "pending" ? "Pending" : selected.processingStatus === "successful" ? "Successful" : "Failed"}
            </span>
          </div>
        </div>

        {/* Details table */}
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[13px]">
            <tbody>
              {[
                { label: "Type", value: selected.type === "exclusion" ? "Exclusion List" : "Data" },
                { label: "File Name", value: selected.fileName },
                { label: "File Size", value: formatSize(selected.fileSize) },
                { label: "Rows", value: selected.rowCount > 0 ? selected.rowCount.toLocaleString() : "Processing..." },
                { label: "Columns", value: columns.length > 0 ? `${columns.length} columns` : "—" },
                { label: "Description", value: selected.description || "—" },
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

        {/* Column tags */}
        {columns.length > 0 && (
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--body-text)" }}>Columns</p>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((col: string) => (
                <span key={col} className="text-[11px] font-medium px-2.5 py-1 rounded-full" style={{ background: "var(--ghost-white)", color: "var(--navy)", border: "1px solid var(--border)" }}>{col}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // === LIST VIEW ===
  return (
    <div className="max-w-[1200px] mx-auto px-8 py-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "var(--navy)" }}>Datasets</h1>
        <button onClick={() => setView("create")} className="px-5 py-2.5 rounded-full text-[13px] font-medium text-white inline-flex items-center gap-2 transition-opacity hover:opacity-90" style={{ background: "var(--navy)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Upload Dataset
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[13px]" style={{ color: "var(--body-text)" }}>Loading...</div>
      ) : datasets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13px]" style={{ color: "var(--body-text)" }}>No datasets uploaded yet.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--ghost-white)" }}>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Title</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Type</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>File</th>
                <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Rows</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Processing</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {datasets.map((ds) => {
                const ps = processingColors[ds.processingStatus] || processingColors.pending;
                return (
                  <tr key={ds.id} className="border-t cursor-pointer hover:bg-gray-50/50 transition-colors" style={{ borderColor: "var(--border)" }} onClick={() => setView("detail", ds.id)}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium" style={{ color: "var(--navy)" }}>{ds.title}</p>
                      {ds.description && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--body-text)", maxWidth: 300 }}>{ds.description.substring(0, 50)}{ds.description.length > 50 ? "..." : ""}</p>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: ds.type === "exclusion" ? "rgba(229,83,75,0.06)" : "rgba(15,18,53,0.04)", color: ds.type === "exclusion" ? "var(--error-red)" : "var(--navy)" }}>
                        {ds.type === "exclusion" ? "Exclusion" : "Data"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p style={{ color: "var(--navy)" }}>{ds.fileName}</p>
                      <p className="text-[11px]" style={{ color: "var(--body-text)" }}>{formatSize(ds.fileSize)}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right font-medium" style={{ color: "var(--navy)" }}>
                      {ds.rowCount > 0 ? ds.rowCount.toLocaleString() : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: ps.bg, color: ps.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ps.dot }} />
                        {ds.processingStatus === "pending" ? "Pending" : ds.processingStatus === "successful" ? "Successful" : "Failed"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: ds.status === "enabled" ? "var(--teal)" : "var(--body-text)" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ds.status === "enabled" ? "var(--teal)" : "var(--body-text)" }} />
                        {ds.status === "enabled" ? "Enabled" : "Disabled"}
                      </span>
                    </td>
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

export default function DataPage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center"><p className="text-sm animate-pulse" style={{ color: "var(--body-text)" }}>Loading...</p></div>}>
      <DataPageInner />
    </Suspense>
  );
}
