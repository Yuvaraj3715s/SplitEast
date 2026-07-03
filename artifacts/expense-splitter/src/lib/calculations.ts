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

export function calculateBalances(participants: Participant[], expenses: Expense[]): ParticipantBalance[] {
  const paidMap = new Map<string, number>();
  const owedMap = new Map<string, number>();

  participants.forEach((p) => {
    paidMap.set(p.id, 0);
    owedMap.set(p.id, 0);
  });

  expenses.forEach((expense) => {
    if (paidMap.has(expense.paidBy)) {
      paidMap.set(expense.paidBy, (paidMap.get(expense.paidBy) || 0) + expense.amount);
    }

    const validParticipantIds = expense.participantIds.filter((id) => owedMap.has(id));
    const splitCount = validParticipantIds.length;
    if (splitCount === 0) return;

    const share = expense.amount / splitCount;
    validParticipantIds.forEach((id) => {
      owedMap.set(id, (owedMap.get(id) || 0) + share);
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

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}
