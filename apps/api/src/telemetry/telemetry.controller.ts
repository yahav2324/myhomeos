import { Body, Controller, Get, Post } from '@nestjs/common';
import { TelemetrySchema, type Telemetry } from '@smart-kitchen/contracts';

let lastTelemetry: Telemetry | null = null;

@Controller('telemetry')
export class TelemetryController {
  @Post()
  ingest(@Body() body: unknown) {
    const parsed = TelemetrySchema.safeParse(body);

    if (!parsed.success) {
      return { ok: false, errors: parsed.error.flatten() };
    }

    lastTelemetry = parsed.data;
    return { ok: true };
  }

  @Get('last')
  getLast() {
    return { ok: true, data: lastTelemetry };
  }
}
