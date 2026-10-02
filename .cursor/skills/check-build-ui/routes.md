# Routes to open

Base URL: `http://localhost:3001`

Auth pages (only if already logged out; do not submit forms):

- `/login`
- `/forgot-password`

Dashboard pages, in this order. Each should show its own heading, not the login page and not the Next.js error overlay.

| Path | Heading to expect |
| --- | --- |
| `/dashboard` | Dashboard |
| `/dashboard/remote-access` | Remote Access |
| `/dashboard/laptops` | Laptop Inventory |
| `/dashboard/headsets` | Headsets |
| `/dashboard/mice` | Mice |
| `/dashboard/keyboards` | Keyboards |
| `/dashboard/monitors` | Monitors |
| `/dashboard/laptop-bags` | Laptop Bags |
| `/dashboard/batteries` | Batteries |
| `/dashboard/analytics` | Laptop Analytics |
| `/dashboard/accountability` | Accountability |
| `/dashboard/requests` | IT Asset Requests |
| `/dashboard/users` | Users |
| `/dashboard/settings` | Settings |

`/dashboard/tickets` is not a route. Do not add it.

On inventory and table pages, also confirm the table or empty state is visible. An empty inventory is a pass. A spinner that never settles is a fail.
