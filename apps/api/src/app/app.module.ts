import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { WsModule } from '../ws/ws.module';

@Module({
  imports: [WsModule, BoxesModule, TelemetryModule],
})
export class AppModule {}
