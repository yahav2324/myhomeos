import { BoxState } from '../../../shared/types';

export type BoxItem = {
  id: string;
  code: string;
  name: string;
  unit: 'g' | 'ml';
  deviceId: string;
  fullQuantity?: number;
  capacity?: number;
  quantity: number;
  percent: number;
  state: BoxState;
  createdAt: string;
  updatedAt: string;
};
