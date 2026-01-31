import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepoPrisma } from './auth.repo.prisma';
import { JwtStrategy } from './jwt.strategy';
import { GoogleAuthService } from './google.auth.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: Number(process.env.JWT_ACCESS_TTL_SEC ?? '1800') },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepoPrisma, JwtStrategy, GoogleAuthService],
  exports: [AuthService],
})
export class AuthModule {}
