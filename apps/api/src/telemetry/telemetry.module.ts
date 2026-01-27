import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';
import { BoxesModule } from '../boxes/boxes.module';
import { TelemetryRepoPrisma } from './telemetry.repo.prisma';

@Module({
  imports: [BoxesModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryRepoPrisma],
})
export class TelemetryModule {}
