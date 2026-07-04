import React, { useMemo } from "react";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, Crown, Flame, Wallet, Users } from "lucide-react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { getEvents } from "@/lib/storage";
import { getCategoryInfo, CATEGORIES } from "@/lib/categories";
import { CountUp } from "@/components/ui/count-up";
import { formatMoney } from "@/lib/currency";
import { useAppSettings } from "@/lib/theme-context";

const CHART_COLORS = ["#6366f1", "#a855f7", "#ec4899", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#84cc16"];

export default function Statistics() {
  const { settings } = useAppSettings();
  const events = useMemo(() => getEvents(), []);

  const allExpenses = useMemo(
    () => events.flatMap((ev) => ev.expenses.map((exp) => ({ ...exp, eventName: ev.name, eventId: ev.id }))),
    [events]
  );

  const totalSpent = allExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalParticipants = new Set(events.flatMap((e) => e.participants.map((p) => p.id))).size;
  const averageShare = allExpenses.length > 0
    ? allExpenses.reduce((sum, e) => sum + e.amount / Math.max(1, e.participantIds.length), 0) / allExpenses.length
    : 0;

  const largestExpense = allExpenses.reduce(
    (max, e) => (e.amount > (max?.amount || 0) ? e : max),
    null as (typeof allExpenses)[number] | null
  );

  const paidByTotals = useMemo(() => {
    const map = new Map<string, number>();
    events.forEach((ev) => {
      const names = new Map(ev.participants.map((p) => [p.id, p.name]));
      ev.expenses.forEach((exp) => {
        if (exp.paymentMethod === "single" && exp.paidBy) {
          const name = names.get(exp.paidBy) || "Unknown";
          map.set(name, (map.get(name) || 0) + exp.amount);
        } else if (exp.paymentMethod === "multiple") {
          exp.payments.forEach((p) => {
            const name = names.get(p.participantId) || "Unknown";
            map.set(name, (map.get(name) || 0) + p.amount);
          });
        }
      });
    });
    type TopSpender = { name: string; amount: number };
    let top: TopSpender | null = null;
    map.forEach((amount, name) => {
      if (top === null || amount > (top as TopSpender).amount) top = { name, amount };
    });
    return top as TopSpender | null;
  }, [events]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    allExpenses.forEach((exp) => {
      const cat = exp.category || "other";
      map.set(cat, (map.get(cat) || 0) + exp.amount);
    });
    return Array.from(map.entries())
      .map(([id, value]) => ({ ...getCategoryInfo(id), id, value }))
      .sort((a, b) => b.value - a.value);
  }, [allExpenses]);

  const hasData = allExpenses.length > 0;

  return (
    <div className="min-h-screen bg-app pb-32">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-semibold tracking-wide uppercase text-muted-foreground hover:text-foreground transition-all duration-300 mb-8 bg-background/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 dark:border-white/5 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:bg-background/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-black tracking-tighter text-foreground mb-8"
          data-testid="text-statistics-title"
        >
          Statistics
        </motion.h1>

        {!hasData ? (
          <div className="text-center py-24 glass-card rounded-[40px]">
            <TrendingUp className="w-14 h-14 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-xl font-bold text-foreground mb-1">No data yet</p>
            <p className="text-muted-foreground">Add some expenses to see insights here.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Spent", value: totalSpent, icon: Wallet, money: true },
                { label: "People", value: totalParticipants, icon: Users, money: false },
                { label: "Avg. Share", value: averageShare, icon: TrendingUp, money: true },
                { label: "Largest Expense", value: largestExpense?.amount || 0, icon: Flame, money: true },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="glass-card rounded-[28px] border-none h-full">
                    <CardContent className="p-5 flex flex-col justify-center h-full">
                      <stat.icon className="w-4 h-4 text-primary mb-2" />
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        {stat.label}
                      </p>
                      {stat.money ? (
                        <span className="text-2xl font-black tracking-tighter text-foreground">
                          {formatMoney(stat.value, settings.defaultCurrency)}
                        </span>
                      ) : (
                        <CountUp className="text-2xl font-black tracking-tighter text-foreground" value={stat.value} decimals={0} />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Card className="glass-card rounded-[32px] border-none overflow-hidden h-full">
                  <CardContent className="p-6 sm:p-8">
                    <h2 className="text-lg font-bold tracking-tight mb-4">Spending by Category</h2>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryBreakdown}
                            dataKey="value"
                            nameKey="label"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            strokeWidth={0}
                          >
                            {categoryBreakdown.map((entry, index) => (
                              <Cell key={entry.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatMoney(v, settings.defaultCurrency)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {categoryBreakdown.map((entry, index) => (
                        <div key={entry.id} className="flex items-center gap-2 text-sm">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="truncate font-medium">{entry.label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex flex-col gap-6">
                <Card className="glass-card rounded-[32px] border-none overflow-hidden flex-1">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="w-5 h-5 text-amber-500" />
                      <h2 className="text-lg font-bold tracking-tight">Top Spender</h2>
                    </div>
                    {paidByTotals ? (
                      <div>
                        <p className="text-2xl font-black tracking-tighter text-foreground" data-testid="text-top-spender">
                          {paidByTotals.name}
                        </p>
                        <p className="text-muted-foreground font-medium">
                          paid {formatMoney(paidByTotals.amount, settings.defaultCurrency)} in total
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No payments recorded yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card rounded-[32px] border-none overflow-hidden flex-1">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-2 mb-3">
                      <Flame className="w-5 h-5 text-rose-500" />
                      <h2 className="text-lg font-bold tracking-tight">Largest Expense</h2>
                    </div>
                    {largestExpense ? (
                      <div>
                        <p className="text-2xl font-black tracking-tighter text-foreground" data-testid="text-largest-expense">
                          {formatMoney(largestExpense.amount, settings.defaultCurrency)}
                        </p>
                        <p className="text-muted-foreground font-medium truncate">
                          {largestExpense.description} · {largestExpense.eventName}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No expenses recorded yet.</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
