"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BoxIcon,
  BuildingIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleCheckIcon,
  CircleDotIcon,
  DownloadIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  FilePlusIcon,
  FileTextIcon,
  HistoryIcon,
  Loader2Icon,
  MailIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  Trash2Icon,
  UserIcon,
  XIcon,
} from "lucide-react";

import {
  SendFormDialog,
  VersionsDialog,
  formatSentAt,
} from "@/components/accountability-dialogs";
import { AccountabilityFormPrompt } from "@/components/accountability-form-prompt";
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { ErrorToast } from "@/components/error-toast";
import { UndoToast } from "@/components/undo-toast";
import {
  ColumnHeader,
  FilterMenu,
  cellClass,
  rowsPerPageOptions,
} from "@/components/laptop-inventory-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  formPdfUrl,
  formStateStyles,
  formStates,
  type AccountabilityRow,
  type FormBackup,
  type FormState,
  type FormVersion,
} from "@/lib/accountability-forms";
import { errorMessage } from "@/lib/inventory-api";
import { initials } from "@/lib/laptops";
import { cn } from "@/lib/utils";

type Tab = "All" | FormState;
const tabs: Tab[] = ["All", ...formStates];

const tabHints: Record<Tab, string> = {
  All: "Everyone with assigned equipment",
  "Up to date": "Latest form matches what they hold now",
  "Needs update": "Equipment changed since the latest form",
  "No form": "No form generated yet",
};

function exportCsv(rows: AccountabilityRow[]) {
  const header = [
    "Employee",
    "Employee ID",
    "Department",
    "Email",
    "Assets",
    "Items",
    "Form status",
    "Latest version",
    "Generated",
    "Versions",
    "Last sent to",
    "Last sent",
  ];
  const lines = rows.map((r) => {
    const lastSend = r.latest?.sends[0];
    return [
      r.holderName,
      r.employeeId ?? "",
      r.department ?? "",
      r.email ?? "",
      r.assets.map((a) => `${a.count} ${a.label}`).join("; "),
      r.itemCount,
      r.state,
      r.latest ? `v${r.latest.version}` : "",
      r.latest?.generatedOn ?? "",
      r.versionCount,
      lastSend?.toEmail ?? "",
      lastSend ? lastSend.sentAt.slice(0, 10) : "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",");
  });
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "accountability-forms.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function generate(
  holders: string[],
  names: { hrName: string; itOfficerName: string },
  force: boolean,
) {
  const response = await fetch("/api/accountability-forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holders, ...names, force }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(
      body.error ?? `Couldn't generate the forms (error ${response.status}).`,
    );
  }
  return response.json() as Promise<AccountabilityRow[]>;
}

export function AccountabilityTable({
  initialData,
}: {
  initialData: AccountabilityRow[];
}) {
  const [rows, setRows] = useState(initialData);
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [page, setPage] = useState(1);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Who the HR / IT names prompt is generating for.
  const [generating, setGenerating] = useState<{
    holders: string[];
    force: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<{
    form: FormVersion;
    email: string | null;
  } | null>(null);
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versionsKey, setVersionsKey] = useState(0);
  // Holders whose forms are about to be deleted (all versions).
  const [pendingDelete, setPendingDelete] = useState<string[]>([]);
  // Rows with a generate / delete / undo in flight: spinner + locked actions.
  const [working, setWorking] = useState<Set<string>>(new Set());
  // The last change, and how to reverse it, for the Undo toast.
  const [undo, setUndo] = useState<{
    message: string;
    run: () => void;
  } | null>(null);

  async function track<T>(holders: string[], task: () => Promise<T>) {
    setWorking((prev) => new Set([...prev, ...holders]));
    try {
      return await task();
    } finally {
      setWorking((prev) => {
        const next = new Set(prev);
        for (const holder of holders) next.delete(holder);
        return next;
      });
    }
  }

  // Undo for deletes: puts the deleted versions back as they were.
  function restore(backup: FormBackup[]) {
    const holders = [...new Set(backup.map((form) => form.holderName))];
    void track(holders, async () => {
      try {
        const response = await fetch("/api/accountability-forms/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forms: backup }),
        });
        if (!response.ok) throw new Error("Couldn't restore the forms.");
        setRows((await response.json()) as AccountabilityRow[]);
        setVersionsKey((key) => key + 1);
      } catch (error) {
        setSaveError(errorMessage(error));
      }
    });
  }

  // Undo for generate: deletes the versions that were just created.
  function removeVersions(ids: string[], holders: string[]) {
    void track(holders, async () => {
      try {
        for (const id of ids) {
          const response = await fetch(`/api/accountability-forms/${id}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Couldn't undo the new forms.");
        }
      } catch (error) {
        setSaveError(errorMessage(error));
      }
      await refreshRows();
      setVersionsKey((key) => key + 1);
    });
  }

  const departments = useMemo(
    () =>
      [...new Set(rows.map((r) => r.department ?? "").filter(Boolean))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        departmentFilter.length &&
        !departmentFilter.includes(r.department ?? "")
      )
        return false;
      if (tab !== "All" && r.state !== tab) return false;
      if (!q) return true;
      return [
        r.holderName,
        r.employeeId ?? "",
        r.department ?? "",
        r.email ?? "",
        ...r.assets.map((a) => a.label),
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [rows, query, departmentFilter, tab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = filtered.slice(start, start + rowsPerPage);

  const pageIds = pageRows.map((r) => r.holderName);
  const selectedOnPage = pageIds.filter((id) => selected.has(id)).length;
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPage === pageIds.length;

  const hasFilters = query !== "" || departmentFilter.length > 0;

  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = {
      All: rows.length,
      "Up to date": 0,
      "Needs update": 0,
      "No form": 0,
    };
    for (const r of rows) counts[r.state] += 1;
    return counts;
  }, [rows]);

  const outstanding = rows
    .filter((r) => r.state !== "Up to date")
    .map((r) => r.holderName);

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function runGenerate(names: { hrName: string; itOfficerName: string }) {
    if (!generating) return;
    const { holders, force } = generating;
    setGenerating(null);
    setBusy(true);
    const before = new Map(rows.map((r) => [r.holderName, r.latest?.id]));
    try {
      const next = await track(holders, () => generate(holders, names, force));
      setRows(next);
      setSelected(new Set());
      // Versions this run created (unchanged forms are reused, not new).
      const created = next.filter(
        (r) =>
          holders.includes(r.holderName) &&
          r.latest &&
          r.latest.id !== before.get(r.holderName),
      );
      const message =
        created.length === 0
          ? "Forms were already up to date"
          : created.length === 1
            ? `Generated v${created[0].latest!.version} for ${created[0].holderName}`
            : `Generated forms for ${created.length} employees`;
      if (created.length === 0) {
        setNotice(message);
      } else {
        setUndo({
          message,
          run: () =>
            removeVersions(
              created.map((r) => r.latest!.id),
              created.map((r) => r.holderName),
            ),
        });
      }
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteForms(holders: string[]) {
    setBusy(true);
    try {
      const { rows: next, deleted } = await track(holders, async () => {
        const response = await fetch("/api/accountability-forms", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holders }),
        });
        if (!response.ok) {
          throw new Error(
            `Couldn't delete the forms (error ${response.status}).`,
          );
        }
        return (await response.json()) as {
          rows: AccountabilityRow[];
          deleted: FormBackup[];
        };
      });
      setRows(next);
      setSelected(new Set());
      setUndo({
        message:
          holders.length === 1
            ? `Deleted ${holders[0]}'s forms`
            : `Deleted forms for ${holders.length} employees`,
        run: () => restore(deleted),
      });
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const selectedWithForms = rows
    .filter((r) => selected.has(r.holderName) && r.versionCount > 0)
    .map((r) => r.holderName);
  const pendingVersionCount = rows
    .filter((r) => pendingDelete.includes(r.holderName))
    .reduce((sum, r) => sum + r.versionCount, 0);

  // Refreshes send history after an email goes out.
  async function refreshRows() {
    try {
      const response = await fetch("/api/accountability-forms");
      if (response.ok) setRows((await response.json()) as AccountabilityRow[]);
    } catch {
      // The send itself succeeded; the table catches up on next load.
    }
  }

  function clearFilters() {
    setQuery("");
    setDepartmentFilter([]);
    setPage(1);
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Folder tabs: the active tab joins the card below */}
      <div
        role="tablist"
        aria-label="Form status"
        className="flex items-end gap-1 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t) => {
          const active = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              title={tabHints[t]}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                active
                  ? "z-10 -mb-px h-10 border-border bg-card pb-px text-foreground"
                  : "h-9 border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t === "All" ? (
                <FileTextIcon className="size-4" />
              ) : (
                <span
                  className={cn("size-2 rounded-full", formStateStyles[t].dot)}
                />
              )}
              {t === "All" ? "All employees" : t}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs tabular-nums",
                  active
                    ? "bg-foreground text-background"
                    : "bg-background/70 text-muted-foreground",
                )}
              >
                {tabCounts[t]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex min-w-0 flex-col rounded-2xl rounded-tl-none border border-border bg-card text-card-foreground shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {selected.size} selected
              </span>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  setGenerating({ holders: [...selected], force: false })
                }
              >
                <FilePlusIcon />
                Generate forms
              </Button>
              {selectedWithForms.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={busy}
                  onClick={() => setPendingDelete(selectedWithForms)}
                >
                  {busy ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />}
                  Delete forms
                </Button>
              )}
            </div>
          )}
          <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <FilterMenu
              label="Department"
              icon={BuildingIcon}
              options={departments}
              selected={departmentFilter}
              onChange={(value) => {
                setDepartmentFilter(value);
                setPage(1);
              }}
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <XIcon />
                Clear
              </Button>
            )}
            <div className="relative flex-1 sm:flex-none">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search employees"
                className="h-8 w-full pl-8 text-sm sm:w-48"
              />
            </div>
            <Button variant="outline" onClick={() => exportCsv(filtered)}>
              <DownloadIcon />
              Export
            </Button>
            <Button
              disabled={busy || outstanding.length === 0}
              onClick={() =>
                setGenerating({ holders: outstanding, force: false })
              }
            >
              {busy ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <FilePlusIcon />
              )}
              {busy ? "Working…" : `Generate outstanding (${outstanding.length})`}
            </Button>
          </div>
        </div>

        {/* Table: rows scroll under a sticky header; columns drop out by priority as the card narrows */}
        <div className="@container max-h-[calc(100svh-17rem)] min-h-80 overflow-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="sticky top-0 z-10 h-9 w-9 border-r border-border bg-card pl-3 shadow-[inset_0_-1px_0_var(--color-border)]">
                  <Checkbox
                    aria-label="Select all on page"
                    checked={allOnPageSelected}
                    indeterminate={selectedOnPage > 0 && !allOnPageSelected}
                    onCheckedChange={(checked) => togglePage(checked)}
                  />
                </th>
                <ColumnHeader icon={UserIcon}>Employee</ColumnHeader>
                <ColumnHeader icon={BoxIcon} className="hidden @xl:table-cell">
                  Assigned assets
                </ColumnHeader>
                <ColumnHeader
                  icon={FileTextIcon}
                  className="hidden @3xl:table-cell"
                >
                  Latest form
                </ColumnHeader>
                <ColumnHeader icon={MailIcon} className="hidden @4xl:table-cell">
                  Last sent
                </ColumnHeader>
                <ColumnHeader icon={CircleDotIcon}>Status</ColumnHeader>
                <th className="sticky top-0 z-10 h-9 min-w-34 bg-card px-2 text-left text-[11px] font-medium whitespace-nowrap text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const isSelected = selected.has(row.holderName);
                const state = formStateStyles[row.state];
                const latest = row.latest;
                const lastSend = latest?.sends[0];
                const saving = working.has(row.holderName);
                return (
                  <tr
                    key={row.holderName}
                    data-state={isSelected ? "selected" : undefined}
                    className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    <td className="w-9 border-r border-border pl-3">
                      <Checkbox
                        aria-label={`Select ${row.holderName}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          toggleRow(row.holderName, checked)
                        }
                      />
                    </td>
                    <td className={cellClass}>
                      <div className="flex items-center gap-2">
                        <Avatar className="hidden size-6 after:rounded-full @2xl:flex">
                          <AvatarFallback className="bg-muted text-[9px] font-medium">
                            {initials(row.holderName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="leading-tight">
                          <div>{row.holderName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {[row.employeeId, row.department]
                              .filter(Boolean)
                              .join(" · ") || "Not in HRIS"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td
                      className={cn(
                        cellClass,
                        "hidden whitespace-normal @xl:table-cell",
                      )}
                    >
                      <div className="flex max-w-64 flex-wrap gap-1">
                        {row.assets.map((asset) => (
                          <span
                            key={asset.label}
                            className="rounded border border-border px-1.5 py-px text-[11px]"
                          >
                            {asset.count > 1 && (
                              <span className="tabular-nums">
                                {asset.count}×{" "}
                              </span>
                            )}
                            {asset.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className={cn(cellClass, "hidden @3xl:table-cell")}>
                      {latest ? (
                        <div className="leading-tight">
                          <div>
                            <span className="font-mono">v{latest.version}</span>
                            <span className="text-muted-foreground">
                              {" "}
                              · {latest.generatedOn}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {row.versionCount}{" "}
                            {row.versionCount === 1 ? "version" : "versions"}
                            {latest.createdByName &&
                              ` · by ${latest.createdByName}`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={cn(cellClass, "hidden @4xl:table-cell")}>
                      {lastSend ? (
                        <div className="leading-tight">
                          <div>{lastSend.toEmail}</div>
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            {formatSentAt(lastSend.sentAt)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          {latest ? "Not sent" : "—"}
                        </span>
                      )}
                    </td>
                    <td className={cellClass}>
                      {saving && (
                        <Loader2Icon
                          aria-label="Working"
                          className="mr-1 inline size-3 animate-spin text-muted-foreground"
                        />
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border border-border px-1.5 py-px text-[11px] font-medium",
                          state.text,
                        )}
                      >
                        <span
                          className={cn("size-1.5 rounded-full", state.dot)}
                        />
                        {row.state}
                      </span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {/* Same layout on every row: one primary action in a
                          fixed-width slot, everything else in the menu.
                          Locked while something is running for this row. */}
                      <fieldset
                        disabled={saving}
                        aria-busy={saving}
                        className="flex items-center justify-end gap-1 disabled:opacity-60"
                      >
                        {latest && row.state === "Up to date" ? (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-27"
                            onClick={() =>
                              setSending({ form: latest, email: row.email })
                            }
                          >
                            <SendIcon />
                            Send copy
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="xs"
                            className="min-w-27"
                            disabled={busy}
                            onClick={() =>
                              setGenerating({
                                holders: [row.holderName],
                                force: false,
                              })
                            }
                          >
                            <FilePlusIcon />
                            {row.state === "No form" ? "Generate" : "Update"}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`More actions for ${row.holderName}`}
                                className="text-muted-foreground hover:text-foreground"
                              />
                            }
                          >
                            <EllipsisIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {latest && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    window.open(formPdfUrl(latest.id), "_blank")
                                  }
                                >
                                  <ExternalLinkIcon />
                                  View latest form
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    window.location.href = formPdfUrl(
                                      latest.id,
                                      true,
                                    );
                                  }}
                                >
                                  <DownloadIcon />
                                  Download v{latest.version}
                                </DropdownMenuItem>
                                {row.state !== "Up to date" && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setSending({
                                        form: latest,
                                        email: row.email,
                                      })
                                    }
                                  >
                                    <SendIcon />
                                    Send v{latest.version}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => setVersionsFor(row.holderName)}
                                >
                                  <HistoryIcon />
                                  Versions ({row.versionCount})
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              disabled={busy}
                              onClick={() =>
                                setGenerating({
                                  holders: [row.holderName],
                                  force: true,
                                })
                              }
                            >
                              <RefreshCwIcon />
                              Generate new version
                            </DropdownMenuItem>
                            {latest && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  disabled={busy}
                                  onClick={() =>
                                    setPendingDelete([row.holderName])
                                  }
                                >
                                  <Trash2Icon />
                                  Delete all forms
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </fieldset>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {rows.length === 0
                      ? "No one has assigned equipment yet."
                      : "No employees match your filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" className="w-16" />}
            >
              {rowsPerPage}
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-20">
              <DropdownMenuRadioGroup
                value={rowsPerPage}
                onValueChange={(value) => {
                  setRowsPerPage(value as number);
                  setPage(1);
                }}
              >
                {rowsPerPageOptions.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {option}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="tabular-nums">
            {filtered.length === 0
              ? "0 rows"
              : `${start + 1}–${start + pageRows.length} of ${filtered.length} rows`}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="First page"
              disabled={currentPage === 1}
              onClick={() => setPage(1)}
            >
              <ChevronsLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
              <Button
                key={n}
                variant={n === currentPage ? "secondary" : "ghost"}
                size="icon-sm"
                className={cn(n === currentPage && "text-foreground")}
                onClick={() => setPage(n)}
              >
                {n}
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              <ChevronRightIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Last page"
              disabled={currentPage === pageCount}
              onClick={() => setPage(pageCount)}
            >
              <ChevronsRightIcon />
            </Button>
          </div>
        </div>
      </div>

      <AccountabilityFormPrompt
        open={generating !== null}
        onOpenChange={(next) => !next && setGenerating(null)}
        employeeName={
          generating?.holders.length === 1
            ? generating.holders[0]
            : `${generating?.holders.length ?? 0} employees`
        }
        onGenerate={runGenerate}
      />

      <SendFormDialog
        form={sending?.form ?? null}
        defaultEmail={sending?.email ?? null}
        open={sending !== null}
        onOpenChange={(next) => !next && setSending(null)}
        onSent={(to) => {
          setSending(null);
          setNotice(`Sent to ${to}`);
          setVersionsKey((key) => key + 1);
          void refreshRows();
        }}
      />

      <VersionsDialog
        holderName={versionsFor}
        open={versionsFor !== null}
        onOpenChange={(next) => !next && setVersionsFor(null)}
        refreshKey={versionsKey}
        onDeleted={(form, backup) => {
          setUndo({
            message: `Deleted v${form.version} for ${form.holderName}`,
            run: () => restore(backup),
          });
          void refreshRows();
        }}
        onSend={(form) =>
          setSending({
            form,
            email: rows.find((r) => r.holderName === form.holderName)?.email ?? null,
          })
        }
      />

      <ConfirmDeleteDialog
        open={pendingDelete.length > 0}
        onOpenChange={(next) => !next && setPendingDelete([])}
        title={
          pendingDelete.length === 1
            ? "Delete accountability forms?"
            : `Delete forms for ${pendingDelete.length} employees?`
        }
        description={`This deletes ${pendingVersionCount} form ${pendingVersionCount === 1 ? "version" : "versions"}${pendingDelete.length === 1 ? ` for ${pendingDelete[0]}` : ""}, including their send history. Their equipment assignments aren't affected. You can undo this afterward.`}
        confirmLabel={
          pendingDelete.length === 1
            ? "Delete forms"
            : `Delete forms for ${pendingDelete.length}`
        }
        onConfirm={() => deleteForms(pendingDelete)}
      />

      <UndoToast
        message={undo?.message ?? null}
        onUndo={() => {
          undo?.run();
          setUndo(null);
        }}
        onDismiss={() => setUndo(null)}
      />

      <ErrorToast message={saveError} onDismiss={() => setSaveError(null)} />
      <NoticeToast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
}

// Confirms a finished generate / send, styled like ErrorToast.
function NoticeToast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => dismiss(), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  if (!message || typeof document === "undefined") return null;

  return createPortal(
    <div
      key={message}
      role="status"
      className="fixed top-4 right-4 z-50 w-[min(calc(100%-2rem),22rem)] animate-in fade-in-0 slide-in-from-right-4"
    >
      <div className="flex items-start gap-2 border-2 border-emerald-500/40 bg-popover px-3 py-2.5 text-sm text-popover-foreground shadow-lg">
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <p className="min-w-0 flex-1">{message}</p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Dismiss"
          className="-my-1"
          onClick={onDismiss}
        >
          <XIcon />
        </Button>
      </div>
    </div>,
    document.body,
  );
}
