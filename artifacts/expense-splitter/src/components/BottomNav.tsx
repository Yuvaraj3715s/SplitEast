import React from "react";
import { Link, useLocation } from "wouter";
import { Home, PieChart, Settings as SettingsIcon } from "lucide-react";
import { motion } from "framer-motion";
import { vibrate } from "@/lib/haptics";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" || p.startsWith("/events/") },
  { href: "/statistics", label: "Statistics", icon: PieChart, match: (p: string) => p === "/statistics" },
  { href: "/settings", label: "Settings", icon: SettingsIcon, match: (p: string) => p === "/settings" },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      data-testid="nav-bottom"
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[max(env(safe-area-inset-bottom),1rem)] px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-1 bg-white/70 dark:bg-black/50 backdrop-blur-2xl border border-white/40 dark:border-white/10 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)] rounded-full p-2">
        {NAV_ITEMS.map((item) => {
          const active = item.match(location);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`nav-link-${item.label.toLowerCase()}`}
              onClick={() => vibrate(8)}
              className="relative flex flex-col items-center justify-center gap-0.5 px-5 sm:px-6 py-2.5 rounded-full transition-colors"
            >
              {active && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute inset-0 bg-gradient-primary rounded-full"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`w-5 h-5 relative z-10 transition-colors ${active ? "text-white" : "text-muted-foreground"}`}
              />
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider relative z-10 transition-colors ${active ? "text-white" : "text-muted-foreground"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
