"use client"

import { useRef } from "react"

import { cn } from "@/lib/utils"

export function OtpBoxes({
  value,
  onChange,
  disabled,
  invalid,
  length = 6,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  length?: number
  autoFocus?: boolean
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const digits = value.replace(/\D/g, "").slice(0, length).split("")

  function setDigit(index: number, digit: string) {
    const next = Array.from({ length }, (_, i) => digits[i] ?? "")
    next[index] = digit
    onChange(next.join("").slice(0, length))
    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus()
    }
  }

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            inputs.current[index] = node
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${index + 1}`}
          maxLength={1}
          disabled={disabled}
          value={digits[index] ?? ""}
          onChange={(event) => {
            const char = event.target.value.replace(/\D/g, "").slice(-1)
            setDigit(index, char)
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) {
              event.preventDefault()
              const next = Array.from({ length }, (_, i) => digits[i] ?? "")
              next[index - 1] = ""
              onChange(next.join(""))
              inputs.current[index - 1]?.focus()
            }
            if (event.key === "ArrowLeft" && index > 0) {
              event.preventDefault()
              inputs.current[index - 1]?.focus()
            }
            if (event.key === "ArrowRight" && index < length - 1) {
              event.preventDefault()
              inputs.current[index + 1]?.focus()
            }
          }}
          onPaste={(event) => {
            event.preventDefault()
            const pasted = event.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, length)
            if (pasted) onChange(pasted)
          }}
          className={cn(
            "size-12 rounded-xl border bg-transparent text-center font-mono text-lg outline-none transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            invalid
              ? "border-destructive ring-3 ring-destructive/20"
              : "border-input",
          )}
        />
      ))}
    </div>
  )
}
