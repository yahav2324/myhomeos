import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelemetryModule } from '../telemetry';
import { BoxModule } from '../box/box.module';

@Module({
  imports: [TelemetryModule, BoxModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
