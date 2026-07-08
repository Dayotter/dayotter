"use client";

import { cn } from "@/lib/cn";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme((localStorage.getItem("theme") as Theme) ?? "light");
  }, []);

  function select(next: Theme) {
    setTheme(next);
    localStorage.setItem("theme", next);
    apply(next);
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          onClick={() => select(value)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
            mounted && theme === value
              ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
              : "text-[var(--color-faint)] hover:text-[var(--color-text)]",
          )}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
