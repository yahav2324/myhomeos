import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryStore } from './telemetry.store';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly service: TelemetryService) {}

  @Post()
  ingest(@Body() body: unknown) {
    return this.service.ingest(body);
  }

  @Get('history/:boxId')
  history(@Param('boxId') boxId: string, @Query('hours') hours?: string) {
    return this.service.history(boxId, hours);
  }
}
