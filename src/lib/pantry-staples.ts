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
  "smoked paprika",
  "cumin",
  "chili powder",
  "oregano",
  "Italian seasoning",
  "thyme",
  "rosemary",
  "basil",
  "bay leaves",
  "turmeric",
  "nutmeg",
  "cinnamon",
  "cayenne pepper",
  "ground ginger",
  "mustard powder",
  "white pepper",
  "curry powder",
  "coriander",
  "red pepper flakes",

  // Oils & fats
  "olive oil",
  "vegetable oil",
  "sesame oil",
  "coconut oil",
  "cooking spray",
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
  "ketchup",
  "mustard",
  "hot sauce",
  "Worcestershire sauce",
  "honey",
  "maple syrup",
  "lemon juice",
  "lime juice",
  "tomato paste",

  // Alliums
  "garlic",
  "onion",
] as const;

export type PantryStaple = (typeof PANTRY_STAPLES)[number];
