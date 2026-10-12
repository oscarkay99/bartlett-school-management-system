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
- The general ledger and trial balance are derived (`generalLedger()`), and tested to balance and to reconcile to the fee subledger.
- Role-based nav and field-level medical gating are UI mirrors only; real enforcement belongs on the server.
- "Preview as role" lives in the avatar menu.

## Demo scenarios
- Ama Mensah (Primary 5): GHS 3,500 billed, 2,000 paid, 1,500 outstanding. Her guardian also has Kofi and Abena (consolidated reminder, one parent account).
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
