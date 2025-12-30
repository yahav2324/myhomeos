import type { BoxItem } from './types';

export const mockBoxes: BoxItem[] = [
  {
    id: 'rice-1',
    name: 'Rice',
    capacity: 1000,
    unit: 'g',
    percent: 74,
    state: 'OK',
    quantity: 740,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'oil-1',
    name: 'Olive Oil',
    capacity: 1500,
    unit: 'ml',
    percent: 22,
    state: 'LOW',
    quantity: 330,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sugar-1',
    name: 'Sugar',
    capacity: 800,
    unit: 'g',
    percent: 3,
    state: 'EMPTY',
    quantity: 24,
    updatedAt: new Date().toISOString(),
  },
];
