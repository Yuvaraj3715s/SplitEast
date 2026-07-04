import React, { useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Download, Upload, DatabaseBackup, Trash2, Palette, Coins } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppSettings } from "@/lib/theme-context";
import { THEME_OPTIONS, ThemeName } from "@/lib/settings";
import { CURRENCIES } from "@/lib/currency";
import { exportAllData, importAllData } from "@/lib/storage";
import { vibrate } from "@/lib/haptics";

const THEME_SWATCHES: Record<ThemeName, string> = {
  system: "linear-gradient(135deg,#94a3b8,#334155)",
  light: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
  dark: "linear-gradient(135deg,#1e293b,#0f172a)",
  amoled: "linear-gradient(135deg,#000000,#1a1a1a)",
  ocean: "linear-gradient(135deg,#38bdf8,#0369a1)",
  forest: "linear-gradient(135deg,#4ade80,#166534)",
  sunset: "linear-gradient(135deg,#fb923c,#dc2626)",
  lavender: "linear-gradient(135deg,#c4b5fd,#7c3aed)",
};

export default function SettingsPage() {
  const { settings, setTheme, setDefaultCurrency } = useAppSettings();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleExport = () => {
    const json = exportAllData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spliteasy-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    vibrate(10);
    toast({ title: "Backup exported", description: "Your data has been downloaded as a JSON file." });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = importAllData(String(reader.result));
      if (result.success) {
        vibrate([10, 30, 10]);
        toast({ title: "Import successful", description: `Restored ${result.count} event(s). Reloading...` });
        setTimeout(() => window.location.reload(), 900);
      } else {
        toast({ title: "Import failed", description: result.error || "Invalid file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    localStorage.removeItem("expense-splitter-events");
    vibrate([10, 40, 10]);
    toast({ title: "All data cleared" });
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="min-h-screen bg-app pb-32">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
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
        >
          Settings
        </motion.h1>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="glass-card rounded-[32px] border-none mb-6 overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <Palette className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Theme</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEME_OPTIONS.map((opt) => {
                  const active = settings.theme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      data-testid={`button-theme-${opt.value}`}
                      onClick={() => {
                        setTheme(opt.value);
                        vibrate(8);
                      }}
                      className={`relative flex flex-col items-center gap-2 rounded-2xl p-3 border transition-all ${
                        active
                          ? "border-primary ring-2 ring-primary/40 scale-[1.03]"
                          : "border-white/30 dark:border-white/10 hover:scale-[1.03]"
                      }`}
                    >
                      <div
                        className="w-full h-12 rounded-xl shadow-inner"
                        style={{ background: THEME_SWATCHES[opt.value] }}
                      />
                      <span className="text-xs font-semibold text-center leading-tight">{opt.label}</span>
                      {active && (
                        <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-1 shadow-md">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card rounded-[32px] border-none mb-6 overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <Coins className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Default Currency</h2>
              </div>
              <Select value={settings.defaultCurrency} onValueChange={(v) => setDefaultCurrency(v)}>
                <SelectTrigger data-testid="select-default-currency" className="h-14 rounded-2xl bg-background/50 backdrop-blur-sm border-white/20 dark:border-white/10 text-lg px-4">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.symbol} {c.code} — {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-3">
                Used for new events unless you set a currency per event.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="glass-card rounded-[32px] border-none mb-6 overflow-hidden">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-5">
                <DatabaseBackup className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Data</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  data-testid="button-export-data"
                  variant="outline"
                  onClick={handleExport}
                  className="h-14 rounded-2xl justify-start bg-background/50 backdrop-blur-sm border-white/20 dark:border-white/10"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Export / Backup
                </Button>
                <Button
                  data-testid="button-import-data"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-14 rounded-2xl justify-start bg-background/50 backdrop-blur-sm border-white/20 dark:border-white/10"
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Import / Restore
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  data-testid="input-import-file"
                  onChange={handleImportFile}
                />
              </div>
              <Button
                data-testid="button-clear-data"
                variant="outline"
                onClick={handleClearData}
                onBlur={() => setConfirmClear(false)}
                className={`h-14 rounded-2xl justify-start w-full mt-3 ${
                  confirmClear
                    ? "bg-destructive text-destructive-foreground border-destructive hover:bg-destructive/90"
                    : "bg-background/50 backdrop-blur-sm border-white/20 dark:border-white/10 text-destructive"
                }`}
              >
                <Trash2 className="w-5 h-5 mr-2" />
                {confirmClear ? "Click again to confirm — this cannot be undone" : "Clear All Data"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
