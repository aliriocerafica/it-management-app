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
  Loader2Icon,
  MailIcon,
  PowerIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"

import { AddUserDialog } from "@/components/add-user-dialog"
import { Scrollable } from "@/components/scrollable"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { UndoToast } from "@/components/undo-toast"
import { FilterMenu, rowsPerPageOptions } from "@/components/laptop-inventory-table"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
  // Every action asks first; this is the pending one.
  const [confirm, setConfirm] = useState<{
    title: string
    description: string
    label: string
    destructive?: boolean
    icon: LucideIcon
    run: () => void | Promise<void>
  } | null>(null)
  // Users with a change in flight: spinner + locked menu.
  const [working, setWorking] = useState<Set<string>>(new Set())
  // The last change, and how to reverse it, for the Undo toast.
  const [undo, setUndo] = useState<{ message: string; run: () => void } | null>(null)
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

  async function track(ids: string[], task: () => Promise<void>) {
    setWorking((prev) => new Set([...prev, ...ids]))
    try {
      await task()
    } finally {
      setWorking((prev) => {
        const next = new Set(prev)
        for (const id of ids) next.delete(id)
        return next
      })
    }
  }

  // Patches each user; returns the ones that changed so Undo can flip them back.
  async function patchUsers(ids: string[], patch: { isActive?: boolean; role?: UserRole }) {
    setError(null)
    const changed: string[] = []
    const errors: string[] = []
    await track(ids, async () => {
      for (const id of ids) {
        try {
          const updated = await patchUser(id, patch)
          setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
          changed.push(id)
        } catch (e) {
          errors.push((e as Error).message)
        }
      }
    })
    if (errors.length > 0) setError(errors[0])
    return changed
  }

  async function setActive(targets: UserDto[], isActive: boolean) {
    const changed = await patchUsers(
      targets.map((u) => u.id),
      { isActive },
    )
    if (changed.length === 0) return
    const verb = isActive ? "Reactivated" : "Deactivated"
    setUndo({
      message:
        changed.length === 1
          ? `${verb} ${targets.find((u) => u.id === changed[0])?.name}`
          : `${verb} ${changed.length} users`,
      run: () => void patchUsers(changed, { isActive: !isActive }),
    })
  }

  async function changeRole(user: UserDto, role: UserRole) {
    const changed = await patchUsers([user.id], { role })
    if (changed.length === 0) return
    setUndo({
      message: `${user.name} is now ${role === "ADMIN" ? "an Admin" : "Staff"}`,
      run: () => void patchUsers([user.id], { role: user.role }),
    })
  }

  async function sendPasswordReset(user: UserDto) {
    setError(null)
    setInfo(null)
    await track([user.id], async () => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? `Could not email a reset code to ${user.email}.`)
        return
      }
      setInfo(`Password reset code sent to ${user.email}.`)
    })
  }

  function confirmToggle(user: UserDto) {
    setConfirm({
      title: `${user.isActive ? "Deactivate" : "Reactivate"} ${user.name}?`,
      description: user.isActive
        ? "They will no longer be able to sign in until reactivated. You can undo this afterward."
        : "They will be able to sign in again. You can undo this afterward.",
      label: user.isActive ? "Deactivate" : "Reactivate",
      destructive: user.isActive,
      icon: user.isActive ? PowerIcon : KeyRoundIcon,
      run: () => setActive([user], !user.isActive),
    })
  }

  function confirmDeactivateSelected() {
    const targets = users.filter((u) => selected.has(u.id) && u.isActive)
    if (targets.length === 0) {
      setInfo("The selected users are already deactivated.")
      return
    }
    setConfirm({
      title:
        targets.length === 1
          ? `Deactivate ${targets[0].name}?`
          : `Deactivate ${targets.length} users?`,
      description:
        "They will no longer be able to sign in until reactivated. You can undo this afterward.",
      label: targets.length === 1 ? "Deactivate" : `Deactivate ${targets.length}`,
      destructive: true,
      icon: PowerIcon,
      run: () => {
        setSelected(new Set())
        return setActive(targets, false)
      },
    })
  }

  function confirmRole(user: UserDto, role: UserRole) {
    if (role === user.role) return
    setConfirm({
      title: `Make ${user.name} ${role === "ADMIN" ? "an Admin" : "Staff"}?`,
      description:
        role === "ADMIN"
          ? "Admins can manage users and every setting. You can undo this afterward."
          : "They will lose access to user management and settings. You can undo this afterward.",
      label: role === "ADMIN" ? "Make Admin" : "Make Staff",
      icon: role === "ADMIN" ? ShieldIcon : UserIcon,
      run: () => changeRole(user, role),
    })
  }

  function confirmPasswordReset(user: UserDto) {
    setConfirm({
      title: `Send a password reset to ${user.name}?`,
      description: `A reset code will be emailed to ${user.email}. Emails can't be unsent.`,
      label: "Send reset",
      icon: MailIcon,
      run: () => sendPasswordReset(user),
    })
  }

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        {selected.size > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{selected.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              disabled={[...selected].some((id) => working.has(id))}
              onClick={confirmDeactivateSelected}
            >
              {[...selected].some((id) => working.has(id)) ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <PowerIcon />
              )}
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

      <Scrollable className="max-h-[calc(100svh-17rem)] min-h-80">
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
              <th className="sticky top-0 z-10 h-9 min-w-[3.5rem] bg-card px-2 text-left text-[11px] font-medium whitespace-nowrap text-muted-foreground">
                Actions
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
                    {working.has(user.id) && (
                      <Loader2Icon
                        aria-label="Saving"
                        className="mr-1 inline size-3 animate-spin text-muted-foreground"
                      />
                    )}
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
                            disabled={working.has(user.id)}
                            className="text-muted-foreground hover:text-foreground"
                          />
                        }
                      >
                        <EllipsisIcon />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuRadioGroup
                          value={user.role}
                          onValueChange={(value) => confirmRole(user, value as UserRole)}
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
                        <DropdownMenuItem onClick={() => confirmPasswordReset(user)}>
                          <MailIcon />
                          Send password reset
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant={user.isActive ? "destructive" : undefined}
                          onClick={() => confirmToggle(user)}
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
      </Scrollable>

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

      <ConfirmDeleteDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description ?? ""}
        confirmLabel={confirm?.label}
        confirmVariant={confirm?.destructive ? "destructive" : "default"}
        icon={confirm?.icon}
        onConfirm={() => confirm?.run()}
      />

      <UndoToast
        message={undo?.message ?? null}
        onUndo={() => {
          undo?.run()
          setUndo(null)
        }}
        onDismiss={() => setUndo(null)}
      />
    </div>
  )
}
