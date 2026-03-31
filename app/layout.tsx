import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { AppProvider } from "@/components/AppProvider";

export const metadata: Metadata = {
  title: "Campaign Co-pilot | Hyperface",
  description: "AI-powered campaign strategy and execution for banking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" style={{ colorScheme: "light" }}>
      <body className="h-full flex flex-col bg-white" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif" }}>
        <AppProvider>
          <Topbar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
