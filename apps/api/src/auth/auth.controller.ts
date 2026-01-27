import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OtpRequestSchema, OtpVerifySchema } from '@smart-kitchen/contracts';
import { parseOrThrow } from '../common/zod';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.guard';
import { CurrentUserId } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  async request(@Body() body: unknown) {
    const dto = parseOrThrow(OtpRequestSchema, body);
    return this.auth.requestOtp(dto.phoneE164, 'SMS');
  }

  @Post('otp/verify')
  async verify(@Body() body: unknown) {
    const dto = parseOrThrow(OtpVerifySchema, body);
    return this.auth.verifyOtp(dto);
  }

  @Post('refresh')
  async refresh(@Body() body: any) {
    // body: { refreshToken }
    return this.auth.refresh(String(body?.refreshToken ?? ''));
  }

  @Post('logout')
  async logout(@Body() body: any) {
    return this.auth.logout(String(body?.refreshToken ?? ''));
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@CurrentUserId() userId: string) {
    return this.auth.logoutAll(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUserId() userId: string) {
    return { userId };
  }
}
