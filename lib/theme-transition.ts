const DURATION_MS = 2000

// Plays the sky animation (styled in globals.css as `.theme-shift`) over the
// whole page: the sun sets and the moon rises going dark, the reverse going
// light. `apply` switches the theme halfway through, while the sky covers the
// page, so the new theme is what's revealed when it fades out.
export function playThemeTransition(to: "light" | "dark", apply: () => void) {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.querySelector(".theme-shift")
  ) {
    apply()
    return
  }

  const overlay = document.createElement("div")
  overlay.className = "theme-shift"
  overlay.dataset.to = to
  overlay.setAttribute("aria-hidden", "true")
  overlay.innerHTML =
    '<div class="theme-shift-night"></div>' +
    '<div class="theme-shift-day"></div>' +
    '<div class="theme-shift-star"></div>'.repeat(3) +
    '<div class="theme-shift-cloud"></div>'.repeat(3) +
    '<div class="theme-shift-satellite"></div>' +
    '<div class="theme-shift-body theme-shift-sun"></div>' +
    '<div class="theme-shift-body theme-shift-moon"></div>'
  document.body.append(overlay)

  window.setTimeout(apply, DURATION_MS / 2)
  window.setTimeout(() => overlay.remove(), DURATION_MS)
}
