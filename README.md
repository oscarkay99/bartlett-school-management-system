# EduFlow — School Management System (front end)

Next.js 16 (App Router) · TypeScript · Tailwind v4 · Recharts. Default context: Ghana, GHS, Africa/Accra.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # business-rule tests against the data layer
npm run typecheck && npm run lint && npm run build
```

## Status: front end only
No backend, database or auth yet. All data is a deterministic, seeded in-memory dataset.
Nothing persists: dialogs and forms validate and give feedback, but writes are local to the session.

## Backend seam
- `src/lib/data/queries.ts` is the **only** place pages read data. Replace its functions with API/DB calls.
- `src/lib/data/seed.ts` is demo data only; delete it when the backend lands.
- Money is integer minor units (`src/lib/money.ts`). Balances are always *derived* from invoices + confirmed payments, never stored.
- Three separately billed accounts (`src/lib/accounts.ts`): **School Fees** (tuition, books, levies, exams, boarding), **Feeding**, and **Extracurricular** (Music (Piano), STEM, Extra Classes). Each has its own invoices (`INV-` / `FDG-` / `EXC-`), receipts (`RCT-` / `FRC-` / `XRC-`) and balance; a payment only settles its own account.
- The general ledger and trial balance are derived (`generalLedger()`), and tested to balance and to reconcile to the fee subledger.
- Role-based nav, the route guard, money visibility (`full` / `balances` / `none` in `src/lib/permissions.ts`) and field-level medical gating are UI mirrors only; real enforcement belongs on the server.
  The School Administrator sees who owes and can send reminders, but not collections, revenue or finance dashboards. The Accountant records payments and issues invoices/receipts for all three accounts.
- "Preview as role" lives in the avatar menu.

## Demo scenarios
- Ama Mensah (Primary 5): school fees GHS 3,500 billed, 2,000 paid, 1,500 outstanding. Separately: feeding GHS 600 (300 paid) and Music (Piano) GHS 400 (unpaid). Her guardian also has Kofi and Abena (consolidated reminder, one parent account).
- English Textbook: 100 received, 20 issued, 80 on hand.

## Branches & workflow
| Branch | Purpose |
| --- | --- |
| `development` | Day-to-day work. Local changes are **auto-committed here** (see below). |
| `testing` | QA. QA work and fixes are pushed here; promote from `development` by merging. |
| `main` | Released, known-good code. Only updated by merging from `testing`. |

Flow: `development` → `testing` → `main`.

Auto-commit: `.claude/settings.json` registers a Claude Code `Stop` hook that runs `scripts/auto-commit.sh`
after each Claude turn. It commits only when the current branch is `development`; on `testing` or `main`
nothing is committed automatically. Edits made outside Claude Code are not auto-committed.

## QA site (GitHub Pages)
Every push to `testing` runs `.github/workflows/deploy-qa.yml`: typecheck → lint → tests → static export → publish.
URL: https://oscarkay99.github.io/bartlett-school-management-system/

To reproduce the Pages build locally:
```bash
GITHUB_PAGES=true NEXT_PUBLIC_BASE_PATH=/bartlett-school-management-system npm run build   # outputs ./out
```
The QA site is a static front end with generated demo data only: no real student or financial data belongs in it.
