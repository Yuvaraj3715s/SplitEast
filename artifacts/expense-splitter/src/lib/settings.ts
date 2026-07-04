export type ThemeName = "light" | "dark" | "amoled" | "ocean" | "forest" | "sunset" | "lavender" | "system";

export interface AppSettings {
  theme: ThemeName;
  defaultCurrency: string;
}

const SETTINGS_KEY = "expense-splitter-settings";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  defaultCurrency: "USD",
};

export function getSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme || DEFAULT_SETTINGS.theme,
      defaultCurrency: parsed.defaultCurrency || DEFAULT_SETTINGS.defaultCurrency,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function resolveEffectiveTheme(theme: ThemeName): string {
  if (theme !== "system") return theme;
  const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export const THEME_OPTIONS: { value: ThemeName; label: string }[] = [
  { value: "system", label: "Follow System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "amoled", label: "AMOLED" },
  { value: "ocean", label: "Ocean" },
  { value: "forest", label: "Forest" },
  { value: "sunset", label: "Sunset" },
  { value: "lavender", label: "Lavender" },
];
