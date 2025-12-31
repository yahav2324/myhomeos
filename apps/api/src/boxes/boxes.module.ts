import { Module } from '@nestjs/common';
import { BoxesController } from './boxes.controller';
import { BoxesService } from './boxes.service';
import { MemoryBoxesRepository } from './boxes.repo.memory';
import { BoxesGateway } from '../ws/boxes.gateway';

@Module({
  controllers: [BoxesController],
  providers: [
    BoxesService,
    BoxesGateway,

    // Repository binding
    {
      provide: 'BoxesRepository',
      useClass: MemoryBoxesRepository,
    },
  ],
  exports: [
    BoxesService,
    {
      provide: 'BoxesRepository',
      useClass: MemoryBoxesRepository,
    },
  ],
})
export class BoxesModule {}
