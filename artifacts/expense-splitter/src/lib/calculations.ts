import { Participant, Expense } from "./storage";

export interface ParticipantBalance {
  id: string;
  name: string;
  totalPaid: number;
  totalOwed: number;
  balance: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function getExpensePayments(expense: Expense): Record<string, number> {
  const map: Record<string, number> = {};

  if (expense.paymentMethod === "multiple") {
    expense.payments.forEach((p) => {
      map[p.participantId] = (map[p.participantId] || 0) + p.amount;
    });
    return map;
  }

  if (expense.paidBy) {
    map[expense.paidBy] = expense.amount;
  }
  return map;
}

export function getExpenseShares(expense: Expense): Record<string, number> {
  const shares: Record<string, number> = {};
  const participantIds = expense.participantIds;
  if (participantIds.length === 0) return shares;

  if (expense.splitMethod === "percentage") {
    participantIds.forEach((id) => {
      const p = expense.participants.find((ep) => ep.id === id);
      const pct = p?.percentage || 0;
      shares[id] = (expense.amount * pct) / 100;
    });
  } else {
    const share = expense.amount / participantIds.length;
    participantIds.forEach((id) => {
      shares[id] = share;
    });
  }

  return shares;
}

export function calculateBalances(participants: Participant[], expenses: Expense[]): ParticipantBalance[] {
  const paidMap = new Map<string, number>();
  const owedMap = new Map<string, number>();

  participants.forEach((p) => {
    paidMap.set(p.id, 0);
    owedMap.set(p.id, 0);
  });

  expenses.forEach((expense) => {
    const payments = getExpensePayments(expense);
    Object.entries(payments).forEach(([id, amount]) => {
      if (paidMap.has(id)) {
        paidMap.set(id, (paidMap.get(id) || 0) + amount);
      }
    });

    const shares = getExpenseShares(expense);
    Object.entries(shares).forEach(([id, amount]) => {
      if (owedMap.has(id)) {
        owedMap.set(id, (owedMap.get(id) || 0) + amount);
      }
    });
  });

  return participants.map((p) => {
    const totalPaid = paidMap.get(p.id) || 0;
    const totalOwed = owedMap.get(p.id) || 0;
    return {
      id: p.id,
      name: p.name,
      totalPaid,
      totalOwed,
      balance: totalPaid - totalOwed,
    };
  });
}

export function calculateSettlements(balances: ParticipantBalance[]): Settlement[] {
  const debtors = balances
    .filter((b) => b.balance < -0.01)
    .map((b) => ({ ...b, balance: Math.abs(b.balance) }))
    .sort((a, b) => b.balance - a.balance);
  const creditors = balances
    .filter((b) => b.balance > 0.01)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance);

  const settlements: Settlement[] = [];

  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];

    const amount = Math.min(debtor.balance, creditor.balance);

    if (amount > 0.01) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount,
      });
    }

    debtor.balance -= amount;
    creditor.balance -= amount;

    if (debtor.balance < 0.01) d++;
    if (creditor.balance < 0.01) c++;
  }

  return settlements;
}

export function distributeEqually(total: number, count: number): number[] {
  if (count <= 0) return [];
  const rounded = Math.round(total * 100) / 100;
  const base = Math.floor((rounded / count) * 100) / 100;
  const results = new Array(count).fill(base);
  const distributed = Math.round(base * count * 100) / 100;
  const remainder = Math.round((rounded - distributed) * 100) / 100;
  results[results.length - 1] = Math.round((results[results.length - 1] + remainder) * 100) / 100;
  return results;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
