import { Injectable } from '@nestjs/common';
import { TelemetrySchema } from '@smart-kitchen/contracts';
import { BoxesService } from '../boxes/boxes.service';

@Injectable()
export class TelemetryService {
  constructor(private readonly boxes: BoxesService) {}

  ingest(body: unknown) {
    const parsed = TelemetrySchema.safeParse(body);
    if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

    const t = parsed.data;
    return this.boxes.applyTelemetryByDeviceId({
      deviceId: t.deviceId,
      quantity: t.quantity,
      timestamp: t.timestamp,
    });
  }
}
