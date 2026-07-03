---
name: SplitEasy settlement tracking design
description: How settlement records interact with expense balances in the expense-splitter artifact
---

Settlement records (payer, receiver, amount, date, notes, status) are stored separately from expenses and never mutate expense data. Balances are computed in two layers:

1. `rawBalances` = `calculateBalances(participants, expenses)` — raw expense-only paid/owed/balance.
2. `balances` = `applySettlements(rawBalances, event.settlements)` — net balances after recorded payments (payer's balance +amount, receiver's balance -amount).
3. `calculateSettlements(balances)` (the minimum-transaction suggestion algorithm) then runs on the **net** balances, so the "pending" suggestion list automatically shrinks/changes as payments are recorded — no manual removal/reconciliation logic is needed.

**Why:** This keeps the minimum-transaction settlement algorithm untouched and reusable, avoids double-bookkeeping between "expenses" and "payments already made," and makes partial payments, undo, and edits trivially correct (just recompute from the settlement records list, no derived state to keep in sync).

**How to apply:** Any new feature that affects who-owes-whom in this app should add/adjust entries in `event.settlements` (or `event.expenses`) and let the derived balances/settlements recompute — do not try to directly edit a "pending settlement" as if it were a stored entity, since pending settlements are always derived, not stored.
