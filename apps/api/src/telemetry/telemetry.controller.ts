import { Body, Controller, Post } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly service: TelemetryService) {}

  @Post()
  ingest(@Body() body: unknown) {
    return this.service.ingest(body);
  }
}
