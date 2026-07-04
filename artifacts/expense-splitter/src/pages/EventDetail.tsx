import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserPlus, Trash2, Edit2, Receipt, ArrowRight, Users, Plus, ListChecks, Lock, Unlock, CheckCircle2, Circle, Undo2, PlusCircle, Filter, PartyPopper, Calendar, Wallet } from "lucide-react";
import { getEvents, saveEvents, Event, Participant, Expense, SplitMethod, PaymentMethod, ExpenseParticipant, SettlementRecord } from "@/lib/storage";
import { calculateBalances, calculateSettlements, getExpenseShares, getExpensePayments, applySettlements, distributeEqually, formatCurrency, Settlement } from "@/lib/calculations";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { CountUp } from "@/components/ui/count-up";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center text-lg font-bold shrink-0 shadow-inner border border-primary/10">
      {getInitials(name)}
    </div>
  );
}

function recomputeRedistribution(
  participantIds: string[],
  lockedIds: string[],
  percentages: Record<string, number>
): Record<string, number> {
  const locked = participantIds.filter((id) => lockedIds.includes(id));
  const unlocked = participantIds.filter((id) => !lockedIds.includes(id));
  const lockedSum = locked.reduce((sum, id) => sum + (percentages[id] || 0), 0);
  const remaining = Math.round(Math.max(0, 100 - lockedSum) * 100) / 100;
  const shares = distributeEqually(remaining, unlocked.length);

  const next: Record<string, number> = {};
  locked.forEach((id) => {
    next[id] = percentages[id] || 0;
  });
  unlocked.forEach((id, i) => {
    next[id] = shares[i];
  });
  return next;
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);

  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isEditPersonOpen, setIsEditPersonOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [personName, setPersonName] = useState("");

  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<PaymentMethod>("single");
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expensePayments, setExpensePayments] = useState<Record<string, number>>({});
  const [autoFillTargetId, setAutoFillTargetId] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSplitMethod, setExpenseSplitMethod] = useState<SplitMethod>("equal");
  const [expenseParticipantIds, setExpenseParticipantIds] = useState<string[]>([]);
  const [expensePercentages, setExpensePercentages] = useState<Record<string, number>>({});
  const [lockedPercentageIds, setLockedPercentageIds] = useState<string[]>([]);
  const [expenseError, setExpenseError] = useState("");

  const [settlementFilterStatus, setSettlementFilterStatus] = useState<"all" | "pending" | "paid">("all");
  const [settlementFilterPerson, setSettlementFilterPerson] = useState<string>("all");
  const [settlementFilterDate, setSettlementFilterDate] = useState<string>("");

  const [isSettlementFormOpen, setIsSettlementFormOpen] = useState(false);
  const [editingSettlementId, setEditingSettlementId] = useState<string | null>(null);
  const [settlementPayerId, setSettlementPayerId] = useState("");
  const [settlementReceiverId, setSettlementReceiverId] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementDate, setSettlementDate] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");
  const [settlementError, setSettlementError] = useState("");

  useEffect(() => {
    const events = getEvents();
    const foundEvent = events.find((e) => e.id === id);
    if (foundEvent) {
      setEvent(foundEvent);
    }
  }, [id]);

  const updateEvent = (updatedEvent: Event) => {
    setEvent(updatedEvent);
    const events = getEvents();
    const index = events.findIndex((e) => e.id === updatedEvent.id);
    if (index !== -1) {
      events[index] = updatedEvent;
      saveEvents(events);
    }
  };

  // ---- Participants ----

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !event) return;

    const newParticipant: Participant = {
      id: crypto.randomUUID(),
      name: personName.trim(),
    };

    updateEvent({
      ...event,
      participants: [...event.participants, newParticipant],
    });

    setPersonName("");
    setIsAddPersonOpen(false);
  };

  const handleEditParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !event || !editingParticipant) return;

    const updatedParticipants = event.participants.map((p) =>
      p.id === editingParticipant.id ? { ...p, name: personName.trim() } : p
    );

    updateEvent({
      ...event,
      participants: updatedParticipants,
    });

    setEditingParticipant(null);
    setIsEditPersonOpen(false);
  };

  const handleDeleteParticipant = (participantId: string) => {
    if (!event) return;

    const remainingExpenses = event.expenses
      .map((exp) => ({
        ...exp,
        paidBy: exp.paidBy === participantId ? "" : exp.paidBy,
        payments: exp.payments.filter((pay) => pay.participantId !== participantId),
        participantIds: exp.participantIds.filter((pid) => pid !== participantId),
        participants: exp.participants.filter((ep) => ep.id !== participantId),
      }))
      .filter((exp) => {
        if (exp.participantIds.length === 0) return false;
        if (exp.paymentMethod === "single" && !exp.paidBy) return false;
        if (exp.paymentMethod === "multiple" && exp.payments.length === 0) return false;
        return true;
      });

    updateEvent({
      ...event,
      participants: event.participants.filter((p) => p.id !== participantId),
      expenses: remainingExpenses,
    });
  };

  const openEditPerson = (p: Participant) => {
    setEditingParticipant(p);
    setPersonName(p.name);
    setIsEditPersonOpen(true);
  };

  // ---- Expenses ----

  const equalPercentages = (ids: string[]): Record<string, number> => {
    const map: Record<string, number> = {};
    const shares = distributeEqually(100, ids.length);
    ids.forEach((id, i) => {
      map[id] = shares[i];
    });
    return map;
  };

  const resetExpenseForm = () => {
    const allIds = event?.participants.map((p) => p.id) || [];
    setExpenseDescription("");
    setExpenseAmount("");
    setExpensePaymentMethod("single");
    setExpensePaidBy(event?.participants[0]?.id || "");
    setExpensePayments(Object.fromEntries(allIds.map((pid) => [pid, 0])));
    setAutoFillTargetId(allIds[allIds.length - 1] || "");
    setExpenseDate("");
    setExpenseNotes("");
    setExpenseSplitMethod("equal");
    setExpenseParticipantIds(allIds);
    setExpensePercentages(equalPercentages(allIds));
    setLockedPercentageIds([]);
    setExpenseError("");
    setEditingExpense(null);
  };

  const openAddExpense = () => {
    resetExpenseForm();
    setIsExpenseOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    const allIds = event?.participants.map((p) => p.id) || [];
    setEditingExpense(expense);
    setExpenseDescription(expense.description);
    setExpenseAmount(expense.amount.toString());
    setExpensePaymentMethod(expense.paymentMethod);
    setExpensePaidBy(expense.paidBy || event?.participants[0]?.id || "");
    const paymentMap = Object.fromEntries(allIds.map((pid) => [pid, 0]));
    expense.payments.forEach((p) => {
      paymentMap[p.participantId] = (paymentMap[p.participantId] || 0) + p.amount;
    });
    setExpensePayments(paymentMap);
    setAutoFillTargetId(allIds[allIds.length - 1] || "");
    setExpenseDate(expense.date || "");
    setExpenseNotes(expense.notes || "");
    setExpenseSplitMethod(expense.splitMethod);
    setExpenseParticipantIds(expense.participantIds);
    const pctMap: Record<string, number> = {};
    expense.participants.forEach((ep) => {
      if (typeof ep.percentage === "number") pctMap[ep.id] = ep.percentage;
    });
    setExpensePercentages(
      Object.keys(pctMap).length > 0 ? pctMap : equalPercentages(expense.participantIds)
    );
    setLockedPercentageIds([]);
    setExpenseError("");
    setIsExpenseOpen(true);
  };

  const toggleExpenseParticipant = (participantId: string) => {
    const isSelected = expenseParticipantIds.includes(participantId);
    const nextParticipantIds = isSelected
      ? expenseParticipantIds.filter((x) => x !== participantId)
      : [...expenseParticipantIds, participantId];
    const nextLocked = isSelected
      ? lockedPercentageIds.filter((x) => x !== participantId)
      : lockedPercentageIds;

    let nextPercentages = { ...expensePercentages };
    if (isSelected) {
      delete nextPercentages[participantId];
    } else if (!(participantId in nextPercentages)) {
      nextPercentages[participantId] = 0;
    }
    nextPercentages = recomputeRedistribution(nextParticipantIds, nextLocked, nextPercentages);

    setExpenseParticipantIds(nextParticipantIds);
    setLockedPercentageIds(nextLocked);
    setExpensePercentages(nextPercentages);
  };

  const selectAllParticipants = () => {
    if (!event) return;
    const allIds = event.participants.map((p) => p.id);
    let nextPercentages = { ...expensePercentages };
    allIds.forEach((pid) => {
      if (!(pid in nextPercentages)) nextPercentages[pid] = 0;
    });
    const nextLocked = lockedPercentageIds.filter((pid) => allIds.includes(pid));
    nextPercentages = recomputeRedistribution(allIds, nextLocked, nextPercentages);

    setExpenseParticipantIds(allIds);
    setLockedPercentageIds(nextLocked);
    setExpensePercentages(nextPercentages);
  };

  const clearAllParticipants = () => {
    setExpenseParticipantIds([]);
    setLockedPercentageIds([]);
    setExpensePercentages({});
  };

  const handleAutoDistribute = () => {
    const shares = distributeEqually(100, expenseParticipantIds.length);
    const next: Record<string, number> = {};
    expenseParticipantIds.forEach((pid, i) => {
      next[pid] = shares[i];
    });
    setExpensePercentages(next);
    setLockedPercentageIds([]);
  };

  const handlePercentageChange = (participantId: string, value: string) => {
    const parsed = parseFloat(value);
    const val = value === "" ? 0 : isNaN(parsed) ? 0 : Math.max(0, parsed);
    const nextLocked = lockedPercentageIds.includes(participantId)
      ? lockedPercentageIds
      : [...lockedPercentageIds, participantId];
    const merged = { ...expensePercentages, [participantId]: val };
    const redistributed = recomputeRedistribution(expenseParticipantIds, nextLocked, merged);

    setLockedPercentageIds(nextLocked);
    setExpensePercentages(redistributed);
  };

  const toggleLockPercentage = (participantId: string) => {
    const isLocked = lockedPercentageIds.includes(participantId);
    const nextLocked = isLocked
      ? lockedPercentageIds.filter((id) => id !== participantId)
      : [...lockedPercentageIds, participantId];
    const nextPercentages = recomputeRedistribution(expenseParticipantIds, nextLocked, expensePercentages);

    setLockedPercentageIds(nextLocked);
    setExpensePercentages(nextPercentages);
  };

  const percentageTotal = useMemo(() => {
    return expenseParticipantIds.reduce((sum, pid) => sum + (expensePercentages[pid] || 0), 0);
  }, [expenseParticipantIds, expensePercentages]);

  const isPercentageValid = Math.abs(percentageTotal - 100) < 0.01;

  // ---- Payments (multiple payers) ----

  const handlePaymentChange = (participantId: string, value: string) => {
    const parsed = parseFloat(value);
    const val = value === "" ? 0 : isNaN(parsed) ? 0 : Math.max(0, parsed);
    setExpensePayments((prev) => ({ ...prev, [participantId]: val }));
  };

  const handleAutoFillRemaining = () => {
    if (!autoFillTargetId) return;
    const parsedAmount = parseFloat(expenseAmount) || 0;
    const otherSum = Object.entries(expensePayments)
      .filter(([pid]) => pid !== autoFillTargetId)
      .reduce((sum, [, amt]) => sum + amt, 0);
    const remainder = Math.max(0, Math.round((parsedAmount - otherSum) * 100) / 100);
    setExpensePayments((prev) => ({ ...prev, [autoFillTargetId]: remainder }));
  };

  const paidTotal = useMemo(() => {
    if (!event) return 0;
    return event.participants.reduce((sum, p) => sum + (expensePayments[p.id] || 0), 0);
  }, [event, expensePayments]);

  const isPaymentValid = Math.abs(paidTotal - (parseFloat(expenseAmount) || 0)) < 0.01;

  const livePreviewShares = useMemo(() => {
    const parsedAmount = parseFloat(expenseAmount) || 0;
    const shares: Record<string, number> = {};
    if (expenseParticipantIds.length === 0) return shares;

    if (expenseSplitMethod === "percentage") {
      expenseParticipantIds.forEach((pid) => {
        shares[pid] = (parsedAmount * (expensePercentages[pid] || 0)) / 100;
      });
    } else {
      const share = parsedAmount / expenseParticipantIds.length;
      expenseParticipantIds.forEach((pid) => {
        shares[pid] = share;
      });
    }
    return shares;
  }, [expenseAmount, expenseSplitMethod, expenseParticipantIds, expensePercentages]);

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    const parsedAmount = parseFloat(expenseAmount);

    if (!expenseDescription.trim()) {
      setExpenseError("Please enter a description.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setExpenseError("Please enter a valid amount.");
      return;
    }
    if (expensePaymentMethod === "single" && !expensePaidBy) {
      setExpenseError("Please select who paid.");
      return;
    }
    if (expensePaymentMethod === "multiple" && !isPaymentValid) {
      setExpenseError(`Payments must add up to the total amount. Paid: ${formatCurrency(paidTotal)} / ${formatCurrency(parsedAmount)}`);
      return;
    }
    if (expenseParticipantIds.length === 0) {
      setExpenseError("Select at least one person to split this expense among.");
      return;
    }
    if (expenseSplitMethod === "percentage" && !isPercentageValid) {
      setExpenseError("Percentages must add up to exactly 100%.");
      return;
    }

    const participants: ExpenseParticipant[] =
      expenseSplitMethod === "percentage"
        ? expenseParticipantIds.map((pid) => ({ id: pid, percentage: expensePercentages[pid] || 0 }))
        : expenseParticipantIds.map((pid) => ({ id: pid }));

    const payments =
      expensePaymentMethod === "multiple"
        ? event.participants
            .filter((p) => (expensePayments[p.id] || 0) > 0)
            .map((p) => ({ participantId: p.id, amount: expensePayments[p.id] || 0 }))
        : [];

    const paidBy = expensePaymentMethod === "single" ? expensePaidBy : "";

    if (editingExpense) {
      const updatedExpenses = event.expenses.map((exp) =>
        exp.id === editingExpense.id
          ? {
              ...exp,
              description: expenseDescription.trim(),
              amount: parsedAmount,
              paymentMethod: expensePaymentMethod,
              paidBy,
              payments,
              date: expenseDate || undefined,
              notes: expenseNotes.trim() || undefined,
              splitMethod: expenseSplitMethod,
              participantIds: expenseParticipantIds,
              participants,
            }
          : exp
      );
      updateEvent({ ...event, expenses: updatedExpenses });
    } else {
      const newExpense: Expense = {
        id: crypto.randomUUID(),
        description: expenseDescription.trim(),
        amount: parsedAmount,
        paymentMethod: expensePaymentMethod,
        paidBy,
        payments,
        date: expenseDate || undefined,
        notes: expenseNotes.trim() || undefined,
        splitMethod: expenseSplitMethod,
        participantIds: expenseParticipantIds,
        participants,
      };
      updateEvent({ ...event, expenses: [...event.expenses, newExpense] });
    }

    setIsExpenseOpen(false);
    resetExpenseForm();
  };

  const handleDeleteExpense = (expenseId: string) => {
    if (!event) return;
    updateEvent({
      ...event,
      expenses: event.expenses.filter((exp) => exp.id !== expenseId),
    });
  };

  const getParticipantName = (participantId: string) =>
    event?.participants.find((p) => p.id === participantId)?.name || "Unknown";

  // ---- Settlement Tracking ----

  const resetSettlementForm = () => {
    const firstId = event?.participants[0]?.id || "";
    const secondId = event?.participants[1]?.id || firstId;
    setSettlementPayerId(firstId);
    setSettlementReceiverId(secondId);
    setSettlementAmount("");
    setSettlementDate(new Date().toISOString().slice(0, 16));
    setSettlementNotes("");
    setSettlementError("");
    setEditingSettlementId(null);
  };

  const openRecordPayment = () => {
    resetSettlementForm();
    setIsSettlementFormOpen(true);
  };

  const openMarkAsPaid = (s: Settlement) => {
    setEditingSettlementId(null);
    setSettlementPayerId(s.fromId);
    setSettlementReceiverId(s.toId);
    setSettlementAmount(s.amount.toFixed(2));
    setSettlementDate(new Date().toISOString().slice(0, 16));
    setSettlementNotes("");
    setSettlementError("");
    setIsSettlementFormOpen(true);
  };

  const openEditSettlement = (record: SettlementRecord) => {
    setEditingSettlementId(record.id);
    setSettlementPayerId(record.payer);
    setSettlementReceiverId(record.receiver);
    setSettlementAmount(record.amount.toString());
    setSettlementDate(record.date.slice(0, 16));
    setSettlementNotes(record.notes || "");
    setSettlementError("");
    setIsSettlementFormOpen(true);
  };

  const handleSaveSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    const parsedAmount = parseFloat(settlementAmount);

    if (!settlementPayerId || !settlementReceiverId) {
      setSettlementError("Select both a payer and a receiver.");
      return;
    }
    if (settlementPayerId === settlementReceiverId) {
      setSettlementError("Payer and receiver must be different people.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setSettlementError("Please enter a valid amount.");
      return;
    }

    const isoDate = settlementDate ? new Date(settlementDate).toISOString() : new Date().toISOString();

    if (editingSettlementId) {
      const updated = event.settlements.map((s) =>
        s.id === editingSettlementId
          ? {
              ...s,
              payer: settlementPayerId,
              receiver: settlementReceiverId,
              amount: parsedAmount,
              date: isoDate,
              notes: settlementNotes.trim() || undefined,
            }
          : s
      );
      updateEvent({ ...event, settlements: updated });
    } else {
      const newRecord: SettlementRecord = {
        id: crypto.randomUUID(),
        payer: settlementPayerId,
        receiver: settlementReceiverId,
        amount: parsedAmount,
        date: isoDate,
        notes: settlementNotes.trim() || undefined,
        status: "paid",
      };
      updateEvent({ ...event, settlements: [...event.settlements, newRecord] });
    }

    setIsSettlementFormOpen(false);
    resetSettlementForm();
  };

  const handleUndoSettlement = (settlementId: string) => {
    if (!event) return;
    updateEvent({
      ...event,
      settlements: event.settlements.filter((s) => s.id !== settlementId),
    });
  };

  const rawBalances = useMemo(() => {
    if (!event) return [];
    return calculateBalances(event.participants, event.expenses);
  }, [event]);

  const balances = useMemo(() => {
    if (!event) return rawBalances;
    return applySettlements(rawBalances, event.settlements);
  }, [rawBalances, event]);

  const settlements = useMemo(() => {
    return calculateSettlements(balances);
  }, [balances]);

  const filteredPendingSettlements = useMemo(() => {
    if (settlementFilterStatus === "paid") return [];
    return settlements.filter(
      (s) => settlementFilterPerson === "all" || s.fromId === settlementFilterPerson || s.toId === settlementFilterPerson
    );
  }, [settlements, settlementFilterStatus, settlementFilterPerson]);

  const filteredHistory = useMemo(() => {
    if (!event) return [];
    if (settlementFilterStatus === "pending") return [];
    return event.settlements
      .filter(
        (s) => settlementFilterPerson === "all" || s.payer === settlementFilterPerson || s.receiver === settlementFilterPerson
      )
      .filter((s) => !settlementFilterDate || s.date.slice(0, 10) === settlementFilterDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [event, settlementFilterStatus, settlementFilterPerson, settlementFilterDate]);

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <div className="glass-card p-8 rounded-[32px] shadow-2xl animate-pulse">
          <p className="text-muted-foreground font-semibold uppercase tracking-widest text-sm">Loading Event...</p>
        </div>
      </div>
    );
  }

  const totalSpent = event.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const fairShare = event.participants.length > 0 ? totalSpent / event.participants.length : 0;

  return (
    <div className="min-h-screen bg-app pb-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <Link href="/" className="inline-flex items-center text-sm font-semibold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-all duration-300 mb-8 bg-background/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 dark:border-white/5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-background/80">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Events
        </Link>

        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-foreground mb-2" data-testid="text-event-detail-name">
              {event.name}
            </h1>
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center bg-background/40 backdrop-blur-sm px-3 py-1 rounded-lg border border-white/10 inline-flex">
              <Calendar className="w-3.5 h-3.5 mr-2 opacity-70" />
              {event.date ? format(new Date(event.date), "MMMM d, yyyy") : "No date set"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Dialog
              open={isAddPersonOpen}
              onOpenChange={(open) => {
                if (open) setPersonName("");
                setIsAddPersonOpen(open);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-participant" className="rounded-full shadow-md bg-white/60 dark:bg-black/40 backdrop-blur-md border-white/40 dark:border-white/10 hover:bg-white/80 dark:hover:bg-black/60 transition-all hover:scale-105 active:scale-95 h-12 px-6">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Person
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-panel border-none shadow-2xl sm:rounded-[32px]">
                <form onSubmit={handleAddParticipant}>
                  <DialogHeader className="px-2 pt-2">
                    <DialogTitle className="text-2xl font-bold tracking-tight">Add Person</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-6 py-6 px-2">
                    <div className="space-y-3">
                      <Label htmlFor="name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g. Alice"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        data-testid="input-participant-name"
                        autoFocus
                        className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 dark:border-white/10 text-lg px-4"
                      />
                    </div>
                  </div>
                  <DialogFooter className="px-2 pb-2">
                    <Button type="submit" disabled={!personName.trim()} data-testid="button-save-participant" size="lg" className="w-full rounded-2xl h-14 text-lg font-semibold bg-gradient-primary">
                      Add Person
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog
              open={isEditPersonOpen}
              onOpenChange={(open) => {
                if (open) setPersonName("");
                setIsEditPersonOpen(open);
              }}
            >
              <DialogContent className="glass-panel border-none shadow-2xl sm:rounded-[32px]">
                <form onSubmit={handleEditParticipant}>
                  <DialogHeader className="px-2 pt-2">
                    <DialogTitle className="text-2xl font-bold tracking-tight">Edit Person</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-6 py-6 px-2">
                    <div className="space-y-3">
                      <Label htmlFor="edit-name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
                      <Input
                        id="edit-name"
                        placeholder="e.g. Alice"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        autoFocus
                        className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 dark:border-white/10 text-lg px-4"
                      />
                    </div>
                  </div>
                  <DialogFooter className="px-2 pb-2">
                    <Button type="submit" disabled={!personName.trim()} size="lg" className="w-full rounded-2xl h-14 text-lg font-semibold bg-gradient-primary">
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              onClick={openAddExpense}
              disabled={event.participants.length === 0}
              data-testid="button-add-expense"
              className="rounded-full bg-gradient-primary px-6 h-12 font-bold"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Expense
            </Button>
          </div>
        </header>

        {event.expenses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
              <Card className="glass-card rounded-[32px] border-none overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none transition-opacity group-hover:opacity-100 opacity-50"></div>
                <CardContent className="p-6 sm:p-8 flex flex-col justify-center h-full relative z-10">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Total Spent</p>
                  <CountUp className="text-4xl font-black tracking-tighter text-foreground" value={totalSpent} />
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
              <Card className="glass-card rounded-[32px] border-none overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 pointer-events-none transition-opacity group-hover:opacity-100 opacity-50"></div>
                <CardContent className="p-6 sm:p-8 flex flex-col justify-center h-full relative z-10">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">People</p>
                  <CountUp className="text-4xl font-black tracking-tighter text-foreground" value={event.participants.length} decimals={0} prefix="" />
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
              <Card className="glass-card rounded-[32px] border-none overflow-hidden relative group bg-primary/5 dark:bg-primary/10">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none transition-opacity group-hover:opacity-100 opacity-50"></div>
                <CardContent className="p-6 sm:p-8 flex flex-col justify-center h-full relative z-10">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Avg. Fair Share</p>
                  <CountUp className="text-4xl font-black tracking-tighter text-primary" value={fairShare} />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        <div className="space-y-12">
          {event.participants.length === 0 ? (
            <div className="text-center py-20 glass-card rounded-[32px] flex flex-col items-center justify-center">
               <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-foreground mb-2">No one added yet</h3>
              <p className="text-muted-foreground mb-8">Add your friends to start splitting expenses.</p>
              <Button onClick={() => setIsAddPersonOpen(true)} size="lg" className="rounded-full shadow-lg shadow-primary/20 h-12 px-8 font-semibold">
                Add someone to get started
              </Button>
            </div>
          ) : (
            <>
              <section>
                <h2 className="text-2xl font-bold mb-6 text-foreground flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  Expenses
                </h2>

                {event.expenses.length === 0 ? (
                  <div className="text-center py-16 glass-card rounded-[32px] flex flex-col items-center justify-center">
                    <div className="bg-muted w-16 h-16 rounded-full flex items-center justify-center mb-4">
                      <Receipt className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium mb-4">No expenses recorded yet.</p>
                    <Button onClick={openAddExpense} variant="outline" className="rounded-full shadow-sm">
                      Add your first expense
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence>
                      {event.expenses.map((expense, index) => {
                        const shares = getExpenseShares(expense);
                        const payments = getExpensePayments(expense);
                        const payerEntries = Object.entries(payments).filter(([, amt]) => amt > 0);
                        return (
                          <motion.div
                            key={expense.id}
                            layout
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.25, delay: index * 0.05 }}
                          >
                            <Card className="glass-card rounded-3xl border-none overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 group">
                              <div className="p-5 sm:p-6 flex justify-between items-start gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-4 mb-2">
                                    <h3 className="font-bold text-lg truncate" data-testid={`text-expense-description-${expense.id}`}>
                                      {expense.description}
                                    </h3>
                                    <span className="text-xl font-black text-foreground shrink-0" data-testid={`text-expense-amount-${expense.id}`}>
                                      {formatCurrency(expense.amount)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                                    <p className="text-muted-foreground font-medium flex items-center" data-testid={`text-expense-paidby-${expense.id}`}>
                                      <span className="w-2 h-2 rounded-full bg-green-500 mr-2 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
                                      {expense.paymentMethod === "multiple" ? (
                                        <>
                                          Paid by{" "}
                                          <span className="text-foreground ml-1">
                                            {payerEntries.map(([pid, amt], i) => (
                                              <span key={pid}>
                                                {i > 0 && ", "}
                                                {getParticipantName(pid)} ({formatCurrency(amt)})
                                              </span>
                                            ))}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          Paid by <span className="text-foreground ml-1">{getParticipantName(expense.paidBy)}</span>
                                        </>
                                      )}
                                    </p>
                                    <p className="text-muted-foreground flex items-center font-medium bg-background/50 px-2.5 py-1 rounded-full border border-white/10" data-testid={`text-expense-split-${expense.id}`}>
                                      <Users className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                      Split among {expense.participantIds.length}
                                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                                        {expense.splitMethod}
                                      </span>
                                    </p>
                                    {expense.date && <p className="text-muted-foreground font-medium text-xs uppercase tracking-wider flex items-center"><Calendar className="w-3 h-3 mr-1 opacity-70"/>{format(new Date(expense.date), "MMM d")}</p>}
                                  </div>
                                  {expense.notes && (
                                    <p className="text-sm text-muted-foreground mt-3 italic bg-muted/50 p-2 rounded-lg border-l-2 border-primary/30">{expense.notes}</p>
                                  )}
                                  <div className="flex flex-wrap gap-2 mt-4">
                                    {expense.participantIds.map((pid) => (
                                      <span
                                        key={pid}
                                        className="text-xs font-semibold bg-background/60 backdrop-blur-sm text-foreground px-3 py-1.5 rounded-full border border-white/20 dark:border-white/5 shadow-sm hover:bg-background/80 transition-colors"
                                        data-testid={`badge-expense-participant-${expense.id}-${pid}`}
                                      >
                                        {getParticipantName(pid)}: <span className="text-primary ml-1">{formatCurrency(shares[pid] || 0)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-md border-white/40 shadow-sm hover:bg-white hover:text-primary transition-colors"
                                    onClick={() => openEditExpense(expense)}
                                    data-testid={`button-edit-expense-${expense.id}`}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-9 w-9 rounded-full bg-white/60 dark:bg-black/40 backdrop-blur-md border-white/40 shadow-sm hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors"
                                    onClick={() => handleDeleteExpense(expense.id)}
                                    data-testid={`button-delete-expense-${expense.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-6 text-foreground flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  Balances
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {balances.map((b, index) => (
                      <motion.div
                        key={b.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.25, delay: index * 0.05 }}
                      >
                        <Card className="glass-card rounded-3xl border-none overflow-hidden hover:shadow-xl transition-all duration-300 group">
                          <div className="p-6 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                              <div className="flex items-center gap-4">
                                <Avatar name={b.name} />
                                <div>
                                  <h3 className="font-bold text-xl tracking-tight" data-testid={`text-name-${b.id}`}>
                                    {b.name}
                                  </h3>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">Participant</p>
                                </div>
                              </div>
                              <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full bg-background/50 hover:bg-background"
                                  onClick={() => openEditPerson(event.participants.find((p) => p.id === b.id)!)}
                                  data-testid={`button-edit-${b.id}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-full bg-background/50 hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleDeleteParticipant(b.id)}
                                  data-testid={`button-delete-${b.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-3 mb-6 flex-grow">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-muted-foreground uppercase tracking-wide text-xs">Total Paid</span>
                                <CountUp className="font-bold text-foreground" value={b.totalPaid} />
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-muted-foreground uppercase tracking-wide text-xs">Fair Share</span>
                                <CountUp className="font-bold text-foreground" value={b.totalOwed} />
                              </div>
                            </div>

                            <div className="pt-4 border-t border-white/20 dark:border-white/5 flex items-center justify-between bg-black/5 dark:bg-white/5 -mx-6 -mb-6 px-6 pb-6 pt-5 rounded-b-3xl">
                              <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Balance</span>
                              {Math.abs(b.balance) < 0.01 ? (
                                <span className="text-sm font-bold text-muted-foreground bg-black/10 dark:bg-white/10 px-3 py-1.5 rounded-full uppercase tracking-wider">Settled</span>
                              ) : b.balance > 0 ? (
                                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-4 py-1.5 rounded-full shadow-sm shadow-emerald-500/10">
                                  Gets back {formatCurrency(b.balance)}
                                </span>
                              ) : (
                                <span className="text-sm font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-500/20 px-4 py-1.5 rounded-full shadow-sm shadow-rose-500/10">
                                  Owes {formatCurrency(Math.abs(b.balance))}
                                </span>
                              )}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            </>
          )}

          {event.participants.length > 1 && settlements.length === 0 && totalSpent > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-12 p-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-[32px] text-center shadow-xl shadow-emerald-500/20 text-white flex flex-col items-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSI+PC9yZWN0Pgo8L3N2Zz4=')] opacity-20"></div>
              <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm relative z-10">
                <PartyPopper className="w-10 h-10 text-white" />
              </div>
              <div className="relative z-10">
                <h3 className="text-2xl font-bold tracking-tight mb-2">All settled up!</h3>
                <p className="text-emerald-50 font-medium text-lg">
                  Everyone has paid their fair share. No drama here.
                </p>
              </div>
            </motion.div>
          )}

          {event.participants.length > 1 && (totalSpent > 0 || event.settlements.length > 0) && (
            <section className="mt-12">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <ListChecks className="w-5 h-5" />
                  </div>
                  Settlements
                </h2>
                <Button size="lg" className="rounded-full shadow-md bg-white/80 dark:bg-white/10 text-foreground hover:bg-white dark:hover:bg-white/20 border border-black/5 dark:border-white/10 font-semibold" onClick={openRecordPayment} data-testid="button-record-payment">
                  <PlusCircle className="w-5 h-5 mr-2" />
                  Record Payment
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-6 p-4 glass-panel rounded-2xl">
                <Filter className="w-5 h-5 text-muted-foreground shrink-0 ml-1" />
                <Select value={settlementFilterStatus} onValueChange={(v) => setSettlementFilterStatus(v as any)}>
                  <SelectTrigger className="w-[140px] h-10 rounded-xl bg-background/50 border-white/20 font-medium" data-testid="select-filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl glass-panel">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending only</SelectItem>
                    <SelectItem value="paid">Paid only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={settlementFilterPerson} onValueChange={setSettlementFilterPerson}>
                  <SelectTrigger className="w-[160px] h-10 rounded-xl bg-background/50 border-white/20 font-medium" data-testid="select-filter-person">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl glass-panel">
                    <SelectItem value="all">Everyone</SelectItem>
                    {event.participants.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={settlementFilterDate}
                  onChange={(e) => setSettlementFilterDate(e.target.value)}
                  className="w-[150px] h-10 rounded-xl bg-background/50 border-white/20 font-medium"
                  data-testid="input-filter-date"
                />
                {(settlementFilterStatus !== "all" || settlementFilterPerson !== "all" || settlementFilterDate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 px-4 rounded-xl text-muted-foreground font-semibold hover:bg-background/80"
                    onClick={() => {
                      setSettlementFilterStatus("all");
                      setSettlementFilterPerson("all");
                      setSettlementFilterDate("");
                    }}
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              {filteredPendingSettlements.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-2">Suggested Settlements</h3>
                  <div className="grid gap-3">
                    <AnimatePresence>
                      {filteredPendingSettlements.map((s, i) => (
                        <motion.div key={`${s.fromId}-${s.toId}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                          <Card className="glass-card rounded-2xl border-none p-4 flex flex-col sm:flex-row items-center justify-between gap-4 hover:shadow-lg transition-shadow">
                            <div className="flex items-center gap-3 text-lg font-medium">
                              <span className="font-bold text-foreground">{s.from}</span>
                              <span className="text-muted-foreground text-sm uppercase font-semibold tracking-wider bg-background/50 px-2 py-1 rounded-lg">Owes</span>
                              <span className="font-bold text-foreground">{s.to}</span>
                            </div>
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                              <span className="text-2xl font-black text-foreground">{formatCurrency(s.amount)}</span>
                              <Button
                                size="sm"
                                className="ml-auto sm:ml-0 rounded-xl font-bold tracking-wide shadow-md bg-emerald-500 hover:bg-emerald-600 text-white"
                                onClick={() => openMarkAsPaid(s)}
                                data-testid={`button-mark-paid-${s.fromId}-${s.toId}`}
                              >
                                Mark as Paid
                              </Button>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4 pl-2">History</h3>
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-10 glass-panel rounded-2xl">
                    <p className="text-muted-foreground font-medium">No settlements recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {filteredHistory.map((record, i) => (
                        <motion.div key={record.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.05 }}>
                          <Card className="glass-panel border-none p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                            <div className="flex items-start gap-4">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium text-lg">
                                  <span className="font-bold text-foreground">{getParticipantName(record.payer)}</span> paid <span className="font-bold text-foreground">{getParticipantName(record.receiver)}</span>
                                </p>
                                <p className="text-sm text-muted-foreground font-semibold uppercase tracking-wider mt-1 flex items-center">
                                  <Calendar className="w-3.5 h-3.5 mr-1.5 opacity-70" />
                                  {format(new Date(record.date), "MMM d, yyyy")}
                                </p>
                                {record.notes && <p className="text-sm mt-2 text-muted-foreground italic bg-background/50 p-2 rounded-lg border-l-2 border-primary/30">{record.notes}</p>}
                              </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                              <span className="text-2xl font-black text-foreground">{formatCurrency(record.amount)}</span>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-full bg-background/50 hover:bg-background"
                                  onClick={() => openEditSettlement(record)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-full bg-background/50 hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleUndoSettlement(record.id)}
                                >
                                  <Undo2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Expense Modal */}
      <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto glass-panel border-none shadow-2xl sm:rounded-[32px] p-0">
          <form onSubmit={handleSaveExpense} className="flex flex-col">
            <DialogHeader className="px-6 sm:px-8 pt-8 pb-4 sticky top-0 bg-background/80 backdrop-blur-xl z-20 border-b border-white/10">
              <DialogTitle className="text-2xl font-bold tracking-tight">{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
            </DialogHeader>
            <div className="p-6 sm:p-8 space-y-8">
              <div className="space-y-3">
                <Label htmlFor="desc" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
                <Input
                  id="desc"
                  placeholder="e.g. Dinner at Joe's"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-lg px-4"
                  data-testid="input-expense-desc"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="amount" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-lg px-4 font-bold"
                    data-testid="input-expense-amount"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="exp-date" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-lg px-4"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-foreground">Who paid?</Label>
                  <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl">
                    <Button
                      type="button"
                      variant={expensePaymentMethod === "single" ? "secondary" : "ghost"}
                      size="sm"
                      className={`rounded-lg font-bold ${expensePaymentMethod === 'single' ? 'shadow-sm' : ''}`}
                      onClick={() => setExpensePaymentMethod("single")}
                      data-testid="btn-pay-single"
                    >
                      Single
                    </Button>
                    <Button
                      type="button"
                      variant={expensePaymentMethod === "multiple" ? "secondary" : "ghost"}
                      size="sm"
                      className={`rounded-lg font-bold ${expensePaymentMethod === 'multiple' ? 'shadow-sm' : ''}`}
                      onClick={() => setExpensePaymentMethod("multiple")}
                      data-testid="btn-pay-multiple"
                    >
                      Multiple
                    </Button>
                  </div>
                </div>

                {expensePaymentMethod === "single" ? (
                  <Select value={expensePaidBy} onValueChange={setExpensePaidBy}>
                    <SelectTrigger className="h-14 rounded-2xl bg-background/50 border-white/20 text-lg font-medium" data-testid="select-expense-paidby">
                      <SelectValue placeholder="Select who paid" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl glass-panel">
                      {event.participants.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-base font-medium py-3">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3 bg-black/5 dark:bg-white/5 p-4 rounded-3xl border border-white/10">
                    {event.participants.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-4">
                        <Label className="font-medium text-base">{p.name}</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-28 text-right h-12 rounded-xl font-bold bg-background/80 border-white/20"
                            value={expensePayments[p.id] || ""}
                            onChange={(e) => handlePaymentChange(p.id, e.target.value)}
                            data-testid={`input-payment-${p.id}`}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 flex justify-between items-center border-t border-white/10">
                      <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total Paid: {formatCurrency(paidTotal)}</span>
                      <div className="flex gap-2 items-center">
                        <Select value={autoFillTargetId} onValueChange={setAutoFillTargetId}>
                          <SelectTrigger className="w-[130px] h-9 rounded-lg bg-background/50 border-white/20 text-xs font-bold">
                            <SelectValue placeholder="Select person" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl glass-panel">
                            {event.participants.map((p) => (
                              <SelectItem key={p.id} value={p.id} className="text-sm font-medium">
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" size="sm" variant="secondary" onClick={handleAutoFillRemaining} className="rounded-lg font-bold text-xs h-9">
                          Fill rest
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-foreground">For who?</Label>
                  <div className="flex items-center gap-1 bg-background/50 p-1 rounded-xl">
                    <Button
                      type="button"
                      variant={expenseSplitMethod === "equal" ? "secondary" : "ghost"}
                      size="sm"
                      className={`rounded-lg font-bold ${expenseSplitMethod === 'equal' ? 'shadow-sm' : ''}`}
                      onClick={() => setExpenseSplitMethod("equal")}
                      data-testid="btn-split-equal"
                    >
                      Equally
                    </Button>
                    <Button
                      type="button"
                      variant={expenseSplitMethod === "percentage" ? "secondary" : "ghost"}
                      size="sm"
                      className={`rounded-lg font-bold ${expenseSplitMethod === 'percentage' ? 'shadow-sm' : ''}`}
                      onClick={() => setExpenseSplitMethod("percentage")}
                      data-testid="btn-split-percentage"
                    >
                      Percentage
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={selectAllParticipants} className="rounded-lg bg-white/40 dark:bg-black/20 border-white/20 text-xs font-bold uppercase tracking-wider">All</Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearAllParticipants} className="rounded-lg bg-white/40 dark:bg-black/20 border-white/20 text-xs font-bold uppercase tracking-wider">None</Button>
                </div>

                <div className="space-y-3 bg-black/5 dark:bg-white/5 p-4 rounded-3xl border border-white/10">
                  {event.participants.map((p) => {
                    const isSelected = expenseParticipantIds.includes(p.id);
                    const isLocked = lockedPercentageIds.includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center gap-3">
                        <Checkbox
                          id={`participant-${p.id}`}
                          checked={isSelected}
                          onCheckedChange={() => toggleExpenseParticipant(p.id)}
                          data-testid={`checkbox-expense-for-${p.id}`}
                          className="w-6 h-6 rounded-md border-white/40 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        <Label htmlFor={`participant-${p.id}`} className="flex-1 font-medium text-base cursor-pointer">
                          {p.name}
                        </Label>

                        {expenseSplitMethod === "equal" && isSelected && (
                          <div className="text-sm font-bold text-muted-foreground w-24 text-right">
                            {formatCurrency(livePreviewShares[p.id] || 0)}
                          </div>
                        )}

                        {expenseSplitMethod === "percentage" && isSelected && (
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className={`h-9 w-9 rounded-lg ${isLocked ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-background/50"}`}
                              onClick={() => toggleLockPercentage(p.id)}
                              title={isLocked ? "Unlock percentage" : "Lock percentage"}
                            >
                              {isLocked ? <Lock className="h-4 h-4" /> : <Unlock className="h-4 h-4 opacity-50" />}
                            </Button>
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              className="w-20 text-right h-12 rounded-xl font-bold bg-background/80 border-white/20"
                              value={expensePercentages[p.id] || ""}
                              onChange={(e) => handlePaymentChange(p.id, e.target.value)}
                              onInput={(e) => handlePercentageChange(p.id, (e.target as HTMLInputElement).value)}
                              data-testid={`input-percentage-${p.id}`}
                            />
                            <span className="text-muted-foreground font-bold text-lg">%</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {expenseSplitMethod === "percentage" && (
                   <div className="flex justify-between items-center px-2">
                     <span className={`text-sm font-bold uppercase tracking-wider ${isPercentageValid ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                       Total: {percentageTotal.toFixed(1)}%
                     </span>
                     <Button type="button" size="sm" variant="secondary" onClick={handleAutoDistribute} className="rounded-lg font-bold text-xs uppercase tracking-wider h-9">
                       Reset evenly
                     </Button>
                   </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <Label htmlFor="notes" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional details..."
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="min-h-[100px] rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-base p-4 resize-none"
                />
              </div>

              {expenseError && (
                <div className="p-4 bg-destructive/10 text-destructive text-sm font-bold rounded-2xl border border-destructive/20 flex items-start gap-2">
                  <span className="text-lg leading-none">!</span> {expenseError}
                </div>
              )}
            </div>
            <DialogFooter className="p-6 sm:p-8 sticky bottom-0 bg-background/80 backdrop-blur-xl z-20 border-t border-white/10">
              <Button type="submit" data-testid="button-save-expense" size="lg" className="w-full rounded-2xl h-14 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-transform">
                {editingExpense ? "Save Changes" : "Add Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settlement Form Modal */}
      <Dialog open={isSettlementFormOpen} onOpenChange={setIsSettlementFormOpen}>
        <DialogContent className="sm:max-w-[450px] glass-panel border-none shadow-2xl sm:rounded-[32px]">
          <form onSubmit={handleSaveSettlement}>
            <DialogHeader className="px-2 pt-2">
              <DialogTitle className="text-2xl font-bold tracking-tight">{editingSettlementId ? "Edit Payment" : "Record Payment"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-6 px-2">
              <div className="space-y-3">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Who paid?</Label>
                <Select value={settlementPayerId} onValueChange={setSettlementPayerId}>
                  <SelectTrigger className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-lg font-medium" data-testid="select-settlement-payer">
                    <SelectValue placeholder="Select payer" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl glass-panel">
                    {event.participants.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-base font-medium py-3">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-background/80 backdrop-blur-xl rounded-full p-2 border border-white/10 shadow-sm text-primary">
                  <ArrowRight className="w-5 h-5 rotate-90 sm:rotate-0" />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Who received it?</Label>
                <Select value={settlementReceiverId} onValueChange={setSettlementReceiverId}>
                  <SelectTrigger className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-lg font-medium" data-testid="select-settlement-receiver">
                    <SelectValue placeholder="Select receiver" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl glass-panel">
                    {event.participants.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-base font-medium py-3">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={settlementAmount}
                    onChange={(e) => setSettlementAmount(e.target.value)}
                    className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-lg px-4 font-bold"
                    data-testid="input-settlement-amount"
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
                  <Input
                    type="datetime-local"
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-sm px-4"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes (optional)</Label>
                <Input
                  placeholder="e.g. Venmo"
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 text-base px-4"
                />
              </div>

              {settlementError && (
                <div className="p-4 bg-destructive/10 text-destructive text-sm font-bold rounded-2xl border border-destructive/20">
                  {settlementError}
                </div>
              )}
            </div>
            <DialogFooter className="px-2 pb-2">
              <Button type="submit" size="lg" className="w-full rounded-2xl h-14 text-lg font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-transform" data-testid="button-save-settlement">
                {editingSettlementId ? "Save Changes" : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
