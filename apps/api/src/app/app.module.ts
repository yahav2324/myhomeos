import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { WsModule } from '../ws/ws.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HouseholdsModule } from '../households/households.module';
import { AuthModule } from '../auth/auth.module';
import { TermsModule } from '../terms';
import { AdminCatalogModule } from '../admin-catalog/admin-catalog.module';
import { ConfigModule } from '@nestjs/config';
import { ShoppingModule } from '../shopping/shopping.module';
import { HealthModule } from '../health/health.module';
import { FilesModule } from '../files/files.modules';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    WsModule,
    BoxesModule,
    TelemetryModule,
    PrismaModule,
    HouseholdsModule,
    AuthModule,
    TermsModule,
    AdminCatalogModule,
    ShoppingModule,
    HealthModule,
    FilesModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
    }),
  ],
})
export class AppModule {}
