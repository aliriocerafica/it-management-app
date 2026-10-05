---
name: check-build-ui
description: >-
  Runs TypeScript and ESLint, then smoke-tests this app's pages in the browser
  for console errors, failed requests, and broken renders. Use when the user
  asks to check the build, find UI errors, smoke-test the app, or run the
  build UI check.
---

# Build and UI check

Project: IT management app. Dev server: `npm run dev` on **http://localhost:3000**.

Do not change product code during this check unless the user asks for fixes. Report findings, then stop.

## 1. Static checks

Run from the repo root. These are safe while `npm run dev` is running.

```bash
npx tsc --noEmit --pretty false
npx eslint . --max-warnings 0
```

Run them in parallel. Record the exit code and the first useful error for each. `tsc` and `eslint` both exiting 0 means the static check passed.

Skip `npm run build` while `npm run dev` is running. Both write `.next`, and a production build will break the live server. If the user explicitly wants a production build, say the dev server must be stopped first, then run `npm run build` only after it is stopped.

## 2. UI smoke test

Use the cursor-ide-browser tools. Read each tool schema with GetDynamicTools before the first call.

If `npm run dev` is not running, do not start it. Report that the UI half was skipped.

1. `browser_tabs` with action `list`. Reuse a tab already on port 3000.
2. Install an error collector before navigation, via `browser_cdp`:

```json
{"method":"Page.addScriptToEvaluateOnNewDocument","params":{"source":"window.__uiErrors=[];window.addEventListener('error',function(e){window.__uiErrors.push(String(e.message).slice(0,300))});window.addEventListener('unhandledrejection',function(e){window.__uiErrors.push(String(e.reason).slice(0,300))});var orig=console.error;console.error=function(){window.__uiErrors.push(Array.from(arguments).map(String).join(' ').slice(0,300));return orig.apply(console,arguments)}"}}
```

3. `browser_navigate` to `http://localhost:3000/dashboard`.
4. `browser_lock` with action `lock`. Unlock when the smoke test is finished.
5. If the page is the login screen, stop. Ask the user to sign in in that tab. Do not read `.env`, invent credentials, or submit the login form.
6. Visit every route in [routes.md](routes.md). After each navigation:
   - `browser_snapshot` and confirm the expected heading.
   - `browser_cdp` `Runtime.evaluate` with `returnByValue: true` and this expression:

```javascript
JSON.stringify({ href: location.href, heading: document.querySelector("h1")?.textContent ?? "", errors: window.__uiErrors || [], overlay: !!document.querySelector("nextjs-portal") })
```

   A page fails on an uncaught error, a console error, a Next.js overlay, the text "Application error", a missing heading, or a document that did not load. An empty table is a pass. A spinner that never settles is a fail.
7. Do not click create, save, delete, assign, send, or logout. This check is read-only.
8. Skip viewport changes unless the user asked about layout. Then check `/dashboard` at 390px and 1280px with `Emulation.setDeviceMetricsOverride`, and clear it with `Emulation.clearDeviceMetricsOverride`.

## 3. Report

Use this template. Keep file paths and the first line of each error. Do not paste full stack traces.

```markdown
# Build and UI check

## Static
- TypeScript: pass | fail — <one line>
- ESLint: pass | fail — <one line>
- Production build: skipped (dev server running) | pass | fail

## Pages
| Route | Result | Notes |
| --- | --- | --- |
| /dashboard | pass | |

## Failures
1. **<route or command>** — <what broke> — <file or request if known>

## Not checked
- <login wall, dev server down, or routes skipped>
```

A page passes when it renders its heading, the document loaded, and no console error appeared on that navigation. A warning that is already known (for example AnyDesk decrypt warnings in the server log) goes under Failures only when the page shows the wrong value to the user.
