import crypto from "crypto"

import type { FormBackup } from "@/lib/accountability-forms"
import { encryptionKey } from "@/lib/crypto"

// Stable text for the HMAC, so a client that reorders keys still verifies,
// and a client that changes a field does not.
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null"
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "token")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`
}

function signature(form: FormBackup) {
  return crypto.createHmac("sha256", encryptionKey()).update(canonical(form)).digest("base64url")
}

export function signFormBackup(form: FormBackup): FormBackup {
  return { ...form, token: signature(form) }
}

export function isSignedFormBackup(form: FormBackup) {
  if (!form.token) return false
  const expected = signature(form)
  const given = Buffer.from(form.token)
  const actual = Buffer.from(expected)
  if (given.length !== actual.length) return false
  return crypto.timingSafeEqual(given, actual)
}
