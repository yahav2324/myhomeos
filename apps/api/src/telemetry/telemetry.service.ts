import { BadRequestException, Injectable } from '@nestjs/common';
import { TelemetryIngestSchema } from '@smart-kitchen/contracts';
import { BoxesService } from '../boxes/boxes.service';
import { TelemetryRepoPrisma } from './telemetry.repo.prisma';

@Injectable()
export class TelemetryService {
  constructor(
    private readonly boxes: BoxesService,
    private readonly repo: TelemetryRepoPrisma,
  ) {}

  async ingest(body: unknown) {
    const parsed = TelemetryIngestSchema.safeParse(body);
    if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

    const box = await this.boxes.findByDeviceId(parsed.data.deviceId);
    if (!box) throw new BadRequestException(`Unknown deviceId: ${parsed.data.deviceId}`);

    const t = parsed.data;

    // Box update + WS
    const res = await this.boxes.applyTelemetryByDeviceId({
      quantity: t.quantity,
      deviceId: t.deviceId,
      timestamp: t.timestamp,
    });

    // אם הצליח — נרשום event ל-DB
    if (res.ok) {
      const b = res.data;
      const ts = t.timestamp ?? new Date().toISOString();

      await this.repo.append({
        boxId: box.id,
        quantity: b.quantity,
        percent: b.percent,
        state: b.state,
        timestamp: ts,
      });
    }

    return res;
  }

  async history(boxId: string, hours?: string) {
    const h = Number(hours ?? 24);
    const safeH = Number.isFinite(h) && h > 0 ? h : 24;
    const since = new Date(Date.now() - safeH * 60 * 60 * 1000).toISOString();

    return { ok: true, data: await this.repo.list(boxId, since) };
  }
}
