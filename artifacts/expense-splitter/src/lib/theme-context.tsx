import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AppSettings, getSettings, saveSettings, resolveEffectiveTheme, ThemeName } from "@/lib/settings";

interface ThemeContextValue {
  settings: AppSettings;
  setTheme: (theme: ThemeName) => void;
  setDefaultCurrency: (code: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDom(theme: ThemeName) {
  const effective = resolveEffectiveTheme(theme);
  const root = document.documentElement;
  const darkThemes = ["dark", "amoled"];
  const isDark = darkThemes.includes(effective) || (theme !== "light" && darkThemes.includes(effective));

  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  const paletteTheme = theme === "system" ? effective : theme;
  root.setAttribute("data-theme", paletteTheme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => getSettings());

  useEffect(() => {
    applyThemeToDom(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeToDom("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [settings.theme]);

  const setTheme = useCallback((theme: ThemeName) => {
    setSettings((prev) => {
      const next = { ...prev, theme };
      saveSettings(next);
      return next;
    });
  }, []);

  const setDefaultCurrency = useCallback((code: string) => {
    setSettings((prev) => {
      const next = { ...prev, defaultCurrency: code };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ settings, setTheme, setDefaultCurrency }}>{children}</ThemeContext.Provider>
  );
}

export function useAppSettings(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppSettings must be used within ThemeProvider");
  return ctx;
}
