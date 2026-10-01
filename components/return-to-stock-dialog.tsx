"use client"

import { useEffect, useState } from "react"
import { Undo2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Label } from "@/components/ui/label"
import { accessoryConfigs, type Accessory } from "@/lib/accessories"
import { listAssignedAssets } from "@/lib/inventory-api"
import { type Laptop } from "@/lib/laptops"

export type AssignedAssets = {
  laptops: Laptop[]
  accessories: Accessory[]
}

export function ReturnToStockDialog({
  item,
  itemId,
  noun = "laptop",
  open,
  onOpenChange,
  onConfirm,
}: {
  item: { brand: string; model: string; assetTag: string; handler: string | null } | null
  itemId: string | null
  noun?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (note: string, alsoReturn: AssignedAssets) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        {item && itemId && (
          <ReturnForm
            item={item}
            itemId={itemId}
            noun={noun}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReturnForm({
  item,
  itemId,
  noun,
  onConfirm,
}: {
  item: { brand: string; model: string; assetTag: string; handler: string | null }
  itemId: string
  noun: string
  onConfirm: (note: string, alsoReturn: AssignedAssets) => void
}) {
  const [note, setNote] = useState("")
  const [alsoReturn, setAlsoReturn] = useState(true)
  const [others, setOthers] = useState<AssignedAssets>({
    laptops: [],
    accessories: [],
  })
  const handler = item.handler?.trim() ?? ""
  const [loading, setLoading] = useState(handler !== "")
  // Show the spinner as soon as the item changes, before the effect runs.
  const loadKey = `${handler}|${itemId}`
  const [loadedKey, setLoadedKey] = useState(loadKey)
  if (loadKey !== loadedKey) {
    setLoadedKey(loadKey)
    setLoading(handler !== "")
  }

  useEffect(() => {
    if (!handler) return
    let cancelled = false
    void listAssignedAssets(handler)
      .then((assigned) => {
        if (cancelled) return
        setOthers({
          laptops: assigned.laptops.filter((laptop) => laptop.id !== itemId),
          accessories: assigned.accessories.filter((accessory) => accessory.id !== itemId),
        })
      })
      .catch(() => {
        if (cancelled) return
        setOthers({ laptops: [], accessories: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [handler, itemId])

  const otherRows = [
    ...others.laptops.map((laptop) => ({
      id: laptop.id,
      label: `Laptop · ${laptop.brand} ${laptop.model}`,
      tag: laptop.assetTag,
    })),
    ...others.accessories.map((accessory) => ({
      id: accessory.id,
      label: `${accessoryConfigs[accessory.kind].singular} · ${accessory.brand} ${accessory.model}`,
      tag: accessory.assetTag,
    })),
  ]
  const otherCount = otherRows.length

  return (
    <>
      <DialogHeader className="border-b border-border px-6 py-5 pr-12">
        <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
          <Undo2Icon className="size-4" />
          Return to IT
        </DialogTitle>
        <DialogDescription>
          {item.brand} {item.model} ·{" "}
          <span className="font-mono text-xs">{item.assetTag}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5">
        <p className="text-sm text-muted-foreground">
          {handler ? (
            <>
              Returned by <span className="font-medium text-foreground">{handler}</span>.
              Status becomes Vacant.
            </>
          ) : (
            <>This {noun} will be marked Vacant.</>
          )}
        </p>

        {handler && otherCount > 0 && (
          <label className="flex items-start gap-3 rounded-xl border border-border px-3 py-3">
            <Checkbox
              checked={alsoReturn}
              onCheckedChange={(checked) => setAlsoReturn(checked === true)}
              className="mt-0.5"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                Also return {otherCount} other asset{otherCount === 1 ? "" : "s"} assigned to {handler}
              </span>
              <span className="mt-2 block space-y-1 text-xs text-muted-foreground">
                {otherRows.map((row) => (
                  <span key={row.id} className="block">
                    {row.label}{" "}
                    <span className="font-mono">{row.tag}</span>
                  </span>
                ))}
              </span>
            </span>
          </label>
        )}

        {handler && loading && otherCount === 0 && (
          <p className="text-xs text-muted-foreground">Checking other assigned assets…</p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="return-note" className="text-xs">
            Note
            <span className="font-normal text-muted-foreground"> (optional)</span>
          </Label>
          <Input
            id="return-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Left the company, laptop collected"
          />
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 px-6 py-4">
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button
          onClick={() =>
            onConfirm(
              note.trim(),
              alsoReturn ? others : { laptops: [], accessories: [] },
            )
          }
        >
          Mark vacant
        </Button>
      </DialogFooter>
    </>
  )
}
