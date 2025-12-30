import type { BoxState } from '../../../shared/components/BoxProgressBar';

export type BoxItem = {
  id: string;
  name: string;
  capacity: number;
  unit: 'g' | 'ml';
  percent: number;
  state: BoxState;
  quantity: number;
  updatedAt?: string;
};
