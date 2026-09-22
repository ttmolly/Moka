import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Studio" },
  { to: "/playground", label: "Playground" },
  { to: "/snake", label: "Snake" },
  { to: "/convert", label: "Convert" },
  { to: "/benchmarks", label: "Benchmarks" },
  { to: "/fidelity", label: "Fidelity" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">Moka</span>
            <span className="text-xs uppercase tracking-[0.18em] text-muted">Linux · ORT</span>
          </Link>
          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {LINKS.map((link) => {
              const active = pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "shrink-0 rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                    active ? "bg-surface text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}
