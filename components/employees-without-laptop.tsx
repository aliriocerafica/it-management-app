"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpDownIcon,
  BriefcaseIcon,
  Building2Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  DownloadIcon,
  HashIcon,
  MailIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from "lucide-react";

import {
  ColumnHeader,
  FilterMenu,
  cellClass,
  rowClass,
  rowsPerPageOptions,
} from "@/components/laptop-inventory-table";
import { Scrollable } from "@/components/scrollable";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { type Employee } from "@/lib/employees";
import { initials } from "@/lib/laptops";
import { cn } from "@/lib/utils";

function exportCsv(rows: Employee[]) {
  const header = ["Employee ID", "Name", "Account", "Position", "Email"];
  const lines = rows.map((e) =>
    [e.id, e.name, e.department, e.title, e.email]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "employees-without-laptop.csv";
  link.click();
  URL.revokeObjectURL(url);
}

const sortOptions = [
  { key: "account", label: "Account A–Z" },
  { key: "account-desc", label: "Account Z–A" },
  { key: "account-size", label: "Largest account first" },
  { key: "name", label: "Name A–Z" },
  { key: "name-desc", label: "Name Z–A" },
] as const;
type SortKey = (typeof sortOptions)[number]["key"];

// Active employees with no laptop tagged to them: who still needs auditing.
export function EmployeesWithoutLaptop({
  employees,
  status,
}: {
  employees: Employee[];
  status: "loading" | "ready" | "error";
}) {
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("account");
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [page, setPage] = useState(1);

  const departments = useMemo(
    () =>
      [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // How many people each account still has on the list.
    const size = new Map<string, number>();
    for (const e of employees) {
      size.set(e.department, (size.get(e.department) ?? 0) + 1);
    }
    const byName = (a: Employee, b: Employee) => a.name.localeCompare(b.name);
    const byAccount = (a: Employee, b: Employee) =>
      a.department.localeCompare(b.department);
    const compare: Record<SortKey, (a: Employee, b: Employee) => number> = {
      account: (a, b) => byAccount(a, b) || byName(a, b),
      "account-desc": (a, b) => byAccount(b, a) || byName(a, b),
      "account-size": (a, b) =>
        size.get(b.department)! - size.get(a.department)! ||
        byAccount(a, b) ||
        byName(a, b),
      name: byName,
      "name-desc": (a, b) => byName(b, a),
    };
    return employees
      .filter((e) => {
        if (
          departmentFilter.length &&
          !departmentFilter.includes(e.department)
        )
          return false;
        if (!q) return true;
        return [e.id, e.name, e.department, e.title, e.email].some((value) =>
          value.toLowerCase().includes(q),
        );
      })
      .sort(compare[sort]);
  }, [employees, query, departmentFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * rowsPerPage;
  const pageRows = filtered.slice(start, start + rowsPerPage);

  const hasFilters = query !== "" || departmentFilter.length > 0;

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Active employees with no laptop tagged to them.
        </p>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <FilterMenu
            label="Account"
            icon={Building2Icon}
            options={departments}
            selected={departmentFilter}
            onChange={(value) => {
              setDepartmentFilter(value);
              setPage(1);
            }}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" className="rounded-full" />}
            >
              <ArrowUpDownIcon className="text-muted-foreground" />
              {sortOptions.find((option) => option.key === sort)?.label}
              <ChevronDownIcon className="text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={sort}
                  onValueChange={(value) => {
                    setSort(value as SortKey);
                    setPage(1);
                  }}
                >
                  {sortOptions.map((option) => (
                    <DropdownMenuRadioItem key={option.key} value={option.key}>
                      {option.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setDepartmentFilter([]);
                setPage(1);
              }}
            >
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
          <Button
            variant="outline"
            disabled={filtered.length === 0}
            onClick={() => exportCsv(filtered)}
          >
            <DownloadIcon />
            Export
          </Button>
        </div>
      </div>

      <Scrollable className="@container max-h-[calc(100svh-17rem)] min-h-80">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <ColumnHeader icon={UserIcon}>Employee</ColumnHeader>
              <ColumnHeader icon={HashIcon} className="hidden @xl:table-cell">
                Employee ID
              </ColumnHeader>
              <ColumnHeader icon={Building2Icon}>Account</ColumnHeader>
              <ColumnHeader
                icon={BriefcaseIcon}
                className="hidden @3xl:table-cell"
              >
                Position
              </ColumnHeader>
              <ColumnHeader
                icon={MailIcon}
                className="hidden border-r-0 @5xl:table-cell"
              >
                Email
              </ColumnHeader>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((employee) => (
              <tr key={employee.id} className={rowClass}>
                <td className={cellClass}>
                  <div className="flex items-center gap-2">
                    <Avatar className="hidden size-6 after:rounded-full @2xl:flex">
                      <AvatarFallback className="bg-muted text-[9px] font-medium">
                        {initials(employee.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="leading-tight">
                      <div className="font-medium">{employee.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground @xl:hidden">
                        {employee.id}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  className={cn(cellClass, "hidden font-mono @xl:table-cell")}
                >
                  {employee.id}
                </td>
                <td className={cellClass}>{employee.department || "—"}</td>
                <td className={cn(cellClass, "hidden @3xl:table-cell")}>
                  {employee.title || "—"}
                </td>
                <td
                  className={cn(
                    cellClass,
                    "hidden border-r-0 @5xl:table-cell",
                  )}
                >
                  {employee.email || "—"}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {status === "loading"
                    ? "Loading employees from HRIS…"
                    : status === "error"
                      ? "Couldn't reach the HRIS employee directory."
                      : hasFilters
                        ? "No employees match your filters."
                        : "Every active employee has a laptop tagged to them."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Scrollable>

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
    </>
  );
}
