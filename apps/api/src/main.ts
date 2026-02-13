import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import helmet from 'helmet';
import { join } from 'path';
import * as express from 'express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'fs';

const globalPrefix = 'api';

async function bootstrap() {
  mkdirSync('uploads/images', { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(
    helmet({
      contentSecurityPolicy: false, // ב-API אין צורך CSP,
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // הוסף את זה
    }),
  );
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  // ✅ CORS קשיח — מותר רק ל-admin-web + mobile origin אם צריך

  const isProd = process.env.NODE_ENV === 'production';

  const adminOrigin = process.env.ADMIN_WEB_ORIGIN; // למשל: http://localhost:5200
  const mobileOrigin = process.env.MOBILE_WEB_ORIGIN; // למשל: http://localhost:19006 (expo web) או http://localhost:8081

  const devDefaults = [
    'http://localhost:5200',
    'http://127.0.0.1:5200',
    'http://localhost:19006',
    'http://127.0.0.1:19006',
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'http://localhost:19000',
    'http://127.0.0.1:19000',
    'https://api.myhomeos.app', // הוסף את זה במפורש
    ...(adminOrigin ? [adminOrigin] : []),
    // ... שאר הרשימה
  ];

  const allowedOrigins = [
    ...(adminOrigin ? [adminOrigin] : []),
    ...(mobileOrigin ? [mobileOrigin] : []),
    ...(!isProd ? devDefaults : []),
  ];

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/postman/server-to-server
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix(globalPrefix);
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
