export interface Participant {
  id: string;
  name: string;
}

export type SplitMethod = "equal" | "percentage";
export type PaymentMethod = "single" | "multiple";

export interface ExpenseParticipant {
  id: string;
  percentage?: number;
}

export interface Payment {
  participantId: string;
  amount: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidBy: string;
  payments: Payment[];
  date?: string;
  notes?: string;
  splitMethod: SplitMethod;
  participantIds: string[];
  participants: ExpenseParticipant[];
}

export interface Event {
  id: string;
  name: string;
  date: string;
  participants: Participant[];
  expenses: Expense[];
}

const STORAGE_KEY = "expense-splitter-events";

function migrateExpense(raw: any, allParticipantIds: string[]): Expense {
  const participantIds: string[] = Array.isArray(raw.participantIds)
    ? raw.participantIds
    : allParticipantIds;

  const splitMethod: SplitMethod = raw.splitMethod === "percentage" ? "percentage" : "equal";
  const paymentMethod: PaymentMethod = raw.paymentMethod === "multiple" ? "multiple" : "single";

  let participants: ExpenseParticipant[] = Array.isArray(raw.participants)
    ? raw.participants
    : participantIds.map((id: string) => ({ id }));

  const payments: Payment[] = Array.isArray(raw.payments) ? raw.payments : [];

  return {
    id: raw.id || crypto.randomUUID(),
    description: raw.description || "Expense",
    amount: typeof raw.amount === "number" ? raw.amount : 0,
    paymentMethod,
    paidBy: raw.paidBy || "",
    payments,
    date: raw.date,
    notes: raw.notes,
    splitMethod,
    participantIds,
    participants,
  };
}

function migrateEvent(raw: any): Event {
  const participants: Participant[] = (raw.participants || []).map((p: any) => ({
    id: p.id,
    name: p.name,
  }));
  const allIds = participants.map((p) => p.id);

  let rawExpenses: any[] = Array.isArray(raw.expenses) ? raw.expenses : [];

  if (!Array.isArray(raw.expenses) && Array.isArray(raw.participants)) {
    rawExpenses = raw.participants
      .filter((p: any) => typeof p.amountPaid === "number" && p.amountPaid > 0)
      .map((p: any) => ({
        id: crypto.randomUUID(),
        description: "Contribution",
        amount: p.amountPaid,
        paymentMethod: "single",
        paidBy: p.id,
        payments: [],
        splitMethod: "equal",
        participantIds: allIds,
        participants: allIds.map((id: string) => ({ id })),
      }));
  }

  const expenses: Expense[] = rawExpenses.map((exp) => migrateExpense(exp, allIds));

  return {
    id: raw.id,
    name: raw.name,
    date: raw.date,
    participants,
    expenses,
  };
}

export function getEvents(): Event[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(migrateEvent) : [];
  } catch (e) {
    console.error("Failed to parse events", e);
    return [];
  }
}

export function saveEvents(events: Event[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}
