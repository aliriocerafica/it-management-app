import type { OwnershipEntry, LaptopStatus } from "@/lib/laptops"

type Returnable = {
  handler: string | null
  department: string | null
  status: LaptopStatus
  history: OwnershipEntry[]
}

export function todayIsoDate() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}

// Hands an item to someone and closes the open "with IT" stint.
export function assignIssuedItem<T extends Returnable>(
  item: T,
  holder: { name: string; department: string | null },
  note: string,
  todayIso = todayIsoDate(),
): T {
  return {
    ...item,
    status: "In use",
    handler: holder.name,
    department: holder.department,
    history: [
      ...item.history.map((entry) =>
        entry.to === null ? { ...entry, to: todayIso } : entry,
      ),
      {
        handler: holder.name,
        department: holder.department || undefined,
        from: todayIso,
        to: null,
        note: note || undefined,
      },
    ],
  }
}

export function returnedToVacant<T extends Returnable>(item: T, extraNote = ""): T {
  const todayIso = todayIsoDate()
  const previousOwner = item.handler?.trim()
  const note = [
    previousOwner ? `Returned by ${previousOwner}` : "Returned to IT",
    extraNote.trim(),
  ]
    .filter(Boolean)
    .join(": ")

  return {
    ...item,
    status: "Vacant",
    handler: null,
    department: null,
    history: [
      ...item.history.map((entry) =>
        entry.to === null ? { ...entry, to: todayIso } : entry,
      ),
      {
        handler: null,
        from: todayIso,
        to: null,
        note,
      },
    ],
  }
}
