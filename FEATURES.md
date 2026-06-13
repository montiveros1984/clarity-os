# Clarity OS — Feature Inventory

Concise reference for what's built, where it lives, and what data it touches.
**Update this file whenever a feature is added or changed.**

---

## Global / Shell

- **PIN lock screen** — 4-digit PIN gate on app load, stored in `localStorage` (`clarity_pin`, base64). Keyboard entry supported. "Forgot PIN" resets and prompts to set a new one.
  - Quirk: PIN is obfuscated with `btoa`, not real encryption — single-user/local-trust model only.
- **Sidebar nav** (desktop) / **bottom nav** (mobile) — switches between tabs: Home, Finance, Calendar, Weekly, Bills, Goals, Income, Spending, Medications, Paycheck.
- **Topbar balance chips** — always-visible "Actual Balance" and "Year-End" (projected) balance, updated on every data change.
- **Update Balance** (sidebar footer, ⚙️) — opens a modal to set/re-anchor the opening balance. Updates the `events` row with `type='start'` (or creates one if missing), dated today.
- **Undo toast** — bottom toast with 6-second window after deleting an event, bill, goal, or category. Restores the deleted record(s).
- **Brain + Oregon wildflowers illustration** — decorative SVG in sidebar (no data).

---

## Home (Dashboard)

- Greeting + today's date (local time), Actual Balance and Year-End Projection (from `events`).
- **Upcoming Payments** widget — next 5 unchecked, future, negative-amount `events` in 2026, sorted by date. Links to Finance tab.
- **Goals Progress** widget — overall % complete + top 3 incomplete goals with progress bars (`goals` table). Links to Goals tab.
- **Medications Today** widget — today's status (taken/skip/missed/pending) per medication from `medications` + `med_logs`. Links to Meds tab.
- **Fasting Tracker, Verse of the Day, Todos Today, Habits & Streaks** — placeholder "Coming soon" cards, no data yet.

---

## Finance (Transaction Ledger) — `tab-timeline`

Core table backed by the `events` table. Columns: drag handle, ✓ (checked), Date, Label, Type, Amount, Running Balance, actions.

### Entry types (`events.type`)
- `start` — opening balance anchor (excluded from checkbox/edit-delete-by-drag flows, always type-ordered first on its date)
- `income` — money in (paychecks, etc.)
- `borrow` — money borrowed (counts as income for ordering)
- `bill` — recurring bill payment
- `critical` — recurring critical bill (rent, car payment, etc.)
- `purchase` — one-off spending
- `extra` — miscellaneous expense
- `repay` — loan repayment (expense)

### Sorting & balance logic
- Events sort by `date` first (chronological), then `events.sort_order` as a same-date tiebreaker (drag-to-reorder only affects ordering within a single date), then by type (`start` < income/borrow < everything else).
- The ledger renders two groups, each in that date order: the cleared/paid group (checked items + `start`) first, then the pending/unpaid group.
- Running balance is **computed dynamically at render time** — never stored per row — and walks rows in that exact render order, not the single date-sorted list of all events:
  - Within the cleared group, it's a cumulative sum of cleared items in date order, ending at the **Cleared Balance** shown in the collapse header.
  - The pending group's running balance continues from that Cleared Balance figure, adding each pending item's amount in date order. A past-dated pending item deducts from the Cleared Balance at the top of the pending section rather than showing an interleaved, out-of-context figure.
  - Recalculated on every insert/edit/delete/reorder.
- **Actual Balance** = sum of all `checked=true` events + the `start` event. (Equivalent to the Cleared Balance when no filters are applied.)
- **Projected/Year-End Balance** = running total after the last event in the full date-sorted list (order-independent sum, unaffected by the render-order change above).
- **Balance on date** (date picker in the ledger header) = anchor balance + sum of all transactions dated on or before the selected date (direct sum over `events`, independent of sort order).

### Forecast strip
Sits between the toolbar and filter bar; three stats side by side (stacked on mobile), recomputed on every `renderTimeline()` call from the same checked/unchecked running-balance chain (no separate calculation):
- **Cleared** — the cleared balance (same figure as the collapse header), coral if negative.
- **Lowest Point** — walks the pending (unchecked) running-balance chain in render order, shows the minimum value and its date (e.g. "−$280.13 · Jun 19"). Coral with ⚠️ if it goes below zero, green otherwise. Shows "—" if there are no pending items.
- **Next Income** — the next unchecked `income`/`borrow` event dated today or later (amount and date), or "—" if none.

### Toolbar
- **Balance on [date]** — date picker showing the computed balance as of that date.
- **📍 Today** — clears filters, shows unpaid items, scrolls to the TODAY marker row.
- **Hide/Show Paid** — collapses checked/cleared items into a single summary row.
- **+ Extend Year** — generates next year's recurring bill + ELP paycheck events (see Bills section).
- **+ Add Entry** — opens the add-entry modal.

### Filters (filter bar)
- **Search label** — substring match on `label`, case-insensitive.
- **Min amount / Max amount** — filters by `abs(amount)` range.
- **Amount =** — exact match on `abs(amount)`.
- **Month** — May–December 2026.
- **Type** — income, bill, critical, borrow, repay, extra, start.
- **Paid/Unpaid** — `checked || type==='start'` vs. not.
- **✕ Clear** — resets all of the above.

### Cleared-items collapse header
When "Hide Paid" is active, all checked/start items collapse into one row showing: count of items, total received (+), total paid out, and the running "Cleared balance" (running balance after the last cleared item) — colored coral if negative.

### Row behaviors
- Drag handle (⠿) — drag to reorder rows; sets `sort_order` for rows in the current view (tiebreaker within the same date only).
- Checkbox — toggles `checked` (marks paid/received); not shown for `start` rows.
- Negative running balance — row highlighted coral with ⚠️ warning.
- TODAY / UPCOMING marker row — inserted above the first unchecked row dated today (or the first future row if nothing is dated today).
- ✏️ Edit / 🗑️ Delete (with undo) per row.

### Add/Edit Entry modal
- Fields: Date (defaults to today, stays editable), Label, Amount (with +/− sign toggle), Type, Category (shown only for bill/critical/purchase/extra/repay/borrow types).
- **Validation**: Date, Label, Amount (must be nonzero), and Category (when applicable) are required. Empty/invalid fields are outlined in coral and block save until fixed.
- New entries auto-insert into the correct chronological position (no manual reordering needed).

---

## Calendar — `tab-calendar`

- Month grid (May–Dec 2026, navigable with ←/→), built from `events` grouped by date.
- Each day cell shows up to 3 pills (label, colored by type: income/borrow/start = green-ish, critical = red, bill = default) plus a "+N more" indicator.
- Today's cell is highlighted (`is-today`, local date).
- Clicking a day opens the **Day Panel** (slide-out): lists all events for that date with type badge, amount, and a checkbox to toggle paid (except `start`). Has its own "+ Add Entry" button pre-filled with that date.

---

## Weekly — `tab-weekly`

- Groups all `events` into Sunday–Saturday weeks (computed from `event.date`, anchored at noon to avoid timezone drift).
- Each week group is a collapsible header showing date range, total income (+), total expense (−), and net, plus a ▲/▼ toggle (state kept in memory only, not persisted).
- Expanded view shows a table of that week's transactions (✓, Date, Label, Type, Amount), sortable by date within the week, with checkbox toggle for paid status.

---

## Bills Manager — `tab-bills`

Backed by `bills` and `categories` tables.

- Bills are grouped by category (`categories`, ordered by `position`), each section showing the category's total monthly cost (active bills only).
- Each bill row shows: label, due day of month, monthly amount, type badge (bill/critical), notes toggle (📝), active/inactive switch, edit, delete.
- **+ Category** — add a new bill category.
- **+ Bill** — add a new bill (label, amount, due day, category, type bill/critical, optional notes). On save, generates events for Jun–Dec 2026 via `genBillEvents`.
- **Edit bill** (`applyBillEdit`) — updates the bill record and propagates label/amount/type/day changes to all **future unchecked** events with matching `bill_id`. Past and checked events are untouched. Changing the due day recalculates the date (same month/year, new day).
- **Toggle active** — turning a bill off deletes all future unchecked instances; turning it back on regenerates missing monthly instances for Jun–Dec 2026.
- **Notes** — per-bill freeform note, saved on blur.
- **Edit/rename/delete category** — renaming updates `cat` on all bills in that category; deleting reassigns its bills to the next remaining category (with undo).
- **Delete bill** (with undo) — removes the bill and all future unchecked events tied to it.

### Seed data (`seedIfEmpty` / `BILL_DEFS`)
- On first run with no events, seeds 5 categories (Housing, Car, Phone, Subscriptions, Living) and ~24 recurring bills (rent, electricity, internet, car payment/insurance, phone, streaming subscriptions, weekly food budgets, laundry, cat food, etc.) with their amounts/due days/types.
- `migrateIfNeeded` — if no events exist past Sep 1 2026, backfills Sep–Dec bill events and ELP paychecks (used when the schema/seed gets extended later without wiping data).

---

## Goals — `tab-goals`

Backed by `goals` table.

- **Overall Progress** bar — % of goals marked `done`.
- Each goal card: label, done checkbox, edit/delete, due date (or "No deadline"), remaining amount, progress bar (`saved`/`target`), quick "Update saved amount" input + Save button, and a freeform notes textarea (saved on blur).
- **+ Goal** — add label, target amount, saved amount, optional due date, optional notes.
- Delete has undo support.

---

## Income — `tab-income`

Two sections, both rendered by `renderIncome()`.

### Current Income Sources (`income_sources` table)
- Cards per source (e.g. "ELP Paycheck") showing: frequency, start date, next upcoming unchecked event date, total projected future income, current per-period amount, optional notes.
- **✏️ Edit Amount** — edits label/amount/frequency/start date/notes; saving propagates the new amount + label to all future unchecked `events` with matching `bill_id`.
- **🧮 Recalculate** — jumps to the Paycheck tab with this source pre-linked so "Apply" updates it directly.
- **🗑️ Remove** — deletes the source and all its future unchecked events (the built-in `elp` source cannot be removed).
- **+ Add Source** — creates a new recurring income source and generates events through Dec 31 2026 via `genELPEvents`.

### Projected / Staged Income (`income_staging` table)
- List of staged one-time or recurring income items (label, amount, expected/start date, recurrence frequency, optional note).
- **+ Add One-Time** — create a staged income item (once/weekly/biweekly/monthly/semimonthly).
- **→ Push to Timeline** — converts a staged item into real `events`:
  - Recurring: generates events from the start date through Dec 31 2026 at the chosen interval (weekly=7d, biweekly=14d; monthly/semimonthly generate a single push — `days` is null).
  - One-time: creates a single `income` event on the expected date.
  - Marks the staging row as `added=true` (shows "✓ In timeline" instead of the push button).
- ✏️ Edit / 🗑️ Delete per staged item.

---

## Spending — `tab-spending`

- Month filter (All Time / Year to Date / each month May–Dec) drives all calculations below, using local "today" for YTD.
- Considers only events with negative amounts (spending) for the chart/table, plus a separate income total for the summary chips.
- **Summary chips**: Total Outgoing, Bills & Recurring, Purchases, Total Income, Net.
- **Doughnut chart** (Chart.js) with drill-down:
  - Overview: Bills & Recurring vs. Purchases & Other vs. Income.
  - Click "Bills & Recurring" or "Purchases & Other" to drill into that group, broken down by `tx_category` (falls back to `label`, then "Uncategorized").
  - "← Back to Overview" button appears when drilled in.
- **Breakdown table**: category, transaction count, total, % of spending; drill-down link inline on the overview rows.
- **⚙️ Categories** — manage `spend_categories` table (add/delete spending categories used for `tx_category` tagging).

---

## Medications — `tab-meds`

Backed by `medications` and `med_logs` tables.

- **Today's status cards** — one per medication:
  - Shows schedule text (Daily/every hour 7am–9pm, or "Every [Day] · every 3hrs 8am–9pm" for weekly meds).
  - Status badge: ✅ Taken (with time), ⏭️ Skipped, ❌ Missed, ⏳ Pending, or "📅 Due [Day]s" / "—" if not relevant today.
  - Action buttons: "Mark Taken" (opens time picker modal), "Skip", "Log as Taken" (if missed), "✏️ Edit Time"/"✏️ Correct" (if already logged).
- **+ Add Med** — name, frequency (daily/weekly), reminder day (if weekly), optional notes. Sets default `reminders` array (hourly 7am–9pm for daily; every 3hrs 8am–9pm for weekly).
- **✏️ Edit Med** — edit name/frequency/day/notes.
- **30-Day History grid** — per medication, last 30 days (or last 4 relevant weekdays for weekly meds) shown as colored dots/squares:
  - Teal = Taken, light purple = Skipped, red = Missed, light pink = Future (not clickable), pale pink = No log (clickable to add).
  - Clicking a past/today dot opens a log modal to set status + time for that date.
- Legend explaining dot colors.

---

## Paycheck — `tab-paycheck`

- Stateless calculator (no DB writes on calculate).
- Inputs: Hourly Rate, Hours Per Period, Filing Status (Head of Household / Single), W-4 Dependent Credit.
- **Calculate** — computes gross pay (rate × hours × 26 periods/yr basis), federal income tax (bracket table minus dependent credit), CA state tax (bracket table minus exemption), Social Security (6.2%), Medicare (1.45%), CA SDI (1.1%), total withheld, take-home pay, and effective tax rate.
- **Apply to All Future ELP Checks** — updates `amount` on all future unchecked `events` for the target income source (the one navigated from via "🧮 Recalculate" in Income, or `elp` by default), and updates the corresponding `income_sources.amount`.
- **Reset** — restores default inputs (rate 42, hours 80, HOH, $7,100 credit).

---

## Extend Year (Finance toolbar)

- Detects the latest year present in `events`, offers to generate the next year.
- Generates: all active bills' monthly events for every month of the new year (skipping months that already have an event for that `bill_id`), and continues ELP biweekly paychecks from the last existing ELP date through Dec 31 of the new year.
- Batched inserts (25 rows at a time) into `events`, then reloads all data.

---

## Known Quirks / Notes

- All dates are stored as `YYYY-MM-DD` strings; "today" is computed from **local** time (`localDateStr`), not UTC.
- `events.sort_order` only breaks ties for same-date events — cross-date drag reordering has no lasting effect on chronological order.
- Seed data and several generators (bills, ELP, extend year) are hardcoded around the 2026 calendar year.
- Weekly view's open/closed state and Spending chart drill-down state are in-memory only (`S.openWeeks`, `S.chartDrill`) — reset on page reload.
- Loans tracker (`loans`/`loan_payments` tables) is designed but not yet built — no UI tab exists yet.
