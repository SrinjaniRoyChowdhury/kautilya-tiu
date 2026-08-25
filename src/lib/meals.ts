export const CONFERENCE_MEAL_NAMES = ["Lunch", "Evening snacks"] as const;

export function canonicalMealName(name: string): (typeof CONFERENCE_MEAL_NAMES)[number] | null {
  const value = name.trim().toLowerCase();
  if (value === "lunch") return "Lunch";
  if (value === "evening snacks" || value === "evening snack" || value === "snacks") {
    return "Evening snacks";
  }
  return null;
}

export function isConferenceMeal(name: string): boolean {
  return canonicalMealName(name) !== null;
}
