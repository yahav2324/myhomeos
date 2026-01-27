import { Injectable } from '@nestjs/common';
import type { Box } from '@smart-kitchen/contracts';
import type { BoxesRepository } from './boxes.repository';
import { PrismaService } from '../prisma/prisma.service';
import type { BoxState, Unit } from '@prisma/client';

function toContract(row: any): Box {
  return {
    id: row.id,
    code: row.code,
    deviceId: row.deviceId,

    name: row.name,
    unit: row.unit,
    capacity: row.capacity ?? undefined,

    fullQuantity: row.fullQuantity ?? undefined,
    quantity: row.quantity,
    percent: row.percent,
    state: row.state,

    householdId: row.householdId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastReadingAt: row.lastReadingAt ? row.lastReadingAt.toISOString() : undefined,
  };
}

@Injectable()
export class BoxesRepoPrisma implements BoxesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCodeInHousehold(householdId: string, code: string): Promise<Box | null> {
    const row = await this.prisma.box.findFirst({
      where: { code, householdId },
    });
    return row ? toContract(row) : null;
  }

  async findAll(): Promise<Box[]> {
    const rows = await this.prisma.box.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(toContract);
  }

  async findByIdInHousehold(householdId: string, id: string): Promise<Box | null> {
    const row = await this.prisma.box.findFirst({
      where: { id, householdId },
    });
    return row ? toContract(row) : null;
  }

  async findAllByHouseholdId(householdId: string): Promise<Box[]> {
    const rows = await this.prisma.box.findMany({
      where: { householdId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(toContract);
  }

  async findByDeviceIdInHousehold(householdId: string, deviceId: string): Promise<Box | null> {
    const row = await this.prisma.box.findFirst({
      where: { householdId, deviceId },
    });
    return row ? toContract(row) : null;
  }

  async findByDeviceId(deviceId: string): Promise<Box | null> {
    const row = await this.prisma.box.findUnique({ where: { deviceId } });
    return row ? toContract(row) : null;
  }

  // ✅ מחזיר את ה-row המעודכן מה-DB (כולל updatedAt אמיתי)
  async save(box: Box): Promise<Box> {
    const row = await this.prisma.box.upsert({
      where: { id: box.id },
      create: {
        id: box.id,
        code: box.code,
        deviceId: box.deviceId,

        name: box.name,
        unit: box.unit as Unit,
        capacity: box.capacity ?? null,

        householdId: box.householdId,
        fullQuantity: box.fullQuantity ?? null,
        quantity: box.quantity,
        percent: box.percent,
        state: box.state as BoxState,

        lastReadingAt: box.lastReadingAt ? new Date(box.lastReadingAt) : null,
        createdAt: new Date(box.createdAt),
        // updatedAt מנוהל ע"י @updatedAt
      },
      update: {
        name: box.name,
        unit: box.unit as Unit,
        capacity: box.capacity ?? null,

        fullQuantity: box.fullQuantity ?? null,
        quantity: box.quantity,
        percent: box.percent,
        state: box.state as BoxState,

        lastReadingAt: box.lastReadingAt ? new Date(box.lastReadingAt) : null,
      },
    });

    return toContract(row);
  }

  async deleteInHousehold(householdId: string, id: string): Promise<boolean> {
    const res = await this.prisma.box.deleteMany({
      where: { id, householdId },
    });
    return res.count === 1;
  }
}
