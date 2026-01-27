import { Module } from '@nestjs/common';
import { BoxesController } from './boxes.controller';
import { BoxesService } from './boxes.service';
import { BoxesGateway } from '../ws/boxes.gateway';
import { BoxesRepoPrisma } from './boxes.repo.prisma';

@Module({
  controllers: [BoxesController],
  providers: [
    BoxesService,
    BoxesGateway,
    {
      provide: 'BoxesRepository',
      useClass: BoxesRepoPrisma,
    },
  ],
  exports: [BoxesService, 'BoxesRepository'],
})
export class BoxesModule {}
