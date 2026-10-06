# Cilantro Operations: kitchen operations dashboard (prototype)

A clickable React + TypeScript prototype that answers one question for kitchen operations:
**what needs attention, where, why, and what should happen next?**

All data is fictional demo data. The app has no backend and no SAP connection, and it sends nothing. Local actions (assign, note, acknowledge, resolve and so on) are saved only in this browser's `localStorage`. **No email, WhatsApp message or reminder is ever sent.**

The source brief was the internal Cilantro playbook. It was used as reference material only and is **not included** in this repository.

## Demo limitations
- Fictional mock data only (3 sites, 8 cafes). The data covers **13–14 Oct 2026**; other dates show "Data unavailable".
- No backend, SAP connection, authentication or roles. Actions are saved only in your browser's `localStorage`.
- **Nothing is sent.** No email, WhatsApp message or reminder exists in this prototype.
- Rules tagged *Proposed* or *Needs verification* are not confirmed Cilantro behaviour (see below).
- This is a prototype and is not deployed anywhere.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (or the next free port)
npm test           # 16 unit tests for the derivation logic (vitest)
npm run build      # type-check + production build into dist/
npm run lint       # oxlint
```

Requires Node 20+. The demo clock is fixed at **Tue 13 Oct 2026, 13:30**, so "overdue", "late" and "today" stay stable whatever day you open the app.

**Demo settings** (bottom of the left sidebar) holds the configurable "unusual change" threshold and **Reset demo data**, which clears local actions and restores the snapshot.

## Screen structure

A collapsible left sidebar (212 px, or 60 px icons-only; off-canvas with a menu button below 900 px) switches between five views. The active view is kept in the URL hash (`#overview`, `#exceptions`, `#changes`, `#planning`, `#data`). Filters persist across views.

A compact top bar holds the view title, a *Demo* badge, the last-updated time, and filters for site, cafe, service date and meal. The cafe list depends on the site, and an invalid cafe resets when the site changes. The projection-week filter appears only in Planning & progress.

| View | What it shows | Interaction |
|---|---|---|
| **Overview** | 4 cards with denominators: Preparation ready · Orders pending (overdue vs pending) · Critical issues · Late changes. A site/cafe table (Site / cafe, Status, Current blocker + "+N issues", Owner, Due, View), with *All sites* showing site summaries and a selected site showing its cafes. Top 5 priority issues and a recent-changes preview | Cards filter the table or open Exceptions/Change log. The table has a quick filter, search and **CSV** export of the visible rows. Rows open the detail drawer; the readiness definition is in the ⓘ tooltip |
| **Exceptions** | All issues as compact rows (severity, title, site/cafe, owner, due, status) plus the ingredient-request review summary | Severity/status/stage filters; all actions live in the drawer |
| **Change log** | Table: Time, Site / cafe, Change, Old → new, Changed by, Acknowledgment | Filters (late & unacknowledged, no reason, unusual); click a row for details, reason and per-team acknowledgment |
| **Planning & progress** | *Weekly planning* (menu publication, selection, projection) for the chosen projection week with a per-cafe planning table, and *Daily progress* for the service date | Week selector; every stage, cafe and issue row opens a drawer; stage drawers offer a labelled filter action |
| **Data status** | Data source availability, definitions & caveats, glossary, cutoffs by site with provenance | — |
| **Detail drawer** | Site: its cafes plus daily and weekly stage progress. Cafe: stage × meal grid, projection vs MR/EMR per dish, related items. Issue: evidence, ingredient impact, timeline. Change: reason form, acknowledgments | Assign, note, record reason, acknowledge, In progress, resolve (closure note required), reopen. Back button for nested items; Escape closes; focus is trapped and then restored |

Caveats live in tooltips, the drawer and Data status rather than banners on Overview. Exceptions are never hidden.

### Record rules the UI enforces
- **Weekly projection ≠ daily MR/EMR.** They are separate fields and an MR change never alters the projection (Floor 8: projection 40 kg, MR 400 kg).
- **Export ≠ issued/delivered.** "Exported" stays "receipt not confirmed" until a store acknowledges it. Unknown dispatch shows **Data unavailable** and never "Delivered".
- **Saved ≠ published.** Draft menus and projections are shown as such and don't count as complete.
- **Missing recipe or article mapping ⇒ incomplete.** Ingredient and cost estimates say *incomplete* and give the reason instead of showing a partial number as a total.
- **Acknowledge ≠ resolve.** Acknowledging records that someone has seen the issue; only *Resolve* with a closure note closes it.
- **Readiness** = menu publication, selection, final order, production plan and ingredient request all complete for every meal the cafe serves. Closed cafes are excluded from the denominator. Store handoff and dispatch are tracked but not required, because their data is partly unavailable.

## Exception scenarios covered

The data covers 13–14 Oct 2026 and projection weeks W42/W43. Other dates show "Data unavailable for this date in the demo" rather than zeros.

| # | Scenario | Where to see it | Detection |
|---|---|---|---|
| 1 | Menu saved but not republished | ISS-107 Harbour snacks | Existing (Saved vs Published) |
| 2 | One cafe missing selection while another at the site is complete | ISS-113 Floor 11, W43 | Proposed |
| 3 | Projection not submitted before the local cutoff | ISS-114 Tower A, W43 | Lock existing; alert proposed |
| 4 | MR missing for tomorrow | ISS-103 Atrium lunch | Proposed |
| 5 | 40 kg → 400 kg with no reason | ISS-101 / CHG-201 | Proposed demo check (configurable threshold) |
| 6 | Legitimate cancellation to zero | Tower A lunch Paneer 45 → 0 kg, with reason, **no issue raised** | — |
| 7 | Approved EMR after the production export | ISS-102 Dal Makhani | Proposed |
| 8 | Late change after the ingredient request | ISS-108 Paneer, Harbour Main | Proposed |
| 9 | Dish without a recipe | ISS-111 Millet Upma | Existing (kitchen indent) |
| 10 | Missing article mapping | ISS-105 frozen coconut | Existing |
| 11 | Same item via CPU and stock transfer | ISS-112 Paratha | Proposed |
| 12 | Substitution written in remarks | ISS-104 | Proposed |
| 13 | Export outdated after an approved change | ISS-110 Executive Dining | Proposed |
| 14 | Custom "Other" dish | ISS-109 | EMR entry existing; follow-up proposed |
| 15 | Store handoff exported but receipt unconfirmed | ISS-106 Floor 11 | Proposed |
| 16 | Dispatch status unavailable | ISS-115 Tower A, today | Proposed manual confirmation |
| 17 | Closed cafe / meal not served | Tower B closed 14 Oct, plus non-served meals | No alert, shown as Not applicable |

ISS-116 (late breakfast MR, already resolved) shows the resolved state and its timeline.

## Demo assumptions
- The 3 sites, 8 cafes, people, dishes, recipes and quantities are all fictional.
- Cutoffs are tagged per site: **Existing** where the playbook gives them (e.g. Hyderabad projection Wed 18:00, MR D−1 12:00, export schedule), **Needs verification** where they are demo assumptions, and **Proposed** for store-handoff acknowledgment.
- The unusual-change threshold defaults to ≥ 50 % **and** ≥ 20 kg (kg-to-kg only). It is a demo setting; no tolerance has been agreed.
- Recipe ratios are per 10 kg finished weight. Finished weight ≠ raw weight (360 kg cooked rice → 108 kg raw). Quantities are compared only when units match; pax ↔ kg conversions flag fractional pax.
- "Demo user" stamps local actions at the demo clock time.

## Proposed features (not existing Cilantro behaviour)
Expected-coverage view per site · MR timeliness and missing-MR alerts · unusual-change check · EMR-after-export and change-after-indent checks · export versioning with an "outdated" flag · store receipt acknowledgment per export version · per-team acknowledgment of late changes · manual dispatch confirmation · duplicate-route (CPU + stock transfer) check · remark-substitution check · issue owners, due times and closure notes.

## Business decisions and integrations still needed
From playbook §9 — kept open, not assumed:

| Area | Needs confirmation |
|---|---|
| Planning | Copy merge/overwrite rules, publication versions, colour legend |
| Permissions | Role matrix; who may assign, acknowledge, resolve |
| Quantities | UOM conversions, pax rounding, meal-count formula, **variance tolerance** for the unusual-change check |
| Exceptions | Replace/cancel/duplicate and approval-record behaviour |
| Production | Refresh semantics, export diffs, **change acknowledgment** |
| Partial work | Successful baseline, reductions, cancellations, repeated submissions |
| Costs | Revenue source, COGS denominator, total scope |
| Data sync | Timing, failures, retries, downstream availability |
| Surveillance | Service calendars (closed days), **alert channels**, response deadlines, escalation owners |
| Nutrition | Article-level nutrition, allergens, carbon |
| Integration | Inventory access, SAP evidence (issued/received), dispatch actuals, future automation |

To go live, it would also need: a read API or extract for menus, MR/EMR, exports and indents; a service-calendar source; store receipt and dispatch capture; identity and roles; and a server-side store for actions instead of `localStorage`.

## Code map
```
src/data/       types, demo clock, masters (sites, cafes, cutoffs, recipes), operations (lines, issues, changes)
src/lib/        derive.ts (all status/summary logic, unit-tested), ingredients.ts, store.ts (reducer + localStorage), csv.ts
src/components/ Shell (sidebar, top bar, demo settings), Overview (summary cards), StatusTable (site/cafe table, row status + blocker),
                Lists (issue rows, change log, planning, stage rows), Drawer (site/cafe/issue/change), DataStatus, ui
src/App.tsx     view routing (hash), filters, drawer stack, card → view navigation
```
