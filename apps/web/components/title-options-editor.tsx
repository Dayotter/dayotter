"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  insertField,
  joinOptions,
  renderBookingTitle,
  splitOptions,
  titleSegments,
  titleVariables,
  unknownTitlePlaceholders,
} from "@/lib/booking/booking-title";
import { Plus } from "lucide-react";
import { useRef, useState } from "react";

type Question = { id: string; label: string; required?: boolean };

const PILL_ON = "h-8 rounded-full border border-[var(--color-text)] px-3 text-xs font-medium";
const PILL_OFF =
  "h-8 rounded-full border border-[var(--color-border)] px-3 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]";

/** Two-way pill switch, same look as the brand-color "Default" pill in the profile form. */
export function Pills<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={value === o.value ? PILL_ON : PILL_OFF}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The calendar title as a list of options: the first whose fields all have an
 * answer wins, then the next, then `fallback`. Saves the same `a || b` string
 * the text field always used, so "Edit as text" and the API see no difference.
 * `questions` undefined = account default (no type's questions to check against).
 */
export function TitleOptionsEditor({
  value,
  onChange,
  questions,
  fallback,
  sample,
}: {
  value: string;
  onChange: (v: string) => void;
  questions?: Question[];
  fallback: string;
  sample: { host: string; typeTitle: string; durationMinutes: number };
}) {
  // Local list so a just-added empty option survives until it is filled in.
  const [options, setOptions] = useState(() => {
    const o = splitOptions(value);
    return o.length ? o : [""];
  });
  const [asText, setAsText] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [picker, setPicker] = useState<number | null>(null);
  const caret = useRef(0);

  const update = (next: string[]) => {
    setOptions(next);
    onChange(joinOptions(next));
  };
  const setOption = (i: number, text: string) =>
    update(options.map((o, j) => (j === i ? text : o)));

  const insert = (key: string) => {
    if (picker === null) return;
    const current = options[picker] ?? "";
    const r = insertField(current, editing === picker ? caret.current : current.length, key);
    setOption(picker, r.text);
    caret.current = r.caret;
    setEditing(picker);
    setPicker(null);
  };

  const leaveText = () => {
    const o = splitOptions(value);
    setOptions(o.length ? o : [""]);
    setAsText(false);
  };

  return (
    <div className="space-y-3">
      {asText ? (
        <div>
          <Input
            aria-label="Calendar event title as text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={300}
            placeholder="Ana <> {name} | {Company} || Ana <> {name}"
          />
          <p className="mt-1 text-xs text-[var(--color-faint)]">
            Separate options with ||: the first one whose fields are all answered is used.
          </p>
          <button
            type="button"
            onClick={leaveText}
            className="mt-2 text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            Edit as options
          </button>
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {options.map((option, i) => (
              <li key={i}>
                {i > 0 ? (
                  <p className="mb-2 text-center text-xs text-[var(--color-faint)]">
                    if an answer is missing
                  </p>
                ) : null}
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--color-muted)]">
                      Option {i + 1}
                    </span>
                    {options.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          update(options.filter((_, j) => j !== i));
                        }}
                        className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {editing === i || !option ? (
                    <Input
                      aria-label={`Option ${i + 1}`}
                      autoFocus={editing === i}
                      value={option}
                      maxLength={300}
                      placeholder="e.g. {host} <> {name}"
                      onChange={(e) => {
                        caret.current = e.target.selectionStart ?? e.target.value.length;
                        setOption(i, e.target.value);
                      }}
                      onSelect={(e) => {
                        caret.current = e.currentTarget.selectionStart ?? 0;
                      }}
                      onFocus={() => setEditing(i)}
                      onBlur={() =>
                        setEditing((cur) => (cur === i && picker === null ? null : cur))
                      }
                    />
                  ) : (
                    <button
                      type="button"
                      aria-label={`Edit option ${i + 1}`}
                      onClick={() => {
                        caret.current = option.length;
                        setEditing(i);
                      }}
                      className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-[var(--radius-sm)] text-left text-sm"
                    >
                      {titleSegments(option).map((s, k) =>
                        "field" in s ? (
                          <span
                            key={k}
                            className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-xs font-medium"
                          >
                            {s.field}
                          </span>
                        ) : (
                          <span key={k} className="whitespace-pre">
                            {s.text}
                          </span>
                        ),
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    // Keep the input's caret: mousedown would blur it first.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setPicker(i)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline"
                  >
                    <Plus size={13} /> Variable
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-center text-xs text-[var(--color-faint)]">if an answer is missing</p>
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-3 text-sm text-[var(--color-muted)]">
            <span className="text-xs font-medium">Booking type title</span>
            <p className="mt-1 text-[var(--color-text)]">{fallback || "Untitled"}</p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                update([...options, ""]);
                setEditing(options.length);
              }}
            >
              <Plus size={15} /> Add option
            </Button>
            <button
              type="button"
              onClick={() => setAsText(true)}
              className="text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              Edit as text
            </button>
          </div>
        </>
      )}

      <TitlePreview value={value} fallback={fallback} questions={questions} sample={sample} />

      <VariablePicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onPick={insert}
        questions={questions ?? []}
      />
    </div>
  );
}

function VariablePicker({
  open,
  onClose,
  onPick,
  questions,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (key: string) => void;
  questions: Question[];
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const groups = titleVariables(questions)
    .map((g) => ({ ...g, fields: g.fields.filter((f) => f.key.toLowerCase().includes(q)) }))
    .filter((g) => g.fields.length);
  return (
    <Dialog
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title="Insert variable"
    >
      <Input
        aria-label="Search variables"
        placeholder="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-3 max-h-[50vh] space-y-4 overflow-y-auto">
        {groups.map((g) => (
          <section key={g.title}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
              {g.title}
            </p>
            <ul>
              {g.fields.map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      onPick(f.key);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2 py-2 text-left text-sm hover:bg-[var(--color-surface-2)]"
                  >
                    <span>{`{${f.key}}`}</span>
                    {f.hint ? (
                      <span className="text-xs text-[var(--color-faint)]">{f.hint}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {groups.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No variable matches.</p>
        ) : null}
      </div>
    </Dialog>
  );
}

const PREVIEW_MODES = [
  { value: "with", label: "With answers" },
  { value: "without", label: "Without answers" },
] as const;

/** The calendar event as it would read, with every question answered and with none. */
function TitlePreview({
  value,
  fallback,
  questions,
  sample,
}: {
  value: string;
  fallback: string;
  questions?: Question[];
  sample: { host: string; typeTitle: string; durationMinutes: number };
}) {
  const [mode, setMode] = useState<"with" | "without">("with");
  const named = questions?.filter((q) => q.label.trim());
  const unknown = named ? unknownTitlePlaceholders(value, named) : [];
  if (unknown.length > 0) {
    return (
      <p className="text-xs text-[var(--color-danger)]">
        No booking question named: {unknown.join(", ")}
      </p>
    );
  }
  // Account default: questions vary per type, so treat any other field as a question.
  const asked = named ?? unknownTitlePlaceholders(value, []).map((k) => ({ id: k, label: k }));
  const title = renderBookingTitle(value, fallback || "Untitled", {
    name: "Maria",
    email: "maria@example.com",
    questions: asked,
    responses: mode === "with" ? Object.fromEntries(asked.map((q) => [q.id, q.label])) : {},
    host: sample.host,
    typeTitle: sample.typeTitle,
    durationMinutes: sample.durationMinutes,
  });
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
          Preview
        </span>
        <Pills label="Preview answers" value={mode} options={PREVIEW_MODES} onChange={setMode} />
      </div>
      <div
        data-testid="title-preview"
        className="rounded-[var(--radius-md)] border-l-4 border-[var(--color-accent)] bg-[var(--color-surface-2)] px-3 py-2"
      >
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--color-muted)]">
          {sample.durationMinutes} min · {sample.host}
        </p>
      </div>
    </div>
  );
}
