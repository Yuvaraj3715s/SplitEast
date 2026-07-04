import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { Plus, Trash2, Calendar, Users, Wallet } from "lucide-react";
import { getEvents, saveEvents, Event } from "@/lib/storage";
import { formatCurrency } from "@/lib/calculations";
import { motion, AnimatePresence } from "framer-motion";

export default function EventList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState("");

  useEffect(() => {
    setEvents(getEvents());
  }, []);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    const newEvent: Event = {
      id: crypto.randomUUID(),
      name: newEventName.trim(),
      date: newEventDate || new Date().toISOString().split("T")[0],
      participants: [],
      expenses: [],
      settlements: []
    };

    const updatedEvents = [newEvent, ...events];
    setEvents(updatedEvents);
    saveEvents(updatedEvents);
    
    setNewEventName("");
    setNewEventDate("");
    setIsDialogOpen(false);
  };

  const handleDeleteEvent = (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    const updatedEvents = events.filter(e => e.id !== id);
    setEvents(updatedEvents);
    saveEvents(updatedEvents);
  };

  return (
    <div className="min-h-screen bg-app pb-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 mt-6">
          <div>
            <h1 className="text-5xl font-black tracking-tighter text-foreground">SplitEasy</h1>
            <p className="text-lg font-medium text-muted-foreground mt-2">Settle up smoothly.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-event" size="lg" className="rounded-full shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-foreground text-background hover:bg-foreground/90">
                <Plus className="w-5 h-5 mr-2" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-none shadow-2xl sm:rounded-[32px]">
              <form onSubmit={handleCreateEvent}>
                <DialogHeader className="px-2 pt-2">
                  <DialogTitle className="text-2xl font-bold tracking-tight">Create New Event</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-6 px-2">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Event Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Weekend Getaway" 
                      value={newEventName}
                      onChange={e => setNewEventName(e.target.value)}
                      data-testid="input-event-name"
                      autoFocus
                      className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 dark:border-white/10 text-lg px-4"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="date" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Date</Label>
                    <Input 
                      id="date" 
                      type="date"
                      value={newEventDate}
                      onChange={e => setNewEventDate(e.target.value)}
                      data-testid="input-event-date"
                      className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 dark:border-white/10 text-lg px-4"
                    />
                  </div>
                </div>
                <DialogFooter className="px-2 pb-2">
                  <Button type="submit" disabled={!newEventName.trim()} data-testid="button-save-event" size="lg" className="w-full rounded-2xl h-14 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20">
                    Create Event
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {events.length === 0 ? (
          <div className="text-center py-32 glass-card rounded-[32px] flex flex-col items-center justify-center">
            <div className="bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-inner">
              <Wallet className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-foreground mb-4">No events yet</h3>
            <p className="text-lg text-muted-foreground max-w-sm mx-auto mb-10">
              Create an event to start tracking shared expenses with your friends.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} size="lg" className="rounded-full shadow-lg shadow-primary/20 h-14 px-8 text-lg font-semibold">
              Create your first event
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {events.map((event, index) => {
                const totalSpent = event.expenses.reduce((sum, exp) => sum + exp.amount, 0);
                const hasBalances = totalSpent > 0;
                
                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                    className="h-full"
                  >
                    <Link href={`/events/${event.id}`} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[32px]">
                      <Card className="h-full flex flex-col group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 glass-card rounded-[32px] border-none overflow-hidden cursor-pointer relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 opacity-50 pointer-events-none"></div>
                        <CardHeader className="pb-4 relative z-10 p-6">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-4">
                              <CardTitle className="text-2xl font-bold tracking-tight line-clamp-1 mb-2" data-testid={`text-event-name-${event.id}`}>
                                {event.name}
                              </CardTitle>
                              <CardDescription className="flex items-center text-sm font-medium text-muted-foreground/80 uppercase tracking-wider">
                                <Calendar className="w-4 h-4 mr-2" />
                                {event.date ? format(new Date(event.date), "MMM d, yyyy") : "No date"}
                              </CardDescription>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full shrink-0 -mt-2 -mr-2"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDeleteEvent(event.id);
                              }}
                              data-testid={`button-delete-event-${event.id}`}
                            >
                              <Trash2 className="w-5 h-5" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="pb-6 flex-grow relative z-10 px-6">
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">Total Spent</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-black tracking-tighter text-foreground">
                                  {formatCurrency(totalSpent)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center bg-background/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 dark:border-white/5">
                              <Users className="w-4 h-4 mr-1.5 text-primary" />
                              <span className="font-semibold text-sm">{event.participants.length}</span>
                            </div>
                          </div>
                        </CardContent>
                        <CardFooter className="pt-0 mt-auto relative z-10 px-6 pb-6">
                          <div className={`w-full flex items-center justify-center py-3 rounded-2xl font-semibold transition-colors ${hasBalances ? 'bg-primary text-primary-foreground group-hover:bg-primary/90 shadow-md shadow-primary/20' : 'bg-secondary text-secondary-foreground group-hover:bg-secondary/80'}`} data-testid={`link-event-${event.id}`}>
                            {hasBalances ? "Settle Up" : "Add Expenses"}
                          </div>
                        </CardFooter>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
