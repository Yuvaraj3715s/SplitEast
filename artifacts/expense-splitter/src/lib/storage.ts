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
  category?: string;
  receiptImage?: string;
}

export type SettlementStatus = "paid";

export interface SettlementRecord {
  id: string;
  payer: string;
  receiver: string;
  amount: number;
  date: string;
  notes?: string;
  status: SettlementStatus;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  participants: Participant[];
  expenses: Expense[];
  settlements: SettlementRecord[];
  icon?: string;
  color?: string;
  currency?: string;
  description?: string;
}

const STORAGE_KEY = "expense-splitter-events";

function migrateSettlement(raw: any): SettlementRecord | null {
  if (!raw || typeof raw.amount !== "number" || !raw.payer || !raw.receiver) return null;
  return {
    id: raw.id || crypto.randomUUID(),
    payer: raw.payer,
    receiver: raw.receiver,
    amount: raw.amount,
    date: raw.date || new Date().toISOString(),
    notes: raw.notes,
    status: "paid",
  };
}

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
    category: typeof raw.category === "string" ? raw.category : undefined,
    receiptImage: typeof raw.receiptImage === "string" ? raw.receiptImage : undefined,
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

  const settlements: SettlementRecord[] = Array.isArray(raw.settlements)
    ? raw.settlements.map(migrateSettlement).filter((s: SettlementRecord | null): s is SettlementRecord => s !== null)
    : [];

  return {
    id: raw.id,
    name: raw.name,
    date: raw.date,
    participants,
    expenses,
    settlements,
    icon: typeof raw.icon === "string" ? raw.icon : undefined,
    color: typeof raw.color === "string" ? raw.color : undefined,
    currency: typeof raw.currency === "string" ? raw.currency : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
  };
}

export function exportAllData(): string {
  const events = getEvents();
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), events }, null, 2);
}

export function importAllData(json: string): { success: boolean; count: number; error?: string } {
  try {
    const parsed = JSON.parse(json);
    const rawEvents = Array.isArray(parsed) ? parsed : Array.isArray(parsed.events) ? parsed.events : null;
    if (!rawEvents) return { success: false, count: 0, error: "Invalid file format." };
    const migrated = rawEvents.map(migrateEvent);
    saveEvents(migrated);
    return { success: true, count: migrated.length };
  } catch (e) {
    return { success: false, count: 0, error: "Could not parse file." };
  }
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
