export function digitsOnly(address: string) {
  return address.replace(/\D/g, "")
}

// AnyDesk IDs are 9 or 10 digits. Returns the digits, or null if the input
// isn't a valid ID. Spaces and dashes are allowed while typing.
export function parseAnydeskAddress(input: string): string | null {
  if (/[^\d\s-]/.test(input)) return null
  const digits = digitsOnly(input)
  return digits.length === 9 || digits.length === 10 ? digits : null
}

// The placeholder the app used to invent for laptops without an address.
// Stored values that still match it are treated as "no address".
export function legacyPlaceholderAddress(assetTag: string) {
  const n = Number(assetTag.replace(/\D/g, "")) || 1
  return String(100_000_000 + n * 17_329).padStart(9, "0").slice(0, 9)
}

export function formatAnydeskAddress(address: string) {
  const digits = digitsOnly(address)
  return digits.length === 10
    ? digits.replace(/(\d)(\d{3})(\d{3})(\d{3})/, "$1 $2 $3 $4")
    : digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
}

export function anydeskHref(address: string) {
  return `anydesk:${digitsOnly(address)}`
}
