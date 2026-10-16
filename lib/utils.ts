export { cn } from "cn"

// The page buttons to show: the first and last page and those around the
// current one, e.g. 1 … 4 5 6 … 66. Gaps are negative numbers (-1 before the
// current page, -2 after), so every item still works as a React key.
export function pageItems(current: number, count: number): number[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  const start = Math.max(2, Math.min(current - 1, count - 4))
  const end = Math.min(count - 1, Math.max(current + 1, 5))
  const middle = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  return [
    1,
    ...(start > 2 ? [-1] : []),
    ...middle,
    ...(end < count - 1 ? [-2] : []),
    count,
  ]
}
