import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, UserPlus, Trash2, Edit2, Receipt, ArrowRight, Users, Plus, ListChecks, Wand2, Lock, Unlock, Coins } from "lucide-react";
import { getEvents, saveEvents, Event, Participant, Expense, SplitMethod, PaymentMethod, ExpenseParticipant } from "@/lib/storage";
import { calculateBalances, calculateSettlements, getExpenseShares, getExpensePayments, distributeEqually, formatCurrency } from "@/lib/calculations";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
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

  const balances = useMemo(() => {
    if (!event) return [];
    return calculateBalances(event.participants, event.expenses);
  }, [event]);

  const settlements = useMemo(() => {
    return calculateSettlements(balances);
  }, [balances]);

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading or Event not found...</p>
      </div>
    );
  }

  const totalSpent = event.expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const fairShare = event.participants.length > 0 ? totalSpent / event.participants.length : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Events
        </Link>

        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" data-testid="text-event-detail-name">
              {event.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {event.date ? format(new Date(event.date), "MMMM d, yyyy") : ""}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Dialog
              open={isAddPersonOpen}
              onOpenChange={(open) => {
                if (open) setPersonName("");
                setIsAddPersonOpen(open);
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-participant" className="rounded-full shadow-sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Person
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddParticipant}>
                  <DialogHeader>
                    <DialogTitle>Add Person</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g. Alice"
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        data-testid="input-participant-name"
                        autoFocus
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={!personName.trim()} data-testid="button-save-participant">
                      Add
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Button
              onClick={openAddExpense}
              disabled={event.participants.length === 0}
              data-testid="button-add-expense"
              className="rounded-full shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </header>

        {event.expenses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-card shadow-sm border-border">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Spent</p>
                <p className="text-3xl font-bold text-foreground">{formatCurrency(totalSpent)}</p>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-sm border-border">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-sm font-medium text-muted-foreground mb-1">People</p>
                <p className="text-3xl font-bold text-foreground">{event.participants.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-primary/5 shadow-sm border-primary/20">
              <CardContent className="p-4 sm:p-6 flex flex-col justify-center h-full">
                <p className="text-sm font-medium text-primary mb-1">Avg. Fair Share</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(fairShare)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-8">
          {event.participants.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border shadow-sm border-dashed">
              <p className="text-muted-foreground">No one added yet.</p>
              <Button onClick={() => setIsAddPersonOpen(true)} variant="link" className="mt-2 text-primary">
                Add someone to get started
              </Button>
            </div>
          ) : (
            <>
              <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-muted-foreground" />
                  Expenses
                </h2>

                {event.expenses.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-xl border shadow-sm border-dashed">
                    <p className="text-muted-foreground">No expenses yet.</p>
                    <Button onClick={openAddExpense} variant="link" className="mt-2 text-primary">
                      Add your first expense
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {event.expenses.map((expense) => {
                        const shares = getExpenseShares(expense);
                        const payments = getExpensePayments(expense);
                        const payerEntries = Object.entries(payments).filter(([, amt]) => amt > 0);
                        return (
                          <motion.div
                            key={expense.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.15 }}
                          >
                            <Card className="overflow-hidden hover:border-primary/30 transition-colors">
                              <div className="p-4 sm:p-5 flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-semibold text-base truncate" data-testid={`text-expense-description-${expense.id}`}>
                                      {expense.description}
                                    </h3>
                                    <span className="font-bold text-foreground shrink-0" data-testid={`text-expense-amount-${expense.id}`}>
                                      {formatCurrency(expense.amount)}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1" data-testid={`text-expense-paidby-${expense.id}`}>
                                    {expense.paymentMethod === "multiple" ? (
                                      <>
                                        Paid by{" "}
                                        <span className="font-medium text-foreground">
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
                                        Paid by <span className="font-medium text-foreground">{getParticipantName(expense.paidBy)}</span>
                                      </>
                                    )}
                                    {expense.date && <span> · {format(new Date(expense.date), "MMM d, yyyy")}</span>}
                                  </p>
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1" data-testid={`text-expense-split-${expense.id}`}>
                                    <Users className="w-3.5 h-3.5" />
                                    Split among {expense.participantIds.length} people
                                    <span className="ml-1 px-1.5 py-0.5 rounded bg-secondary/60 text-xs font-medium capitalize">
                                      {expense.splitMethod}
                                    </span>
                                  </p>
                                  {expense.notes && (
                                    <p className="text-sm text-muted-foreground mt-1 italic">{expense.notes}</p>
                                  )}
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {expense.participantIds.map((pid) => (
                                      <span
                                        key={pid}
                                        className="text-xs bg-secondary/50 text-foreground px-2 py-0.5 rounded-full"
                                        data-testid={`badge-expense-participant-${expense.id}-${pid}`}
                                      >
                                        {getParticipantName(pid)}: {formatCurrency(shares[pid] || 0)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => openEditExpense(expense)}
                                    data-testid={`button-edit-expense-${expense.id}`}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteExpense(expense.id)}
                                    data-testid={`button-delete-expense-${expense.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
                <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  Balances
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <AnimatePresence>
                    {balances.map((b) => (
                      <motion.div
                        key={b.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                      >
                        <Card className="overflow-hidden hover:border-primary/30 transition-colors">
                          <div className="p-4 sm:p-5 flex justify-between items-center">
                            <div className="flex-1">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar name={b.name} />
                                  <h3 className="font-semibold text-lg" data-testid={`text-name-${b.id}`}>
                                    {b.name}
                                  </h3>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => openEditPerson(event.participants.find((p) => p.id === b.id)!)}
                                    data-testid={`button-edit-${b.id}`}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteParticipant(b.id)}
                                    data-testid={`button-delete-${b.id}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Paid</span>
                                <span className="font-medium bg-secondary/50 px-2 py-0.5 rounded text-foreground">
                                  {formatCurrency(b.totalPaid)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm mt-1">
                                <span className="text-muted-foreground">Owes for share</span>
                                <span className="font-medium bg-secondary/50 px-2 py-0.5 rounded text-foreground">
                                  {formatCurrency(b.totalOwed)}
                                </span>
                              </div>

                              <div className="mt-3 pt-3 border-t flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Balance</span>
                                {Math.abs(b.balance) < 0.01 ? (
                                  <span className="text-sm font-medium text-muted-foreground">Settled</span>
                                ) : b.balance > 0 ? (
                                  <span className="text-sm font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                                    Gets back {formatCurrency(b.balance)}
                                  </span>
                                ) : (
                                  <span className="text-sm font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded">
                                    Owes {formatCurrency(Math.abs(b.balance))}
                                  </span>
                                )}
                              </div>
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

          {event.participants.length > 1 && settlements.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                <ListChecks className="w-5 h-5 text-muted-foreground" />
                How to settle up
              </h2>
              <Card className="bg-card shadow-sm border-border">
                <div className="divide-y">
                  {settlements.map((s, i) => (
                    <div key={i} className="p-4 sm:p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="font-medium text-foreground">{s.from}</div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                        <div className="font-medium text-foreground">{s.to}</div>
                      </div>
                      <div className="font-bold text-lg text-emerald-600 dark:text-emerald-500">
                        {formatCurrency(s.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </section>
          )}

          {event.participants.length > 1 && settlements.length === 0 && totalSpent > 0 && (
            <div className="mt-8 p-6 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl text-center border border-emerald-100 dark:border-emerald-500/20">
              <p className="text-emerald-700 dark:text-emerald-400 font-medium">All settled up! Everyone has paid their fair share.</p>
            </div>
          )}
        </div>

        {/* Edit Person Dialog */}
        <Dialog open={isEditPersonOpen} onOpenChange={setIsEditPersonOpen}>
          <DialogContent>
            <form onSubmit={handleEditParticipant}>
              <DialogHeader>
                <DialogTitle>Edit Person</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    data-testid="input-edit-name"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!personName.trim()} data-testid="button-update-participant">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add/Edit Expense Dialog */}
        <Dialog
          open={isExpenseOpen}
          onOpenChange={(open) => {
            setIsExpenseOpen(open);
            if (!open) resetExpenseForm();
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={handleSaveExpense}>
              <DialogHeader>
                <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="expense-description">Description</Label>
                  <Input
                    id="expense-description"
                    placeholder="e.g. Dinner at Mario's"
                    value={expenseDescription}
                    onChange={(e) => setExpenseDescription(e.target.value)}
                    data-testid="input-expense-description"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount">Amount ($)</Label>
                    <Input
                      id="expense-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      data-testid="input-expense-amount"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense-date">Date</Label>
                    <Input
                      id="expense-date"
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      data-testid="input-expense-date"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-payment-method">Payment Method</Label>
                  <Select
                    value={expensePaymentMethod}
                    onValueChange={(val) => setExpensePaymentMethod(val as PaymentMethod)}
                  >
                    <SelectTrigger id="expense-payment-method" data-testid="select-payment-method">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single" data-testid="option-payment-single">
                        Single Payer
                      </SelectItem>
                      <SelectItem value="multiple" data-testid="option-payment-multiple">
                        Multiple Payers
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {expensePaymentMethod === "single" ? (
                  <div className="space-y-2">
                    <Label htmlFor="expense-paid-by">Paid By</Label>
                    <Select value={expensePaidBy} onValueChange={setExpensePaidBy}>
                      <SelectTrigger id="expense-paid-by" data-testid="select-expense-paid-by">
                        <SelectValue placeholder="Select who paid" />
                      </SelectTrigger>
                      <SelectContent>
                        {event.participants.map((p) => (
                          <SelectItem key={p.id} value={p.id} data-testid={`option-paid-by-${p.id}`}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Label>Payments</Label>
                      <div className="flex items-center gap-2">
                        <Select value={autoFillTargetId} onValueChange={setAutoFillTargetId}>
                          <SelectTrigger className="h-7 w-32 text-xs" data-testid="select-autofill-target">
                            <SelectValue placeholder="Target" />
                          </SelectTrigger>
                          <SelectContent>
                            {event.participants.map((p) => (
                              <SelectItem key={p.id} value={p.id} data-testid={`option-autofill-target-${p.id}`}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleAutoFillRemaining}
                          disabled={!autoFillTargetId}
                          data-testid="button-auto-fill-remaining"
                        >
                          <Coins className="w-3 h-3 mr-1" />
                          Auto Fill Remaining
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                      {event.participants.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 p-3"
                          data-testid={`row-payment-${p.id}`}
                        >
                          <Avatar name={p.name} />
                          <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-sm text-muted-foreground">$</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={expensePayments[p.id] ?? 0}
                              onChange={(e) => handlePaymentChange(p.id, e.target.value)}
                              className="w-24 h-8 text-sm"
                              data-testid={`input-payment-${p.id}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p
                      className={`text-sm font-medium ${isPaymentValid ? "text-emerald-600" : "text-destructive"}`}
                      data-testid="text-payment-total"
                    >
                      Paid: {formatCurrency(paidTotal)} / {formatCurrency(parseFloat(expenseAmount) || 0)}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="expense-split-method">Split Method</Label>
                  <Select
                    value={expenseSplitMethod}
                    onValueChange={(val) => setExpenseSplitMethod(val as SplitMethod)}
                  >
                    <SelectTrigger id="expense-split-method" data-testid="select-split-method">
                      <SelectValue placeholder="Select split method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal" data-testid="option-split-equal">
                        Equal Split
                      </SelectItem>
                      <SelectItem value="percentage" data-testid="option-split-percentage">
                        Percentage Split
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label>Split Among</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={selectAllParticipants}
                        data-testid="button-select-all-participants"
                      >
                        Select All
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={clearAllParticipants}
                        data-testid="button-clear-all-participants"
                      >
                        Clear All
                      </Button>
                      {expenseSplitMethod === "percentage" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={handleAutoDistribute}
                          disabled={expenseParticipantIds.length === 0}
                          data-testid="button-auto-distribute"
                        >
                          <Wand2 className="w-3 h-3 mr-1" />
                          Auto Distribute
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                    {event.participants.map((p) => {
                      const checked = expenseParticipantIds.includes(p.id);
                      const isLocked = lockedPercentageIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 p-3 hover:bg-secondary/40 transition-colors"
                          data-testid={`row-split-participant-${p.id}`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleExpenseParticipant(p.id)}
                            data-testid={`checkbox-split-participant-${p.id}`}
                          />
                          <Avatar name={p.name} />
                          <span className="text-sm font-medium flex-1 truncate">{p.name}</span>

                          {checked && expenseSplitMethod === "percentage" && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleLockPercentage(p.id)}
                                className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                                  isLocked ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-secondary/60"
                                }`}
                                data-testid={`button-lock-percentage-${p.id}`}
                                title={isLocked ? "Unlock (auto-calculate)" : "Lock this percentage"}
                              >
                                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={expensePercentages[p.id] ?? 0}
                                onChange={(e) => handlePercentageChange(p.id, e.target.value)}
                                className="w-20 h-8 text-sm"
                                data-testid={`input-percentage-${p.id}`}
                              />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                          )}

                          {checked && (
                            <span
                              className="text-sm font-medium text-foreground bg-secondary/50 px-2 py-0.5 rounded shrink-0"
                              data-testid={`text-live-share-${p.id}`}
                            >
                              {formatCurrency(livePreviewShares[p.id] || 0)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground" data-testid="text-split-count">
                      Split among {expenseParticipantIds.length} {expenseParticipantIds.length === 1 ? "person" : "people"}.
                    </p>
                    {expenseSplitMethod === "percentage" && (
                      <p
                        className={`text-sm font-medium ${isPercentageValid ? "text-emerald-600" : "text-destructive"}`}
                        data-testid="text-percentage-total"
                      >
                        Total: {percentageTotal.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense-notes">Notes (optional)</Label>
                  <Textarea
                    id="expense-notes"
                    placeholder="Add any notes..."
                    value={expenseNotes}
                    onChange={(e) => setExpenseNotes(e.target.value)}
                    data-testid="input-expense-notes"
                    rows={2}
                  />
                </div>

                {expenseError && (
                  <p className="text-sm text-destructive" data-testid="text-expense-error">
                    {expenseError}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button type="submit" data-testid="button-save-expense">
                  {editingExpense ? "Save Changes" : "Add Expense"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
