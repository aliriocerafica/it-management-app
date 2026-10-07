"use client"

import { useMemo, useState } from "react"
import {
  ArrowRightIcon,
  MemoryStickIcon,
  SearchIcon,
  Undo2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { type Accessory } from "@/lib/accessories"
import {
  adjustRam,
  parseGb,
  ramModulesInLaptop,
  vacantRamModules,
  type RamHost,
} from "@/lib/ram"
import { cn } from "@/lib/utils"

export function ManageLaptopRamDialog({
  laptop,
  modules,
  open,
  onOpenChange,
  onInstall,
  onRemove,
}: {
  laptop: RamHost | null
  modules: Accessory[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onInstall: (module: Accessory, note: string) => void
  onRemove: (module: Accessory) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {open && laptop && (
          <ManageForm
            key={laptop.id}
            laptop={laptop}
            modules={modules}
            onInstall={onInstall}
            onRemove={onRemove}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ManageForm({
  laptop,
  modules,
  onInstall,
  onRemove,
}: {
  laptop: RamHost
  modules: Accessory[]
  onInstall: (module: Accessory, note: string) => void
  onRemove: (module: Accessory) => void
}) {
  const [query, setQuery] = useState("")
  const [note, setNote] = useState("")
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const installed = ramModulesInLaptop(modules, laptop.id)
  const canInstall = laptop.status !== "Retired"
  const stock = useMemo(() => {
    const q = query.trim().toLowerCase()
    return vacantRamModules(modules).filter(
      (item) =>
        !q ||
        [
          item.assetTag,
          item.brand,
          item.model,
          item.specs.capacity,
          item.specs.type,
        ].some((value) => value?.toLowerCase().includes(q)),
    )
  }, [modules, query])

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="text-lg font-semibold">Manage RAM</DialogTitle>
        <DialogDescription className="flex items-center gap-1.5">
          <span className="font-mono text-xs">{laptop.assetTag}</span>
          <span aria-hidden>·</span>
          {laptop.brand} {laptop.model}
          <span aria-hidden>·</span>
          {laptop.ram}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 py-4">
        <section className="flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Installed
          </h3>
          {installed.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
              No extra modules in this laptop. Memory stays at {laptop.ram}
              until you install one from stock.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {installed.map((item) => {
                const gb = parseGb(item.specs.capacity)
                const nextRam =
                  gb && parseGb(laptop.ram) !== null
                    ? adjustRam(laptop.ram, -gb)
                    : null
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <MemoryStickIcon className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-sm font-medium">
                        <span className="font-mono">{item.assetTag}</span>{" "}
                        <span className="font-normal text-muted-foreground">
                          {item.specs.capacity} {item.specs.type}
                        </span>
                      </div>
                      {nextRam && (
                        <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {laptop.ram}
                          <ArrowRightIcon className="size-3" />
                          {nextRam} if removed
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant={pendingRemoveId === item.id ? "default" : "outline"}
                      size="xs"
                      onClick={() => {
                        if (pendingRemoveId === item.id) {
                          onRemove(item)
                          setPendingRemoveId(null)
                        } else {
                          setPendingRemoveId(item.id)
                        }
                      }}
                    >
                      <Undo2Icon />
                      {pendingRemoveId === item.id ? "Confirm remove" : "Remove"}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {canInstall && (
          <section className="flex flex-col gap-2">
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Vacant stock
            </h3>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search vacant modules"
                className="pl-8"
              />
            </div>
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {stock.map((item) => {
                const gb = parseGb(item.specs.capacity)
                const nextRam =
                  gb && parseGb(laptop.ram) !== null
                    ? adjustRam(laptop.ram, gb)
                    : null
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 hover:bg-muted/60"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <MemoryStickIcon className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-sm font-medium">
                        <span className="font-mono">{item.assetTag}</span>{" "}
                        <span className="font-normal text-muted-foreground">
                          {item.brand} {item.model}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "truncate text-xs text-muted-foreground",
                          nextRam && "inline-flex items-center gap-1",
                        )}
                      >
                        {item.specs.capacity} {item.specs.type}
                        {nextRam && (
                          <>
                            <span aria-hidden>·</span>
                            {laptop.ram}
                            <ArrowRightIcon className="size-3" />
                            {nextRam}
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => onInstall(item, note.trim())}
                    >
                      <MemoryStickIcon />
                      Install
                    </Button>
                  </li>
                )
              })}
              {stock.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">
                  {vacantRamModules(modules).length
                    ? "No vacant modules match your search."
                    : "No vacant RAM in stock."}
                </li>
              )}
            </ul>
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note, e.g. upgrade for slow performance"
            />
          </section>
        )}
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" />}>Done</DialogClose>
      </DialogFooter>
    </>
  )
}
