export interface CategoryInfo {
  id: string;
  label: string;
  icon: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: "food", label: "Food", icon: "UtensilsCrossed" },
  { id: "travel", label: "Travel", icon: "Plane" },
  { id: "shopping", label: "Shopping", icon: "ShoppingBag" },
  { id: "hotel", label: "Hotel", icon: "BedDouble" },
  { id: "fuel", label: "Fuel", icon: "Fuel" },
  { id: "medical", label: "Medical", icon: "HeartPulse" },
  { id: "entertainment", label: "Entertainment", icon: "Clapperboard" },
  { id: "education", label: "Education", icon: "GraduationCap" },
  { id: "other", label: "Other", icon: "MoreHorizontal" },
];

export function getCategoryInfo(id?: string): CategoryInfo {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
