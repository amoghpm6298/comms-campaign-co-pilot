"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/AppProvider";

interface Campaign {
  id: string;
  name: string;
  goal: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { strategies: number };
}

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: "#F0F4FF", text: "#4A6FA5" },
  live: { bg: "#E8F5E9", text: "#2E7D32" },
  completed: { bg: "#F5F5F5", text: "#757575" },
  paused: { bg: "#FFF3E0", text: "#E65100" },
};

export default function CampaignsPage() {
  const { selectedIssuer } = useApp();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!selectedIssuer) return;
    setLoading(true);
    fetch(`/api/campaigns?issuerId=${selectedIssuer.id}&page=${page}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data.campaigns || []);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages);
          setTotal(data.pagination.total);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedIssuer, page]);

  // Reset to page 1 when issuer changes
  useEffect(() => { setPage(1); }, [selectedIssuer]);

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-8 h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "var(--navy)" }}>Campaigns</h1>
          <Link
            href="/campaign/new"
            className="px-5 py-2.5 rounded-full text-[13px] font-medium text-white inline-flex items-center gap-2 transition-opacity hover:opacity-90"
            style={{ background: "var(--navy)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Campaign
          </Link>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-[13px]" style={{ color: "var(--body-text)" }}>Loading...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[13px]" style={{ color: "var(--body-text)" }}>No campaigns yet.</p>
          </div>
        ) : (
          <>
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: "var(--ghost-white)" }}>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>ID</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Name</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Goal</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Status</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Strategies</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--body-text)" }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const colors = statusColors[c.status] || statusColors.draft;
                  return (
                    <tr
                      key={c.id}
                      className="border-t cursor-pointer hover:bg-gray-50/50 transition-colors"
                      style={{ borderColor: "var(--border)" }}
                      onClick={() => {
                        router.push(`/campaign/new?id=${c.id}`);
                      }}
                    >
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer hover:bg-gray-100 transition-colors"
                          style={{ color: copiedId === c.id ? "var(--teal)" : "var(--body-text)", background: "var(--ghost-white)" }}
                          onClick={() => { navigator.clipboard.writeText(c.id); setCopiedId(c.id); setTimeout(() => setCopiedId(null), 1500); }}
                          title={c.id}
                        >
                          {copiedId === c.id ? "Copied!" : c.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-medium" style={{ color: "var(--navy)" }}>
                          {c.name}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] max-w-[300px] truncate" style={{ color: "var(--body-text)" }}>
                        {c.goal || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
                          style={{ background: colors.bg, color: colors.text }}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[13px]" style={{ color: "var(--body-text)" }}>
                        {c._count.strategies}
                      </td>
                      <td className="px-5 py-3.5 text-[13px]" style={{ color: "var(--body-text)" }}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[12px]" style={{ color: "var(--body-text)" }}>
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-30"
                  style={{ borderColor: "var(--border)", color: "var(--body-text)" }}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-lg text-[12px] font-medium transition-colors"
                    style={{
                      background: page === p ? "var(--navy)" : "transparent",
                      color: page === p ? "white" : "var(--body-text)",
                      border: page === p ? "none" : "1px solid var(--border)",
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors disabled:opacity-30"
                  style={{ borderColor: "var(--border)", color: "var(--body-text)" }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
          </>
        )}
    </div>
  );
}
