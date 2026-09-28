export function digitsOnly(address: string) {
  return address.replace(/\D/g, "")
}

export function generateAnydeskAddress(assetTag: string) {
  const n = Number(assetTag.replace(/\D/g, "")) || 1
  return String(100_000_000 + n * 17_329).padStart(9, "0").slice(0, 9)
}

export function formatAnydeskAddress(address: string) {
  const digits = digitsOnly(address)
  return digits.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
}

export function anydeskHref(address: string) {
  return `anydesk:${digitsOnly(address)}`
}
