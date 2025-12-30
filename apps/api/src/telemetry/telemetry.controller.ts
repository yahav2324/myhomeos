import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TelemetrySchema, type Telemetry } from '@smart-kitchen/contracts';

// האחרון הכללי (ללא boxId)
let lastTelemetryGlobal: Telemetry | null = null;

// האחרון לפי boxId
const lastByBoxId = new Map<string, Telemetry>();

@Controller('telemetry')
export class TelemetryController {
  @Post()
  ingest(@Body() body: unknown) {
    const parsed = TelemetrySchema.safeParse(body);

    if (!parsed.success) {
      return { ok: false, errors: parsed.error.flatten() };
    }

    const t = parsed.data;

    // שמירה אחרונה כללית
    lastTelemetryGlobal = t;

    // שמירה אחרונה לפי boxId
    if (t.boxId) {
      lastByBoxId.set(t.boxId, t);
    }

    return { ok: true };
  }

  // GET /telemetry/last?boxId=rice-1  -> האחרון של rice-1
  // GET /telemetry/last              -> האחרון הכללי
  @Get('last')
  getLast(@Query('boxId') boxId?: string) {
    const data = boxId ? lastByBoxId.get(boxId) : lastTelemetryGlobal;
    if (!data) return { ok: false, error: 'NOT_FOUND' };

    return { ok: true, data };
  }
}
