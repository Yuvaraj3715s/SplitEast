import { Participant } from "./storage";

export interface ParticipantBalance extends Participant {
  fairShare: number;
  balance: number;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}

export function calculateBalances(participants: Participant[]): ParticipantBalance[] {
  if (participants.length === 0) return [];
  
  const totalPaid = participants.reduce((sum, p) => sum + p.amountPaid, 0);
  const fairShare = totalPaid / participants.length;

  return participants.map(p => ({
    ...p,
    fairShare,
    balance: p.amountPaid - fairShare
  }));
}

export function calculateSettlements(balances: ParticipantBalance[]): Settlement[] {
  const debtors = balances.filter(b => b.balance < -0.01).map(b => ({ ...b, balance: Math.abs(b.balance) })).sort((a, b) => b.balance - a.balance);
  const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);

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
        amount
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
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
