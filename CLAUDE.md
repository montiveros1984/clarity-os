# Clarity OS — Project Documentation

## Project Description
Clarity OS is a personal life operating system built for Maria. It's a single-user web dashboard that manages finances, health, habits, goals, and daily life in one place. It runs as a static HTML app hosted on Netlify, with Supabase as the backend database.

**Live URL:** https://myclarityos.netlify.app/dashboard.html
**GitHub:** https://github.com/montiveros1984/clarity-os
**Local file:** `C:\Users\maria\OneDrive\Documents\GitHub\clarity-os\dashboard.html`

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

### Key columns to know:
- `events.bill_id` — links event to a bill template or income source ('elp', bill id, etc.)
- `events.sort_order` — user-defined drag order (0 = date-based sort)
- `events.tx_category` — spending category tag
- `events.checked` — marks as paid/received (affects Actual Balance)
- `income_sources.frequency` — biweekly/weekly/monthly/semimonthly

---

## What's Been Built

### 💰 Finance Tracker
- Full transaction ledger with running balance
- Actual balance (checked items) vs Projected year-end balance
- Income sorts before expenses on same day
- Going negative highlights in coral with ⚠️ warning
- Collapse paid/cleared items into summary bar with carry-forward balance
- TODAY marker in timeline
- Balance on any date picker
- Jump to Today button
- Drag to reorder rows (sort_order column)
- Filter by: label search, amount range, month, type, paid/unpaid
- Calendar view (May–Dec 2026, navigable)
- Weekly view with collapsible week groups
- Bills manager — 24 recurring bills, organized by category, with notes
- Goals tracker — progress bars, quick-save, notes, undo on delete
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
- [ ] Loans tracker (borrow/lend with in-kind payments, reminders)
- [ ] Income tab fully wired (ELP source linked, recurring projected income)

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
- [ ] Drag to reorder timeline (built, needs testing)
- [ ] Better home dashboard widgets (more live data)
- [ ] Push notifications (web push API)

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
- **Actual Balance** = sum of all events where `checked=true` OR `type='start'`
- **Projected Balance** = running sum of ALL events sorted by date
- **Running Balance** column = cumulative sum as you scroll through sorted events

### Event Sort Order
1. If `sort_order > 0`: sort by sort_order (user-defined via drag)
2. Otherwise: sort by date, then income/borrow before expenses on same day

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

## User Info
- **Name:** Maria
- **Location:** California (Pacific time — America/Los_Angeles)
- **Phone:** +15106881814
- **Filing status:** Head of Household
- **Hourly rate:** $42/hr, 80hr biweekly, $7,100 W-4 dependent credit
- **ELP start:** June 26, 2026
