"use client";

import Image from "next/image";

export function Topbar() {
  return (
    <header className="h-14 border-b flex items-center px-6 flex-shrink-0" style={{ borderColor: "var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center gap-3">
        <Image src="/HF.png" alt="Hyperface" width={100} height={22} className="h-[22px] w-auto" />
        <div className="w-px h-5 mx-3" style={{ background: "var(--border)" }} />
        <span className="text-sm font-semibold tracking-[-0.01em]" style={{ color: "var(--navy)" }}>Campaign Co-pilot</span>
      </div>
    </header>
  );
}
