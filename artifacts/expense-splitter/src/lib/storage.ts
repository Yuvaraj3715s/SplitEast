export interface Participant {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  participantIds: string[];
}

export interface Event {
  id: string;
  name: string;
  date: string;
  participants: Participant[];
  expenses: Expense[];
}

const STORAGE_KEY = "expense-splitter-events";

function migrateEvent(raw: any): Event {
  const participants: Participant[] = (raw.participants || []).map((p: any) => ({
    id: p.id,
    name: p.name,
  }));

  let expenses: Expense[] = Array.isArray(raw.expenses) ? raw.expenses : [];

  if (!Array.isArray(raw.expenses) && Array.isArray(raw.participants)) {
    const allIds = participants.map((p) => p.id);
    expenses = raw.participants
      .filter((p: any) => typeof p.amountPaid === "number" && p.amountPaid > 0)
      .map((p: any) => ({
        id: crypto.randomUUID(),
        description: "Contribution",
        amount: p.amountPaid,
        paidBy: p.id,
        participantIds: allIds,
      }));
  }

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
