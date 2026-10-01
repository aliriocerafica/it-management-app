"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type LaptopStatus, type OwnershipEntry } from "@/lib/laptops";

// One editable row of an asset's ownership history. Every field is a string
// so the inputs stay controlled; `key` keeps React rows stable while editing.
export type HistoryDraft = {
  key: string;
  handler: string;
  department: string;
  from: string;
  to: string;
  note: string;
};

// Row keys only need to be unique on this page. crypto.randomUUID() is
// unavailable over plain HTTP (e.g. a LAN IP), so use a counter.
let nextKey = 0;
function newKey() {
  nextKey += 1;
  return `history-row-${nextKey}`;
}

export function toDrafts(history: OwnershipEntry[]): HistoryDraft[] {
  return history.map((entry) => ({
    key: newKey(),
    handler: entry.handler ?? "",
    department: entry.department ?? "",
    from: entry.from,
    to: entry.to ?? "",
    note: entry.note ?? "",
  }));
}

// Validates the rows and turns them back into history, oldest first.
export function fromDrafts(
  drafts: HistoryDraft[],
): { history: OwnershipEntry[] } | { error: string } {
  if (drafts.length === 0) {
    return { error: "History needs at least one entry." };
  }
  const history: OwnershipEntry[] = [];
  for (const [index, draft] of drafts.entries()) {
    const row = `History row ${index + 1}`;
    if (!draft.from) return { error: `${row} needs a start date.` };
    if (draft.to && draft.to < draft.from) {
      return { error: `${row} ends before it starts.` };
    }
    const handler = draft.handler.trim();
    history.push({
      handler: handler || null,
      department: (handler && draft.department.trim()) || undefined,
      from: draft.from,
      to: draft.to || null,
      note: draft.note.trim() || undefined,
    });
  }
  // Same start date: the current (open) row goes last.
  history.sort(
    (a, b) =>
      a.from.localeCompare(b.from) ||
      Number(a.to === null) - Number(b.to === null),
  );

  const open = history.filter((entry) => entry.to === null);
  if (open.length > 1) {
    return {
      error:
        "Only one history row can be current (leave “To” empty on one row).",
    };
  }
  if (open.length === 1 && history.at(-1)?.to !== null) {
    return {
      error: "The current row (empty “To”) must be the most recent one.",
    };
  }
  return { history };
}

// Who holds the asset now, and the status that matches, after a manual
// history edit. Repair and retirement are left as they are.
export function currentHolder(
  history: OwnershipEntry[],
  status: LaptopStatus,
): { handler: string | null; department: string | null; status: LaptopStatus } {
  const current = history.at(-1);
  const handler = current?.to === null ? current.handler : null;
  const department = handler ? (current?.department ?? null) : null;
  let next = status;
  if (handler && status === "Vacant") next = "In use";
  if (!handler && status === "In use") next = "Vacant";
  return { handler, department, status: next };
}

const headClass =
  "hidden text-[11px] font-medium text-muted-foreground lg:block";

export function HistoryEditor({
  value,
  onChange,
  handlerOptions,
}: {
  value: HistoryDraft[];
  onChange: (value: HistoryDraft[]) => void;
  // Names already used elsewhere, offered as suggestions.
  handlerOptions: string[];
}) {
  function update(key: string, patch: Partial<HistoryDraft>) {
    onChange(
      value.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addRow() {
    const now = new Date();
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
    // Close the current stint so the new row can become the current one.
    const closed = value.map((row) =>
      row.to ? row : { ...row, to: row.from > today ? row.from : today },
    );
    onChange([
      ...closed,
      {
        key: newKey(),
        handler: "",
        department: "",
        from: today,
        to: "",
        note: "",
      },
    ]);
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Ownership history
      </legend>
      <p className="text-xs text-muted-foreground">
        Leave Handler empty for time the asset was with IT. Leave To empty on
        the current row. The current row decides who holds the asset now.
      </p>

      <datalist id="history-handler-options">
        {handlerOptions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="flex flex-col gap-3 lg:gap-2">
        <div className="hidden gap-2 lg:grid lg:grid-cols-[1.3fr_1fr_9rem_9rem_1.5fr_2rem]">
          <span className={headClass}>Handler</span>
          <span className={headClass}>Department</span>
          <span className={headClass}>From</span>
          <span className={headClass}>To</span>
          <span className={headClass}>Note</span>
        </div>
        {value.map((row, index) => (
          <div
            key={row.key}
            className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 lg:grid-cols-[1.3fr_1fr_9rem_9rem_1.5fr_2rem] lg:rounded-none lg:border-0 lg:p-0"
          >
            <Input
              aria-label={`Row ${index + 1} handler`}
              list="history-handler-options"
              value={row.handler}
              placeholder="With IT"
              onChange={(event) =>
                update(row.key, { handler: event.target.value })
              }
            />
            <Input
              aria-label={`Row ${index + 1} department`}
              value={row.department}
              placeholder="Department"
              disabled={!row.handler.trim()}
              onChange={(event) =>
                update(row.key, { department: event.target.value })
              }
            />
            <Input
              aria-label={`Row ${index + 1} from`}
              type="date"
              value={row.from}
              required
              onChange={(event) =>
                update(row.key, { from: event.target.value })
              }
            />
            <Input
              aria-label={`Row ${index + 1} to`}
              type="date"
              value={row.to}
              min={row.from || undefined}
              onChange={(event) => update(row.key, { to: event.target.value })}
            />
            <Input
              aria-label={`Row ${index + 1} note`}
              value={row.note}
              placeholder="Note"
              className="col-span-2 lg:col-span-1"
              onChange={(event) =>
                update(row.key, { note: event.target.value })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove row ${index + 1}`}
              className="col-span-2 w-full text-muted-foreground hover:text-destructive lg:col-span-1 lg:w-8"
              disabled={value.length === 1}
              onClick={() =>
                onChange(value.filter((other) => other.key !== row.key))
              }
            >
              <Trash2Icon />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={addRow}
      >
        <PlusIcon />
        Add history row
      </Button>
    </fieldset>
  );
}
