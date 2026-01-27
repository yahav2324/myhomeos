import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly service: TelemetryService) {}

  @Post()
  async ingest(@Body() body: unknown) {
    return this.service.ingest(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('history/:boxId')
  async history(@Param('boxId') boxId: string, @Query('hours') hours?: string) {
    return this.service.history(boxId, hours);
  }
}
