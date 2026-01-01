import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { BoxesModule } from '../boxes/boxes.module';
import { TelemetryStore } from './telemetry.store';

@Module({
  imports: [BoxesModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryStore],
  exports: [TelemetryStore],
})
export class TelemetryModule {}
