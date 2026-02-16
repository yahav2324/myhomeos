export const SHOPPING_CATEGORIES = [
  'VEGETABLES',
  'FRUITS',
  'DAIRY',
  'MEAT_FISH',
  'BAKERY',
  'PANTRY',
  'SPICES',
  'FROZEN',
  'DRINKS',
  'SNACKS',
  'CLEANING',
  'BABY',
  'PHARM',
  'OTHER',
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const SHOPPING_CATEGORY_LABELS_HE: Record<ShoppingCategory, string> = {
  VEGETABLES: 'ירקות',
  FRUITS: 'פירות',
  DAIRY: 'מוצרי חלב',
  MEAT_FISH: 'בשר/דגים',
  BAKERY: 'מאפייה',
  PANTRY: 'מזווה',
  SPICES: 'תבלינים',
  FROZEN: 'קפואים',
  DRINKS: 'שתייה',
  SNACKS: 'נשנושים',
  CLEANING: 'ניקיון',
  BABY: 'תינוק',
  PHARM: 'פארם',
  OTHER: 'אחר',
};
