import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { WsModule } from '../ws/ws.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { AuthModule } from '../auth/auth.module';
import { TermsModule } from '../terms';
import { AdminCatalogModule } from '../admin-catalog/admin-catalog.module';

@Module({
  imports: [
    WsModule,
    BoxesModule,
    TelemetryModule,
    PrismaModule,
    HouseholdsModule,
    AuthModule,
    TermsModule,
    AdminCatalogModule,
  ],
})
export class AppModule {}
