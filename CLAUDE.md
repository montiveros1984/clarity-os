# Clarity OS — Project Documentation

## Project Description
Clarity OS is a personal life operating system built for Maria. It's a single-user web dashboard that manages finances, health, habits, goals, and daily life in one place. It runs as a static HTML app hosted on Netlify, with Supabase as the backend database.

**Live URL:** https://myclarityos.netlify.app/dashboard.html
**GitHub:** https://github.com/montiveros1984/clarity-os
**Local file:** `C:\Users\maria\OneDrive\Documents\GitHub\clarity-os\dashboard.html`

**Update FEATURES.md whenever a feature is added or changed.**

---

## Model Preference
- **Haiku** — simple edits, CSS tweaks, small bug fixes, single-function changes
- **Sonnet** — complex features, new tabs, database design, multi-file changes, architecture decisions

---

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JavaScript (single file: `dashboard.html`)
- **Database:** Supabase (PostgreSQL) — no auth, RLS disabled, single user
- **Hosting:** Netlify (auto-deploys from GitHub main branch)
- **APIs:** Twilio (SMS reminders), Claude API (future: smart inbox)
- **Charts:** Chart.js (CDN)
- **Auth:** PIN screen (4-digit, stored in localStorage via btoa)

---

## File Structure
```
clarity-os/
├── dashboard.html          # The entire app — HTML + CSS + JS
├── brain-flowers.jpg       # Oregon wildflower brain art (background image)
├── netlify.toml            # Netlify build config
├── README.md
└── netlify/
    └── functions/
        ├── med-check.js    # Scheduled hourly medication reminder (cron)
        └── med-reply.js    # Twilio webhook — handles TAKEN/SKIP replies
```

---

## Database Tables (Supabase)

| Table | Purpose |
|-------|---------|
| `events` | All financial transactions (income, bills, purchases, etc.) |
| `bills` | Recurring bill templates |
| `categories` | Bill categories (Housing, Car, Phone, etc.) |
| `goals` | Savings goals with progress tracking |
| `income_staging` | Projected/staged income before pushing to timeline |
| `income_sources` | Recurring income sources (ELP paycheck, etc.) |
| `spend_categories` | Spending categories for transaction tagging |
| `medications` | Medication schedules and reminder configs |
| `med_logs` | Daily medication taken/skipped/missed log |
| `loans` | Personal loans — borrowed or lent, with person/amount/direction |
| `loan_payments` | Repayments (cash or in-kind) against a loan |

### Key columns to know:
- `events.bill_id` — links event to a bill template or income source ('elp', bill id, etc.)
- `events.sort_order` — drag order, used only as a same-date tiebreaker (ledger always sorts by date first, then sort_order, then type)
- `events.tx_category` — spending category tag
- `events.checked` — marks as paid/received (affects Cleared Balance)
- `events.processing` — marks a pending (unchecked) event as "in progress" (see Ledger Processing State below)
- `income_sources.frequency` — biweekly/weekly/monthly/semimonthly
- `goals.in_cashflow` — whether the goal has a linked entry in the finance timeline (see Goals → "Include in Cash Flow" below)
- `goals.cashflow_event_id` — id of the linked `events` row when `in_cashflow=true`, else null

### Pending manual migration (Supabase SQL editor)
`in_cashflow` and `cashflow_event_id` on `goals`, and `processing` on `events`, aren't provisioned yet — the app writes to them via the normal anon Supabase client, which can't run DDL, so they must be added once by hand:
```sql
ALTER TABLE goals ADD COLUMN IF NOT EXISTS in_cashflow boolean DEFAULT false;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS cashflow_event_id text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS processing boolean DEFAULT false;
```
Until the goals columns run, the "Include in Cash Flow" toggle writes fail silently (errors are logged to console, not shown to the user) and the toggle state won't persist across reloads. Until the `events.processing` column runs, the ledger's "P" (processing) button writes fail silently the same way — the button will appear to toggle in the UI for the current session but won't persist across reloads.

---

## What's Been Built

### 💰 Finance Tracker
- Full transaction ledger with running balance, recalculated dynamically at render time (top-to-bottom, anchor balance + sums) — never stored per-row
- New entries auto-insert at the correct chronological position (events always sort by date first, sort_order only breaks ties within the same date)
- "Balance on date" = anchor balance + sum of all transactions on/before the selected date
- Amount filter (exact match on absolute value) alongside label/min/max/month/type/paid filters
- Add/Edit Entry form requires date, name, amount (nonzero), and category (when applicable) — invalid fields highlight in coral and block save
- Quick-entry bar — persistent inline row (Date, Label, Amount, +/− sign, Type, Category, Save) between the filter bar and ledger table; Label/Type/Category use an inline autocomplete dropdown that inline-completes the typed text (e.g. "fo" → "Food & Dining" with "od & Dining" pre-selected so Tab accepts it) and repositions itself via `getBoundingClientRect()` on every scroll/resize so it never detaches from its field; reuses the same insert function as the Add Entry modal
- Quick-entry label autocomplete — Label field autocompletes against distinct past event labels (derived from the already-loaded events cache, rebuilt on load and after each save — no extra Supabase round-trip); dropdown options are rendered as real DOM nodes with event listeners (not inline `onclick` strings), so labels containing apostrophes (e.g. "Trader Joe's") don't break the dropdown
- Quick-entry type default — Type field pre-fills with "purchase"; tabbing/Entering past it accepts the default without opening the dropdown, arrow-down or click opens the full type list for picking something else
- Quick-entry sign toggle — +/− button right after Amount (defaults to −, flips on click/Space/Enter); Amount holds an unsigned magnitude and the toggle decides the sign, resetting to − after each save
- Quick-entry duplicate warning — on Amount blur, flags a possible duplicate (same date, exact signed amount, label contains current label text, type not bill/critical) with an inline note below Amount; informational only, doesn't block save
- Quick-entry status buttons — "P" (Processing) and "✓" (Cleared) buttons sit before Save, in tab order; native button behavior means Space/Enter while one is focused toggles it via its `onclick`. Mutually exclusive (activating one deactivates the other), both off by default. On save: P active → `processing=true, checked=false`; ✓ active → `checked=true, processing=false`; neither → both false (plain pending). Both reset to off after each save, same as the sign toggle.
- Sticky ledger header — toolbar row, forecast strip, filter bar, and quick-entry bar are wrapped in a sticky container (`#timelineStickyHdr`) that pins below the global topbar (offset synced to the topbar's live height via a `--topbar-h` CSS var, so it doesn't overlap the balance chips) while the ledger table scrolls underneath
- Cleared balance (checked items) vs Actual balance (cleared + processing) vs Projected year-end balance — three topbar chips in that order
- Ledger Processing state — a small "P" button next to edit/delete on each pending (unchecked) row toggles `events.processing`; the ledger renders three groups top to bottom — Cleared (collapsible, unchanged) → a "Processing" divider row → Processing items → TODAY marker → Pending items — and the running balance chain walks through all three groups in that order. Checking an event's main checkbox (moving it to Cleared) automatically clears its `processing` flag.
- Ledger running balance under filters — running balance (and the collapsed "Cleared balance" figure) is always computed once from the complete, unfiltered event list, grouped Cleared → Processing → Pending; active filters (label/amount/month/type/paid) only decide which already-computed rows are displayed. Each visible row shows its real running balance from the full ledger, never a balance recomputed from just the filtered subset.
- Income sorts before expenses on same day
- Going negative highlights in coral with ⚠️ warning
- Collapse paid/cleared items into summary bar with carry-forward balance
- TODAY marker in timeline
- Balance on any date picker
- Jump to Today button
- Drag to reorder rows (sort_order column)
- Filter by: label search, amount range, month, type, paid/unpaid
- Forecast strip above the filter bar — Lowest Point (min pending running balance + date) and Next Income (next unchecked income/borrow on or after today), evenly split
- Calendar view (navigable, defaults to current local month/year)
- Weekly view with collapsible week groups
- Bills manager — 24 recurring bills, organized by category, with notes
- Goals tracker — progress bars, quick-save, notes, undo on delete; goal cards sort by due date ascending, goals with no due date sort last
- Goals → "Include in Cash Flow" toggle — per-goal toggle on each goal card; disabled (grayed out, with a "Set a due date to include in cash flow" note) when the goal has no due date. Toggling on creates a single `events` row (date = goal due date, label = goal name, amount = -(target − saved), type `extra`, category `Goals`) and stores its id on `goals.cashflow_event_id`; toggling off deletes that event and clears the id. Editing a toggled-on goal's saved amount or due date updates the linked event in place (via `syncGoalCashflow`) instead of creating a duplicate; clearing the due date while toggled on auto-disables the toggle and removes the event.
- Income tab — current income sources (ELP) + projected staging
- Paycheck estimator — federal + CA taxes, W-4 dependent credit, HOH/Single
- Spending analysis tab — pie chart with drill-down, YTD filter
- Extend Year button — generates next year's events
- Undo on deletes (6 second window)
- Confirm on destructive actions

### 💊 Medications
- Daily Meds — hourly reminders 7am–9pm via Twilio
- Monjaro + Vit D — every 3hrs on Mondays 8am–9pm via Twilio
- Reply TAKEN [time] or SKIP to log (e.g. "TAKEN 7:30am")
- 30-day history grid (weekly meds show only relevant days)
- Log/correct past dates by clicking history dots
- Add/edit/delete medications from dashboard
- Netlify scheduled function runs hourly check

### 🔒 Security
- PIN screen on app open (4-digit, set on first use)
- Forgot PIN option
- Keyboard support for PIN entry

### 🎨 Design
- Light theme with brain-flowers.jpg as full background
- Glassmorphism cards (frosted white with backdrop blur)
- Oregon wildflower brain image in sidebar
- Flower accents on cards via CSS ::after
- Left sidebar navigation (desktop)
- Bottom navigation (mobile)
- Home dashboard with live widgets
- Sunset color palette: coral, pink, lavender, teal, gold

---

## What's Still Pending

### Finance
- [ ] Loans tracker — borrow/lend with in-kind payments (e.g. "Mom deducted a fan from what I owe her"), reminders when due. SQL tables ready: `loans`, `loan_payments`. Needs tab built.
- [ ] Twilio webhook fully wired — need to set webhook URL in Twilio console to `https://myclarityos.netlify.app/api/med-reply`

### Core Modules
- [ ] Todos & lists (grocery, shopping, general)
- [ ] Habits & streaks tracker
- [ ] Fasting tracker (start/stop, duration, history)
- [ ] Bible study tracker
- [ ] Vocabulary study (flashcards)
- [ ] Notes (general notes section)
- [ ] Bucket list (mini 1-2yr + life goals)

### Integrations
- [ ] Outlook calendar sync (Microsoft Graph API)
- [ ] Microsoft Todo sync
- [ ] Smart inbox (Telegram bot → AI filing)
- [ ] Daily SMS with todos (Twilio scheduled)
- [ ] Verse of the day (with context + real-life application)
- [ ] Macro/food tracking (AI estimates from description)

### Health
- [ ] Fasting tracker
- [ ] Medication reminders → Twilio webhook fully wired (Twilio console setup pending)

### UX
- [ ] Better home dashboard widgets (more live data, more visual)
- [ ] Push notifications (web push API)
- [ ] Floral/artistic design pass (Maria wants Oregon wildflowers more prominent, glassmorphism cards over brain-flowers.jpg background — partially done)

---

## Environment Variables (Netlify)
```
TWILIO_SID      = [see Twilio console — Account SID]
TWILIO_TOKEN    = [see Twilio console — Auth Token]
TWILIO_FROM     = +18559425037
MY_PHONE        = +15106881814
SUPA_URL        = https://rbkyuhsqpkeikiyncuez.supabase.co
SUPA_KEY        = [see Supabase project — anon public key]
```

---

## Deployment Workflow
1. Edit `dashboard.html` in `C:\Users\maria\OneDrive\Documents\GitHub\clarity-os\`
2. Open GitHub Desktop
3. Type a summary, click **Commit to main**
4. Click **Push origin**
5. Netlify auto-deploys in ~30 seconds

---

## Key Business Logic

### Balance Calculation
- **Cleared Balance** = sum of all events where `checked=true` OR `type='start'`
- **Actual Balance** = Cleared Balance + sum of unchecked events where `processing=true`
- **Projected Balance** (Year-End) = running sum of ALL events sorted by date (checked, processing, and pending alike) — unchanged by the processing state
- **Running Balance** column = cumulative sum as you scroll through sorted events; in the ledger it's computed by walking Cleared → Processing → Pending in that order, so the figure at the bottom of each group carries into the next

### Event Sort Order
1. If `sort_order > 0`: sort by sort_order (user-defined via drag)
2. Otherwise: sort by date, then income/borrow before expenses on same day
3. In the ledger specifically, events are also grouped by state (Cleared → Processing → Pending) before the above ordering is applied within each group

### Bill Updates
- Editing a bill updates all future **unchecked** events with matching `bill_id`
- Past events and checked events are never touched
- Toggling off removes all future unchecked instances
- Toggling on regenerates missing monthly entries

### ELP Paycheck
- Stored as events with `bill_id = 'elp'` and as an income_source record
- Biweekly Fridays starting Jun 26, 2026
- Update via: Income tab → Edit Amount OR Paycheck tab → Calculate → Apply
- Apply button updates all future unchecked ELP events + income_source record

---

## Loans Tracker — Design Spec (pending build)

### Use Case
Maria borrows money from her mom or lends to her daughter. Repayments can be:
- **Cash** — "paid back $100"
- **In-kind** — "Mom said grab me a fan, deducted $45 from what I owe her"
- Works both directions (Maria owes someone, or someone owes Maria)

### Data Model (tables already created in Supabase)
```
loans: id, label, person, direction ('i_owe'|'they_owe'), original_amount, date, notes, reminder_date, paid_off
loan_payments: id, loan_id, amount, date, payment_type ('cash'|'in_kind'), description
```

### UI (needs to be built as a new tab "Loans" in the sidebar)
- Two sections: "I Owe" and "They Owe Me"
- Each loan card shows: person, original amount, total paid, remaining balance, paid off status
- Payment log per loan (expandable)
- Add payment button — cash amount OR in-kind description + dollar value
- Reminder date → Twilio SMS reminder when due
- Paid off toggle
- Undo on delete

### Timeline Integration
- When a loan is created, optionally create a `borrow` or `income` event in the finance timeline
- When a repayment is logged, optionally create a `repay` or `purchase` event in the timeline

---

## User Info
- **Name:** Maria
- **Location:** California (Pacific time — America/Los_Angeles)
- **Phone:** +15106881814
- **Filing status:** Head of Household
- **Hourly rate:** $42/hr, 80hr biweekly, $7,100 W-4 dependent credit
- **ELP start:** June 26, 2026
