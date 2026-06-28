export interface Participant {
  id: string;
  name: string;
  amountPaid: number;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  participants: Participant[];
}

const STORAGE_KEY = "expense-splitter-events";

export function getEvents(): Event[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse events", e);
    return [];
  }
}

export function saveEvents(events: Event[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}
