"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "./AppProvider";

const navItems = [
  { href: "/data", label: "Datasets", icon: "database" },
  { href: "/campaign", label: "Campaigns", icon: "campaign" },
  { href: "/templates", label: "Templates", icon: "document-text" },
];

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "var(--navy)" : "var(--body-text)";
  const icons: Record<string, React.ReactNode> = {
    database: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    campaign: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    "document-text": (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" />
      </svg>
    ),
  };
  return <>{icons[name]}</>;
}

export function Sidebar() {
  const pathname = usePathname();
  const { issuers, selectedIssuer, setSelectedIssuer, issuersLoading } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = selectedIssuer
    ? selectedIssuer.name.split(/[\s]+/).map((w) => w[0]).join("").substring(0, 2).toUpperCase()
    : "—";

  // Auto-collapse on campaign builder pages
  const isCampaignBuilder = pathname.startsWith("/campaign/new");
  const [collapsed, setCollapsed] = useState(isCampaignBuilder);

  return (
    <aside className={`${collapsed ? "w-[52px]" : "w-[200px]"} border-r flex flex-col flex-shrink-0 bg-white transition-all duration-200 relative`} style={{ borderColor: "#e5e7eb" }}>
      {/* Issuer Selector */}
      <div className={`${collapsed ? "px-1.5" : "px-3"} pt-4 pb-2`} ref={dropdownRef}>
        <div className="relative">
          <button
            onClick={() => collapsed ? setCollapsed(false) : setDropdownOpen(!dropdownOpen)}
            className={`w-full flex items-center ${collapsed ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2.5"} rounded-lg text-left transition-colors hover:bg-gray-50`}
            style={{ border: collapsed ? "none" : "1px solid #e5e7eb" }}
          >
            {issuersLoading ? (
              <div className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse flex-shrink-0" />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ background: "var(--navy)" }}
              >
                {initials}
              </div>
            )}
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  {issuersLoading ? (
                    <div className="h-3.5 w-24 bg-gray-100 rounded animate-pulse" />
                  ) : (
                    <p className="text-[12px] font-semibold truncate" style={{ color: "var(--navy)" }}>
                      {selectedIssuer?.name || "Select Issuer"}
                    </p>
                  )}
                </div>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--body-text)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  className={`flex-shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6,9 12,15 18,9" />
                </svg>
              </>
            )}
          </button>

          {dropdownOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-lg overflow-hidden z-50"
              style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
            >
              {issuers.map((issuer) => {
                const isSelected = selectedIssuer?.id === issuer.id;
                const ini = issuer.name.split(/[\s]+/).map((w) => w[0]).join("").substring(0, 2).toUpperCase();
                return (
                  <button
                    key={issuer.id}
                    onClick={() => {
                      setSelectedIssuer(issuer);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                    style={{ background: isSelected ? "var(--ghost-white)" : undefined }}
                  >
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                      style={{ background: isSelected ? "var(--navy)" : "var(--body-text)" }}
                    >
                      {ini}
                    </div>
                    <span className="text-[12px] font-medium truncate" style={{ color: isSelected ? "var(--navy)" : "var(--body-text)" }}>
                      {issuer.name}
                    </span>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2.5" className="ml-auto flex-shrink-0">
                        <polyline points="20,6 9,17 4,12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Nav Links */}
      <nav className={`flex-1 py-2 ${collapsed ? "px-1.5" : "px-3"} overflow-y-auto`}>
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center ${collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-lg text-[13px] mb-0.5 transition-all ${
                active ? "font-medium" : "hover:bg-gray-50"
              }`}
              style={{
                color: active ? "var(--navy)" : "var(--body-text)",
                background: active ? "var(--ghost-white)" : undefined,
              }}
            >
              <NavIcon name={item.icon} active={active} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t flex justify-center py-2" style={{ borderColor: "#e5e7eb" }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" className={`transition-transform ${collapsed ? "rotate-180" : ""}`}>
            <polyline points="11,17 6,12 11,7" /><polyline points="18,17 13,12 18,7" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
