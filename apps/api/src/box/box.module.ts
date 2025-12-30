import { Module } from '@nestjs/common';
import { BoxController } from './box.controller';

@Module({
  controllers: [BoxController],
})
export class BoxModule {}
