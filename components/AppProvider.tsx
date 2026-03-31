"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface Issuer {
  id: string;
  name: string;
  slug: string;
}

interface AppContextType {
  issuers: Issuer[];
  selectedIssuer: Issuer | null;
  setSelectedIssuer: (issuer: Issuer) => void;
  issuersLoading: boolean;
}

const AppContext = createContext<AppContextType>({
  issuers: [],
  selectedIssuer: null,
  setSelectedIssuer: () => {},
  issuersLoading: true,
});

export function useApp() {
  return useContext(AppContext);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [selectedIssuer, setSelectedIssuerState] = useState<Issuer | null>(null);
  const [issuersLoading, setIssuersLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch("/api/issuers")
      .then((r) => r.json())
      .then((data) => {
        const list: Issuer[] = data.issuers || [];
        setIssuers(list);
        const saved = localStorage.getItem("selectedIssuerId");
        const match = list.find((i) => i.id === saved);
        setSelectedIssuerState(match || list[0] || null);
      })
      .catch(() => {})
      .finally(() => setIssuersLoading(false));
  }, []);

  const setSelectedIssuer = useCallback((issuer: Issuer) => {
    setSelectedIssuerState(issuer);
    localStorage.setItem("selectedIssuerId", issuer.id);
  }, []);

  if (!mounted) {
    return <div className="h-full" />;
  }

  return (
    <AppContext.Provider value={{ issuers, selectedIssuer, setSelectedIssuer, issuersLoading }}>
      {children}
    </AppContext.Provider>
  );
}
