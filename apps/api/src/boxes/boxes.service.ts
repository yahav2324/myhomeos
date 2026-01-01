import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BoxSchema, CreateBoxSchema, SetFullSchema, type Box } from '@smart-kitchen/contracts';
import type { BoxesRepository } from './boxes.repository';
import { computePercent, computeState, makeCode } from '../share/utils';
import { BoxesGateway } from '../ws/boxes.gateway';
import { TelemetryStore } from '../telemetry/telemetry.store';

@Injectable()
export class BoxesService {
  constructor(
    @Inject('BoxesRepository') private readonly repo: BoxesRepository,
    private readonly gateway: BoxesGateway,
    private readonly telemetry: TelemetryStore,
  ) {}

  list(): Box[] {
    return this.repo.findAll();
  }

  get(id: string): Box | null {
    return this.repo.findById(id);
  }

  create(body: unknown): { ok: true; data: Box } | { ok: false; errors: any } {
    const parsed = CreateBoxSchema.safeParse(body);
    if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

    const now = new Date().toISOString();
    const existingCodes = this.repo.findAll().map((b) => b.code);

    const box: Box = {
      id: randomUUID(),
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
    };

    const validated = BoxSchema.safeParse(box);
    if (!validated.success) return { ok: false, errors: validated.error.flatten() };

    this.repo.save(validated.data);
    this.gateway.upsert(validated.data);

    return { ok: true, data: validated.data };
  }

  setFull(id: string, body: unknown): { ok: true; data: Box } | { ok: false; errors: any } {
    const existing = this.repo.findById(id);
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

    this.repo.save(validated.data);
    this.gateway.upsert(validated.data);

    return { ok: true, data: validated.data };
  }

  recalibrateFull(id: string, body: unknown): { ok: true; data: Box } | { ok: false; errors: any } {
    const existing = this.repo.findById(id);
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

    this.repo.save(validated.data);
    this.gateway.upsert(validated.data);

    return { ok: true, data: validated.data };
  }

  // נקודת כניסה לעדכון מה-Hub/WebSocket
  applyTelemetryByDeviceId(input: { deviceId: string; quantity: number; timestamp?: string }) {
    const existing = this.repo.findByDeviceId(input.deviceId);
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
      updatedAt: ts,
    };

    const validated = BoxSchema.safeParse(updated);
    if (!validated.success) return { ok: false, errors: validated.error.flatten() };

    this.telemetry.append({
      boxId: validated.data.id,
      quantity: validated.data.quantity,
      percent: validated.data.percent,
      state: validated.data.state,
      timestamp: validated.data.updatedAt,
    });

    this.repo.save(validated.data);
    this.gateway.upsert(validated.data);

    return { ok: true, data: validated.data };
  }

  deleteBox(id: string): { ok: true } | { ok: false; errors: any } {
    const existing = this.repo.findById(id);
    if (!existing) {
      return { ok: false, errors: { formErrors: ['Box not found'], fieldErrors: {} } };
    }

    const deleted = this.repo.delete(id);
    if (!deleted) {
      return { ok: false, errors: { formErrors: ['Delete failed'], fieldErrors: {} } };
    }

    this.gateway.delete({ id });
    this.telemetry.deleteBox(id);

    return { ok: true };
  }
}
