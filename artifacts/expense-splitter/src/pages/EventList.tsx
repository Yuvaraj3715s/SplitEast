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
      expenses: []
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
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 mt-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">SplitEasy</h1>
            <p className="text-muted-foreground mt-1">Split expenses with friends, no drama.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-event" className="rounded-full shadow-sm">
                <Plus className="w-5 h-5 mr-2" />
                New Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateEvent}>
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Event Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Weekend Getaway" 
                      value={newEventName}
                      onChange={e => setNewEventName(e.target.value)}
                      data-testid="input-event-name"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input 
                      id="date" 
                      type="date"
                      value={newEventDate}
                      onChange={e => setNewEventDate(e.target.value)}
                      data-testid="input-event-date"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!newEventName.trim()} data-testid="button-save-event">
                    Create
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {events.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-xl border shadow-sm border-dashed">
            <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-medium text-foreground mb-2">No events yet</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mb-6">
              Create an event to start tracking shared expenses with your friends.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              Create your first event
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {events.map(event => {
                const totalSpent = event.expenses.reduce((sum, exp) => sum + exp.amount, 0);
                const hasBalances = totalSpent > 0;
                
                return (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="h-full flex flex-col group hover:shadow-md transition-shadow duration-200">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="line-clamp-1" data-testid={`text-event-name-${event.id}`}>
                              {event.name}
                            </CardTitle>
                            <CardDescription className="flex items-center mt-1">
                              <Calendar className="w-3 h-3 mr-1" />
                              {event.date ? format(new Date(event.date), "MMM d, yyyy") : "No date"}
                            </CardDescription>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity -mt-2 -mr-2"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDeleteEvent(event.id);
                            }}
                            data-testid={`button-delete-event-${event.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4 flex-grow">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <Users className="w-4 h-4 mr-1.5 text-primary/70" />
                            <span>{event.participants.length}</span>
                          </div>
                          <div className="flex items-center font-medium text-foreground">
                            {formatCurrency(totalSpent)} total
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0 border-t mt-auto">
                        <Link href={`/events/${event.id}`} className="w-full mt-4">
                          <Button variant={hasBalances ? "outline" : "secondary"} className="w-full" data-testid={`link-event-${event.id}`}>
                            {hasBalances ? "Settle Up" : "Add Expenses"}
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
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
