import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BoxSchema, CreateBoxSchema, SetFullSchema, type Box } from '@smart-kitchen/contracts';
import type { BoxesRepository } from './boxes.repository';
import { computePercent, computeState, makeCode } from '../share/utils';
import { BoxesGateway } from '../ws/boxes.gateway';

@Injectable()
export class BoxesService {
  constructor(
    @Inject('BoxesRepository') private readonly repo: BoxesRepository,
    private readonly gateway: BoxesGateway,
  ) {}

  /**
   * ✅ תמיד לעבוד לפי household.
   * השארתי את list() רק אם יש לך שימוש פנימי/legacy. מומלץ למחוק בסוף.
   */
  async list(): Promise<Box[]> {
    return this.repo.findAll();
  }

  async findAllForHousehold(householdId: string): Promise<Box[]> {
    return this.repo.findAllByHouseholdId(householdId);
  }

  async findByDeviceId(deviceId: string): Promise<Box | null> {
    return this.repo.findByDeviceId(deviceId);
  }

  async getForHousehold(householdId: string, id: string): Promise<Box | null> {
    return this.repo.findByIdInHousehold(householdId, id);
  }

  async create(
    householdId: string,
    body: unknown,
  ): Promise<{ ok: true; data: Box } | { ok: false; errors: any }> {
    const parsed = CreateBoxSchema.safeParse(body);
    if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

    const now = new Date().toISOString();

    // ✅ קודים ייחודיים בתוך הבית
    const existingCodes = (await this.repo.findAllByHouseholdId(householdId)).map((b) => b.code);

    const box: Box = {
      id: randomUUID(),
      householdId,
      code: makeCode(parsed.data.name, existingCodes),
      deviceId: parsed.data.deviceId,

      name: parsed.data.name,
      unit: parsed.data.unit,
      capacity: parsed.data.capacity,

      fullQuantity: undefined,
      quantity: 0,
      percent: 0,
      state: 'EMPTY',

      createdAt: now,
      updatedAt: now,
      lastReadingAt: undefined,
    };

    const validated = BoxSchema.safeParse(box);
    if (!validated.success) return { ok: false, errors: validated.error.flatten() };

    // ✅ deviceId uniqueness בתוך אותו בית (למרות שב-DB הוא unique גלובלי אצלך)
    const existingByDevice = await this.repo.findByDeviceIdInHousehold(
      householdId,
      parsed.data.deviceId,
    );
    if (existingByDevice) {
      return {
        ok: false,
        errors: {
          formErrors: ['Device already paired'],
          fieldErrors: { deviceId: ['Already exists'] },
        },
      };
    }

    const saved = await this.repo.save(validated.data);
    this.gateway.upsert(saved);
    return { ok: true, data: saved };
  }

  async setFullForHousehold(
    householdId: string,
    id: string,
    body: unknown,
  ): Promise<{ ok: true; data: Box } | { ok: false; errors: any }> {
    const existing = await this.repo.findByIdInHousehold(householdId, id);
    if (!existing) {
      return { ok: false, errors: { formErrors: ['Box not found'], fieldErrors: {} } };
    }

    const parsed = SetFullSchema.safeParse(body);
    if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

    if (existing.fullQuantity) {
      return {
        ok: false,
        errors: { formErrors: ['Full level already set (recalibrate later).'], fieldErrors: {} },
      };
    }

    const now = new Date().toISOString();
    const percent = computePercent(existing.quantity, parsed.data.fullQuantity);
    const state = computeState(percent);

    const updated: Box = {
      ...existing,
      fullQuantity: parsed.data.fullQuantity,
      percent,
      state,
      updatedAt: now,
    };

    const validated = BoxSchema.safeParse(updated);
    if (!validated.success) return { ok: false, errors: validated.error.flatten() };

    const saved = await this.repo.save(validated.data);
    this.gateway.upsert(saved);
    return { ok: true, data: saved };
  }

  async recalibrateFullForHousehold(
    householdId: string,
    id: string,
    body: unknown,
  ): Promise<{ ok: true; data: Box } | { ok: false; errors: any }> {
    const existing = await this.repo.findByIdInHousehold(householdId, id);
    if (!existing) {
      return { ok: false, errors: { formErrors: ['Box not found'], fieldErrors: {} } };
    }

    const parsed = SetFullSchema.safeParse(body);
    if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

    const now = new Date().toISOString();
    const percent = computePercent(existing.quantity, parsed.data.fullQuantity);
    const state = computeState(percent);

    const updated: Box = {
      ...existing,
      fullQuantity: parsed.data.fullQuantity, // overwrite בכוונה
      percent,
      state,
      updatedAt: now,
    };

    const validated = BoxSchema.safeParse(updated);
    if (!validated.success) return { ok: false, errors: validated.error.flatten() };

    const saved = await this.repo.save(validated.data);
    this.gateway.upsert(saved);
    return { ok: true, data: saved };
  }

  /**
   * נקודת כניסה לעדכון מה-Hub לפי deviceId.
   * אצלך deviceId הוא UNIQUE גלובלי, לכן זה עדיין תקין.
   */
  async applyTelemetryByDeviceId(input: {
    deviceId: string;
    quantity: number;
    timestamp?: string;
  }): Promise<{ ok: true; data: Box } | { ok: false; errors: any }> {
    const existing = await this.repo.findByDeviceId(input.deviceId);
    if (!existing) {
      return {
        ok: false,
        errors: { formErrors: ['Unknown deviceId (box not found)'], fieldErrors: {} },
      };
    }

    const now = new Date().toISOString();
    const ts = input.timestamp ?? now;

    const percent = computePercent(input.quantity, existing.fullQuantity);
    const state = existing.fullQuantity ? computeState(percent) : existing.state;

    const updated: Box = {
      ...existing,
      quantity: input.quantity,
      percent,
      state,
      lastReadingAt: ts,
      updatedAt: existing.updatedAt, // DB-truth נשמר מה-upsert return
    };

    const validated = BoxSchema.safeParse(updated);
    if (!validated.success) return { ok: false, errors: validated.error.flatten() };

    const saved = await this.repo.save(validated.data);
    this.gateway.upsert(saved);
    return { ok: true, data: saved };
  }

  async deleteBoxForHousehold(
    householdId: string,
    id: string,
  ): Promise<{ ok: true } | { ok: false; errors: any }> {
    const existing = await this.repo.findByIdInHousehold(householdId, id);
    if (!existing) {
      return { ok: false, errors: { formErrors: ['Box not found'], fieldErrors: {} } };
    }

    const deleted = await this.repo.deleteInHousehold(householdId, id);
    if (!deleted) {
      return { ok: false, errors: { formErrors: ['Delete failed'], fieldErrors: {} } };
    }

    this.gateway.delete({ id });
    return { ok: true };
  }

  async identifyBox(householdId: string, id: string): Promise<void | { ok: false; errors: any }> {
    const box = await this.repo.findByIdInHousehold(householdId, id);
    if (!box) return { ok: false, errors: { formErrors: ['Box not found'], fieldErrors: {} } };

    return this.gateway.emitIdentifyBox(id);
  }

  async setFullByCodeForHousehold(householdId: string, code: string, body: unknown) {
    const existing = await this.repo.findByCodeInHousehold(householdId, code);
    if (!existing) {
      return { ok: false, errors: { formErrors: ['Box not found'], fieldErrors: {} } };
    }
    return this.setFullForHousehold(householdId, existing.id, body);
  }
}
