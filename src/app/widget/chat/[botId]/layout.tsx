import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SaoMai AI Widget",
  robots: { index: false, follow: false },
};

/**
 * Minimal layout for widget pages — just passes children through.
 * The root LayoutInner component detects /widget routes and renders
 * without sidebar, padding, or any chrome.
 */
export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
