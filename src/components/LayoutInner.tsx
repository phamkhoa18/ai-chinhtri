"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/Sidebar";

/**
 * Client layout component that conditionally renders sidebar + chrome.
 * Widget routes (/widget/*) get a clean, full-screen layout with no sidebar.
 * All other routes get the standard app layout with sidebar navigation.
 */
export function LayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWidget = pathname.startsWith("/widget");

  // Override body styles for widget routes
  useEffect(() => {
    if (isWidget) {
      document.body.style.backgroundColor = "white";
      document.body.style.padding = "0";
      document.body.style.margin = "0";
    } else {
      document.body.style.backgroundColor = "";
      document.body.style.padding = "";
      document.body.style.margin = "";
    }
  }, [isWidget]);

  // Widget routes: full-screen, no sidebar, no padding
  if (isWidget) {
    return (
      <div className="h-full w-full bg-white overflow-hidden">
        {children}
      </div>
    );
  }

  // App routes: sidebar + chrome
  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      <TooltipProvider>
        {/* Main content - Order 1 on mobile, 2 on desktop */}
        <div className="flex-1 min-w-0 p-2 md:p-2 md:pl-0 order-1 md:order-2 h-full overflow-hidden">
          <main className="h-full w-full bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden relative z-10">
            {children}
          </main>
        </div>
        {/* Sidebar wrapper - Order 2 on mobile, 1 on desktop */}
        <div className="shrink-0 p-2 pt-0 md:p-2 md:pr-0 order-2 md:order-1 z-20 pb-safe">
          <Sidebar />
        </div>
      </TooltipProvider>
    </div>
  );
}
