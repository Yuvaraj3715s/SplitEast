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
import { ArrowLeft, UserPlus, Trash2, Edit2, Receipt, ArrowRight, Users, Plus, ListChecks, Wand2 } from "lucide-react";
import { getEvents, saveEvents, Event, Participant, Expense, SplitMethod, ExpenseParticipant } from "@/lib/storage";
import { calculateBalances, calculateSettlements, getExpenseShares, formatCurrency } from "@/lib/calculations";
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
  const [expensePaidBy, setExpensePaidBy] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseSplitMethod, setExpenseSplitMethod] = useState<SplitMethod>("equal");
  const [expenseParticipantIds, setExpenseParticipantIds] = useState<string[]>([]);
  const [expensePercentages, setExpensePercentages] = useState<Record<string, number>>({});
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
      .filter((exp) => exp.paidBy !== participantId)
      .map((exp) => ({
        ...exp,
        participantIds: exp.participantIds.filter((pid) => pid !== participantId),
        participants: exp.participants.filter((ep) => ep.id !== participantId),
      }))
      .filter((exp) => exp.participantIds.length > 0);

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
    if (ids.length === 0) return map;
    const base = Math.floor((100 / ids.length) * 100) / 100;
    const remainder = Math.round((100 - base * ids.length) * 100) / 100;
    ids.forEach((id, i) => {
      map[id] = i === 0 ? Math.round((base + remainder) * 100) / 100 : base;
    });
    return map;
  };

  const resetExpenseForm = () => {
    const allIds = event?.participants.map((p) => p.id) || [];
    setExpenseDescription("");
    setExpenseAmount("");
    setExpensePaidBy(event?.participants[0]?.id || "");
    setExpenseDate("");
    setExpenseNotes("");
    setExpenseSplitMethod("equal");
    setExpenseParticipantIds(allIds);
    setExpensePercentages(equalPercentages(allIds));
    setExpenseError("");
    setEditingExpense(null);
  };

  const openAddExpense = () => {
    resetExpenseForm();
    setIsExpenseOpen(true);
  };

  const openEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseDescription(expense.description);
    setExpenseAmount(expense.amount.toString());
    setExpensePaidBy(expense.paidBy);
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
    setExpenseError("");
    setIsExpenseOpen(true);
  };

  const toggleExpenseParticipant = (participantId: string) => {
    setExpenseParticipantIds((prev) => {
      const next = prev.includes(participantId)
        ? prev.filter((id) => id !== participantId)
        : [...prev, participantId];
      setExpensePercentages((prevPct) => {
        const nextPct = { ...prevPct };
        if (!next.includes(participantId)) {
          delete nextPct[participantId];
        } else if (!(participantId in nextPct)) {
          nextPct[participantId] = 0;
        }
        return nextPct;
      });
      return next;
    });
  };

  const selectAllParticipants = () => {
    if (!event) return;
    const allIds = event.participants.map((p) => p.id);
    setExpenseParticipantIds(allIds);
    setExpensePercentages((prev) => {
      const next = { ...prev };
      allIds.forEach((id) => {
        if (!(id in next)) next[id] = 0;
      });
      return next;
    });
  };

  const clearAllParticipants = () => {
    setExpenseParticipantIds([]);
    setExpensePercentages({});
  };

  const handleAutoDistribute = () => {
    setExpensePercentages((prev) => ({ ...prev, ...equalPercentages(expenseParticipantIds) }));
  };

  const handlePercentageChange = (participantId: string, value: string) => {
    const parsed = parseFloat(value);
    setExpensePercentages((prev) => ({
      ...prev,
      [participantId]: value === "" ? 0 : isNaN(parsed) ? 0 : Math.max(0, parsed),
    }));
  };

  const percentageTotal = useMemo(() => {
    return expenseParticipantIds.reduce((sum, id) => sum + (expensePercentages[id] || 0), 0);
  }, [expenseParticipantIds, expensePercentages]);

  const isPercentageValid = Math.abs(percentageTotal - 100) < 0.01;

  const livePreviewShares = useMemo(() => {
    const parsedAmount = parseFloat(expenseAmount) || 0;
    const shares: Record<string, number> = {};
    if (expenseParticipantIds.length === 0) return shares;

    if (expenseSplitMethod === "percentage") {
      expenseParticipantIds.forEach((id) => {
        shares[id] = (parsedAmount * (expensePercentages[id] || 0)) / 100;
      });
    } else {
      const share = parsedAmount / expenseParticipantIds.length;
      expenseParticipantIds.forEach((id) => {
        shares[id] = share;
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
    if (!expensePaidBy) {
      setExpenseError("Please select who paid.");
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
        ? expenseParticipantIds.map((id) => ({ id, percentage: expensePercentages[id] || 0 }))
        : expenseParticipantIds.map((id) => ({ id }));

    if (editingExpense) {
      const updatedExpenses = event.expenses.map((exp) =>
        exp.id === editingExpense.id
          ? {
              ...exp,
              description: expenseDescription.trim(),
              amount: parsedAmount,
              paidBy: expensePaidBy,
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
        paidBy: expensePaidBy,
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
                                  <p className="text-sm text-muted-foreground mt-1">
                                    Paid by <span className="font-medium text-foreground">{getParticipantName(expense.paidBy)}</span>
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
