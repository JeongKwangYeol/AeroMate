import React from "react";
import AppHeader from "./AppHeader";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col font-sans">
      <AppHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-6 lg:p-8">
        {children}
      </main>
      <footer className="py-6 text-center text-muted-foreground border-t border-border mt-auto">
        <p className="text-sm font-medium">AeroMate</p>
        <p className="text-xs mt-1">For reference only. Always verify with official documentation.</p>
      </footer>
    </div>
  );
}
