/**
 * Items every home cook is assumed to have on hand.
 * Recipe suggestions treat these as always available so users don't need to
 * add them to their ingredient list manually.
 */
export const PANTRY_STAPLES = [
  // Seasonings
  "salt",
  "black pepper",
  "garlic powder",
  "onion powder",
  "paprika",
  "cumin",
  "chili powder",
  "oregano",
  "cinnamon",
  "red pepper flakes",

  // Oils & fats
  "olive oil",
  "vegetable oil",
  "butter",

  // Baking & pantry basics
  "all-purpose flour",
  "sugar",
  "brown sugar",
  "baking powder",
  "baking soda",
  "vanilla extract",

  // Acids & condiments
  "white vinegar",
  "soy sauce",

  // Alliums
  "garlic",
  "onion",
] as const;

export type PantryStaple = (typeof PANTRY_STAPLES)[number];
