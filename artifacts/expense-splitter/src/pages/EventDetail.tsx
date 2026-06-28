import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus, Trash2, Edit2, Receipt, ArrowRight, Users } from "lucide-react";
import { getEvents, saveEvents, Event, Participant } from "@/lib/storage";
import { calculateBalances, calculateSettlements, formatCurrency } from "@/lib/calculations";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    const events = getEvents();
    const foundEvent = events.find(e => e.id === id);
    if (foundEvent) {
      setEvent(foundEvent);
    }
  }, [id]);

  const updateEvent = (updatedEvent: Event) => {
    setEvent(updatedEvent);
    const events = getEvents();
    const index = events.findIndex(e => e.id === updatedEvent.id);
    if (index !== -1) {
      events[index] = updatedEvent;
      saveEvents(events);
    }
  };

  const handleAddParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !event) return;

    const parsedAmount = parseFloat(amount);
    const newParticipant: Participant = {
      id: crypto.randomUUID(),
      name: name.trim(),
      amountPaid: isNaN(parsedAmount) ? 0 : parsedAmount
    };

    updateEvent({
      ...event,
      participants: [...event.participants, newParticipant]
    });

    setName("");
    setAmount("");
    setIsAddOpen(false);
  };

  const handleEditParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !event || !editingParticipant) return;

    const parsedAmount = parseFloat(amount);
    
    const updatedParticipants = event.participants.map(p => 
      p.id === editingParticipant.id 
        ? { ...p, name: name.trim(), amountPaid: isNaN(parsedAmount) ? 0 : parsedAmount }
        : p
    );

    updateEvent({
      ...event,
      participants: updatedParticipants
    });

    setEditingParticipant(null);
    setIsEditOpen(false);
  };

  const handleDeleteParticipant = (participantId: string) => {
    if (!event) return;
    updateEvent({
      ...event,
      participants: event.participants.filter(p => p.id !== participantId)
    });
  };

  const openEdit = (p: Participant) => {
    setEditingParticipant(p);
    setName(p.name);
    setAmount(p.amountPaid ? p.amountPaid.toString() : "");
    setIsEditOpen(true);
  };

  const balances = useMemo(() => {
    if (!event) return [];
    return calculateBalances(event.participants);
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

  const totalSpent = event.participants.reduce((sum, p) => sum + p.amountPaid, 0);
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
          
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            if(open) {
              setName("");
              setAmount("");
            }
            setIsAddOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-participant" className="rounded-full shadow-sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Person
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAddParticipant}>
                <DialogHeader>
                  <DialogTitle>Add Person & Expense</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Alice" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      data-testid="input-participant-name"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount Paid ($)</Label>
                    <Input 
                      id="amount" 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      data-testid="input-participant-amount"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!name.trim()} data-testid="button-save-participant">
                    Add
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {event.participants.length > 0 && (
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
                <p className="text-sm font-medium text-primary mb-1">Fair Share (per person)</p>
                <p className="text-3xl font-bold text-primary">{formatCurrency(fairShare)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              Who paid what?
            </h2>
            
            {event.participants.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border shadow-sm border-dashed">
                <p className="text-muted-foreground">No one added yet.</p>
                <Button onClick={() => setIsAddOpen(true)} variant="link" className="mt-2 text-primary">
                  Add someone to get started
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnimatePresence>
                  {balances.map(b => (
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
                              <h3 className="font-semibold text-lg" data-testid={`text-name-${b.id}`}>{b.name}</h3>
                              <div className="flex gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => openEdit(b)}
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
                                {formatCurrency(b.amountPaid)}
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
            )}
          </section>

          {event.participants.length > 1 && settlements.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                <Receipt className="w-5 h-5 text-muted-foreground" />
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
              <p className="text-emerald-700 dark:text-emerald-400 font-medium">All settled up! 🎉 Everyone has paid their fair share.</p>
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
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
                    value={name}
                    onChange={e => setName(e.target.value)}
                    data-testid="input-edit-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">Amount Paid ($)</Label>
                  <Input 
                    id="edit-amount" 
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    data-testid="input-edit-amount"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!name.trim()} data-testid="button-update-participant">
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        
      </div>
    </div>
  );
}
