import { Injectable, Param, Query } from '@nestjs/common';
import { TelemetrySchema } from '@smart-kitchen/contracts';
import { BoxesService } from '../boxes/boxes.service';
import { TelemetryStore } from './telemetry.store';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly boxes: BoxesService,
    private readonly store: TelemetryStore,
  ) {}

  ingest(body: unknown) {
    const parsed = TelemetrySchema.safeParse(body);
    if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

    const t = parsed.data;

    const res = this.boxes.applyTelemetryByDeviceId({
      deviceId: t.deviceId,
      quantity: t.quantity,
      timestamp: t.timestamp,
    });

    // ✅ אם הצליח – נרשום נקודה להיסטוריה
    if (res.ok) {
      const b = res.data;
      this.store.append({
        boxId: b.id,
        quantity: b.quantity,
        percent: b.percent,
        state: b.state,
        timestamp: b.updatedAt, // או new Date().toISOString() אם אתה רוצה זמן שרת
      });
    }

    return res;
  }

  history(boxId: string, hours?: string) {
    const h = Number(hours ?? 24);
    const safeH = Number.isFinite(h) && h > 0 ? h : 24;
    const since = new Date(Date.now() - safeH * 60 * 60 * 1000).toISOString();
    return { ok: true, data: this.store.list(boxId, since) };
  }
}
