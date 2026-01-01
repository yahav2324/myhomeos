import type { Box } from '@smart-kitchen/contracts';

export interface BoxesRepository {
  findAll(): Box[];
  findById(id: string): Box | null;
  findByDeviceId(deviceId: string): Box | null;
  save(box: Box): void;
  delete(id: string): boolean;
}
