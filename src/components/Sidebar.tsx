"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  MessageSquareText,
  BookOpen,
  Star,
  Code2,
} from "lucide-react";

const navItems = [
  { href: "/chat", label: "Phân tích", icon: MessageSquareText },
  { href: "/knowledge", label: "Tri thức", icon: BookOpen },
  { href: "/bots", label: "Widget", icon: Code2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full h-[64px] md:w-[64px] md:h-full bg-white rounded-2xl border border-stone-200/80 shadow-sm flex flex-row md:flex-col items-center justify-between md:justify-start px-2 py-0 md:px-0 md:py-3 md:gap-1">
      {/* Logo */}
      <Link
        href="/chat"
        className="hidden md:flex w-10 h-10 rounded-xl overflow-hidden items-center justify-center mb-3 shadow-sm hover:shadow-md transition-shadow"
      >
        <Image
          src="/saomai-logo.jpg"
          alt="SaoMai AI"
          width={40}
          height={40}
          className="w-10 h-10 object-cover"
        />
      </Link>

      {/* Nav Items */}
      <nav className="flex flex-row md:flex-col items-center gap-1 w-full justify-around md:justify-center md:flex-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                w-14 h-11 md:w-11 md:h-11 rounded-xl flex flex-col items-center justify-center gap-1 md:gap-0.5
                transition-all duration-200 relative
                ${
                  isActive
                    ? "bg-vn-red/10 text-vn-red"
                    : "text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                }
              `}
            >
              <Icon
                className="w-5 h-5 md:w-[18px] md:h-[18px]"
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span className="text-[10px] md:text-[9px] font-semibold leading-none tracking-tight">
                {item.label}
              </span>
              {isActive && (
                <>
                  <span className="hidden md:block absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-vn-red rounded-r-full" />
                  <span className="md:hidden absolute bottom-0 left-3 right-3 h-[3px] bg-vn-red rounded-t-full" />
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom star */}
      <div className="hidden md:block mt-auto pt-2">
        <Star className="w-3.5 h-3.5 text-vn-yellow fill-vn-yellow" />
      </div>
    </aside>
  );
}
