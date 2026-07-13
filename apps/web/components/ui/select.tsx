"use client";

import { cn } from "@/lib/cn";
import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  type ReactNode,
  type SelectHTMLAttributes,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type Opt = { value: string; label: string; disabled?: boolean };

/** Join an <option>'s children into a label, handling `{a} {b}` array children
 * (which would otherwise stringify with stray commas, e.g. "30, min"). */
function optionLabel(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(optionLabel).join("");
  return children == null || typeof children === "boolean" ? "" : String(children);
}

/** Flatten `<option>` children (including mapped arrays) into a plain list. */
function parseOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== "option") return;
    const props = child.props as {
      value?: string | number;
      children?: ReactNode;
      disabled?: boolean;
    };
    out.push({
      value: String(props.value ?? ""),
      label: optionLabel(props.children),
      disabled: props.disabled,
    });
  });
  return out;
}

/**
 * Design-system select — a fully themed listbox (not the OS-native dropdown),
 * so the open menu matches the app instead of rendering system chrome. Keeps the
 * native `<select>` API: pass `<option>` children, read `e.target.value` in
 * `onChange`. Long lists (>8 options, e.g. timezones) get a filter box.
 */
export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  required,
  "aria-label": ariaLabel,
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = useMemo(() => parseOptions(children), [children]);
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<string>(String(defaultValue ?? ""));
  const current = controlled ? String(value ?? "") : internal;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const showFilter = options.length > 8;

  const selected = options.find((o) => o.value === current) ?? null;
  const placeholder = options.find((o) => o.disabled && o.value === "");
  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function commit(v: string) {
    if (!controlled) setInternal(v);
    // Synthesize the minimal shape call sites read (`e.target.value`).
    onChange?.({
      target: { value: v },
      currentTarget: { value: v },
    } as unknown as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
    setQuery("");
  }

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // On open, focus the filter (long lists) and highlight the current option.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-runs only when `open` toggles
  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((o) => o.value === current);
    setActive(idx >= 0 ? idx : 0);
    if (showFilter) requestAnimationFrame(() => filterRef.current?.focus());
    else requestAnimationFrame(() => listRef.current?.focus());
  }, [open]);

  function move(delta: number) {
    setActive((a) => {
      let next = a;
      for (let i = 0; i < filtered.length; i++) {
        next = (next + delta + filtered.length) % filtered.length;
        if (!filtered[next]?.disabled) break;
      }
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[active];
      if (opt && !opt.disabled) commit(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] pl-3 pr-3 text-left text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        <span
          className={cn(
            "truncate",
            !selected || selected === placeholder ? "text-[var(--color-faint)]" : "",
          )}
        >
          {selected ? selected.label : (placeholder?.label ?? "")}
        </span>
        <ChevronDown
          size={15}
          className={cn(
            "shrink-0 text-[var(--color-faint)] transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>

      {open ? (
        <div className="animate-dialog-in absolute z-50 mt-1.5 w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)]">
          {showFilter ? (
            <div className="border-b border-[var(--color-border)] p-2">
              <input
                ref={filterRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search…"
                className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)]"
              />
            </div>
          ) : null}
          {/* biome-ignore lint/a11y/useSemanticElements: themed listbox replacing the native select */}
          <div
            role="listbox"
            ref={listRef}
            id={listId}
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            className="max-h-64 overflow-y-auto p-1 focus-visible:outline-none"
          >
            {filtered.length === 0 ? (
              <p className="px-2.5 py-4 text-center text-sm text-[var(--color-faint)]">
                No matches
              </p>
            ) : (
              filtered.map((o, i) => {
                const isSel = o.value === current;
                const isActive = i === active;
                return (
                  // biome-ignore lint/a11y/useSemanticElements: option row inside a custom listbox
                  <button
                    role="option"
                    key={o.value || `opt-${i}`}
                    type="button"
                    aria-selected={isSel}
                    disabled={o.disabled}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => !o.disabled && commit(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:text-[var(--color-faint)]",
                      isActive && !o.disabled ? "bg-[var(--color-surface-2)]" : "",
                      isSel ? "font-medium text-[var(--color-accent)]" : "text-[var(--color-text)]",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSel ? <Check size={15} className="shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {/* Mirror value into a hidden native control so real <form> submits still
          carry it (most call sites are JS-controlled, but this keeps parity). */}
      {name ? <input type="hidden" name={name} value={current} required={required} /> : null}
    </div>
  );
}
