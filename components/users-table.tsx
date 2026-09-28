"use client"

import { useMemo, useState } from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CircleDotIcon,
  EllipsisIcon,
  KeyRoundIcon,
  MailIcon,
  PowerIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
} from "lucide-react"

import { AddUserDialog } from "@/components/add-user-dialog"
import { FilterMenu, rowsPerPageOptions } from "@/components/laptop-inventory-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserDto, UserRole } from "@/lib/user-repository"
import { cn } from "@/lib/utils"

const cellClass = "border-r border-border px-2.5 py-2 align-middle whitespace-nowrap"

const roleOptions = ["Admin", "Staff"] as const
const statusOptions = ["Active", "Deactivated"] as const

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function UsersTable({ initialData }: { initialData: UserDto[] }) {
  const [users, setUsers] = useState(initialData)
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<(typeof roleOptions)[number][]>([])
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number][]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0])
  const [page, setPage] = useState(1)
  const [pendingToggle, setPendingToggle] = useState<UserDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return users.filter((user) => {
      if (needle) {
        const haystack = `${user.name} ${user.email}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (roleFilter.length > 0) {
        const label = user.role === "ADMIN" ? "Admin" : "Staff"
        if (!roleFilter.includes(label)) return false
      }
      if (statusFilter.length > 0) {
        const label = user.isActive ? "Active" : "Deactivated"
        if (!statusFilter.includes(label)) return false
      }
      return true
    })
  }, [users, query, roleFilter, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * rowsPerPage
  const pageRows = filtered.slice(start, start + rowsPerPage)

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((u) => selected.has(u.id))

  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const user of pageRows) {
        if (checked) next.add(user.id)
        else next.delete(user.id)
      }
      return next
    })
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function patchUser(id: string, patch: { isActive?: boolean; role?: UserRole }) {
    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.error ?? "Could not update user.")
    }
    return (await response.json()) as UserDto
  }

  async function toggleActive(user: UserDto) {
    setError(null)
    try {
      const updated = await patchUser(user.id, { isActive: !user.isActive })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPendingToggle(null)
    }
  }

  async function changeRole(user: UserDto, role: UserRole) {
    setError(null)
    try {
      const updated = await patchUser(user.id, { role })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function sendPasswordReset(user: UserDto) {
    setError(null)
    setInfo(null)
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email }),
    })
    setInfo(`Password reset code sent to ${user.email}.`)
  }

  async function deactivateSelected() {
    setError(null)
    const ids = [...selected]
    const errors: string[] = []
    for (const id of ids) {
      try {
        const updated = await patchUser(id, { isActive: false })
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
      } catch (e) {
        errors.push((e as Error).message)
      }
    }
    setSelected(new Set())
    if (errors.length > 0) setError(errors[0])
  }

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        {selected.size > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{selected.size} selected</span>
            <Button variant="outline" size="sm" onClick={deactivateSelected}>
              <PowerIcon />
              Deactivate
            </Button>
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search users"
              className="h-8 w-full pl-8 text-sm sm:w-48"
            />
          </div>
          <FilterMenu
            label="Role"
            icon={ShieldIcon}
            options={[...roleOptions]}
            selected={roleFilter}
            onChange={(value) => {
              setRoleFilter(value)
              setPage(1)
            }}
          />
          <FilterMenu
            label="Status"
            icon={CircleDotIcon}
            options={[...statusOptions]}
            selected={statusFilter}
            onChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
          />
          <AddUserDialog onAdd={(user) => setUsers((prev) => [...prev, user])} />
        </div>
      </div>

      {(error || info) && (
        <div className="border-b border-border px-4 py-2 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          {info && <p className="text-muted-foreground">{info}</p>}
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky top-0 z-10 h-9 w-9 border-r border-border bg-card pl-3 shadow-[inset_0_-1px_0_var(--color-border)]">
                <Checkbox
                  aria-label="Select all on page"
                  checked={allOnPageSelected}
                  onCheckedChange={(checked) => togglePage(Boolean(checked))}
                />
              </th>
              <th className="sticky top-0 z-10 h-9 border-r border-border bg-card px-2.5 text-left text-[11px] font-medium text-muted-foreground">
                Name
              </th>
              <th className="sticky top-0 z-10 h-9 border-r border-border bg-card px-2.5 text-left text-[11px] font-medium text-muted-foreground">
                Email
              </th>
              <th className="sticky top-0 z-10 h-9 border-r border-border bg-card px-2.5 text-left text-[11px] font-medium text-muted-foreground">
                Role
              </th>
              <th className="sticky top-0 z-10 h-9 border-r border-border bg-card px-2.5 text-left text-[11px] font-medium text-muted-foreground">
                Status
              </th>
              <th className="sticky top-0 z-10 h-9 border-r border-border bg-card px-2.5 text-left text-[11px] font-medium text-muted-foreground">
                Last login
              </th>
              <th className="sticky top-0 z-10 h-9 bg-card px-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((user) => {
              const isSelected = selected.has(user.id)
              return (
                <tr
                  key={user.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                >
                  <td className="w-9 border-r border-border pl-3">
                    <Checkbox
                      aria-label={`Select ${user.name}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => toggleRow(user.id, Boolean(checked))}
                    />
                  </td>
                  <td className={cn(cellClass, "font-medium")}>{user.name}</td>
                  <td className={cellClass}>{user.email}</td>
                  <td className={cellClass}>{user.role === "ADMIN" ? "Admin" : "Staff"}</td>
                  <td className={cellClass}>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded border border-border px-1.5 py-px text-[11px] font-medium",
                        user.isActive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          user.isActive ? "bg-emerald-500" : "bg-muted-foreground",
                        )}
                      />
                      {user.isActive ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td className={cellClass}>
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  </td>
                  <td className="px-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`More actions for ${user.name}`}
                            className="text-muted-foreground hover:text-foreground"
                          />
                        }
                      >
                        <EllipsisIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuRadioGroup
                          value={user.role}
                          onValueChange={(value) => changeRole(user, value as UserRole)}
                        >
                          <DropdownMenuRadioItem value="ADMIN">
                            <ShieldIcon />
                            Admin
                          </DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="STAFF">
                            <UserIcon />
                            Staff
                          </DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => sendPasswordReset(user)}>
                          <MailIcon />
                          Send password reset
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant={user.isActive ? "destructive" : undefined}
                          onClick={() => setPendingToggle(user)}
                        >
                          {user.isActive ? <PowerIcon /> : <KeyRoundIcon />}
                          {user.isActive ? "Deactivate" : "Reactivate"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No users match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
        <span>Rows per page</span>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="w-16" />}>
            {rowsPerPage}
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-20">
            <DropdownMenuRadioGroup
              value={rowsPerPage}
              onValueChange={(value) => {
                setRowsPerPage(value as number)
                setPage(1)
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

      <Dialog open={pendingToggle !== null} onOpenChange={(next) => !next && setPendingToggle(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingToggle?.isActive ? "Deactivate" : "Reactivate"} {pendingToggle?.name}?
            </DialogTitle>
            <DialogDescription>
              {pendingToggle?.isActive
                ? "They will no longer be able to sign in until reactivated."
                : "They will be able to sign in again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mx-0 mb-0 px-6 py-4">
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant={pendingToggle?.isActive ? "destructive" : "default"}
              onClick={() => pendingToggle && toggleActive(pendingToggle)}
            >
              {pendingToggle?.isActive ? "Deactivate" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
