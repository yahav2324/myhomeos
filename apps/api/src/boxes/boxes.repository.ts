import type { Box } from '@smart-kitchen/contracts';

export interface BoxesRepository {
  findAll(): Promise<Box[]>;
  findByCodeInHousehold(householdId: string, code: string): Promise<Box | null>;
  findByIdInHousehold(householdId: string, id: string): Promise<Box | null>;
  deleteInHousehold(householdId: string, id: string): Promise<boolean>;
  findByDeviceId(deviceId: string): Promise<Box | null>;
  save(box: Box): Promise<Box>;
  findAllByHouseholdId(householdId: string): Promise<Box[]>;
  findByDeviceIdInHousehold(householdId: string, deviceId: string): Promise<Box | null>;
}
