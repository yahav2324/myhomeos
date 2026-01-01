import { Module } from '@nestjs/common';
import { BoxesController } from './boxes.controller';
import { BoxesService } from './boxes.service';
import { MemoryBoxesRepository } from './boxes.repo.memory';
import { BoxesGateway } from '../ws/boxes.gateway';
import { TelemetryStore } from '../telemetry/telemetry.store';

@Module({
  controllers: [BoxesController],
  providers: [
    BoxesService,
    BoxesGateway,
    TelemetryStore,

    {
      provide: 'BoxesRepository',
      useClass: MemoryBoxesRepository,
    },
  ],
  exports: [
    BoxesService,
    TelemetryStore,

    {
      provide: 'BoxesRepository',
      useClass: MemoryBoxesRepository,
    },
  ],
})
export class BoxesModule {}
