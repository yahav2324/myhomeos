import { Module } from '@nestjs/common';
import { BoxesGateway } from './boxes.gateway';

@Module({
  providers: [BoxesGateway],
  exports: [BoxesGateway],
})
export class WsModule {}
