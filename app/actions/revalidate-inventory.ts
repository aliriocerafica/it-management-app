"use server"

import { revalidatePath } from "next/cache"

import { verifySession } from "@/lib/auth/session"

// Drops the cached copies of every dashboard page after a save that
// changed assets outside the page the user is looking at.
export async function revalidateInventory() {
  const user = await verifySession()
  if (!user) return
  revalidatePath("/dashboard", "layout")
}
