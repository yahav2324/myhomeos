import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpChannel, OtpPurpose, OtpStatus } from '@prisma/client';
import { AuthRepoPrisma } from './auth.repo.prisma';
import { generateOtp6, makeOtpHash, makeRefreshToken, makeRefreshTokenHash } from './auth.crypto';
import { createOtpSender } from './otp-sender/otp-sender.factory';
import { OtpSender } from './otp-sender/otp-sender';
import { GoogleAuthService } from './google.auth.service';

@Injectable()
export class AuthService {
  private readonly otpSender: OtpSender;

  constructor(
    private readonly repo: AuthRepoPrisma,
    private readonly jwt: JwtService,
    private readonly google: GoogleAuthService,
  ) {
    this.otpSender = createOtpSender();
  }

  private otpTtlSec() {
    return Number(process.env.OTP_TTL_SEC ?? '300');
  }
  private otpMaxAttempts() {
    return Number(process.env.OTP_MAX_ATTEMPTS ?? '5');
  }
  private otpMinResendSec() {
    return Number(process.env.OTP_MIN_RESEND_SEC ?? '45');
  }
  private otpPepper() {
    return String(process.env.OTP_PEPPER ?? 'pepper');
  }
  private refreshPepper() {
    return String(process.env.REFRESH_PEPPER ?? 'pepper');
  }

  private accessTtlSec() {
    return Number(process.env.JWT_ACCESS_TTL_SEC ?? '1800');
  }
  private refreshTtlSec() {
    return Number(process.env.JWT_REFRESH_TTL_SEC ?? '2592000');
  }

  async requestOtp(phoneE164: string, channel: 'SMS') {
    const code = generateOtp6();
    const codeHash = makeOtpHash(code, phoneE164, this.otpPepper());
    const expiresAt = new Date(Date.now() + this.otpTtlSec() * 1000);

    const res = await this.repo.upsertPendingChallenge({
      phoneE164,
      purpose: OtpPurpose.LOGIN,
      channel: channel === 'SMS' ? OtpChannel.SMS : OtpChannel.SMS,
      codeHash,
      expiresAt,
      minResendSec: this.otpMinResendSec(),
    });

    if (res.kind === 'TOO_SOON') {
      return { challengeId: res.challengeId, expiresInSec: this.otpTtlSec(), waitSec: res.waitSec };
    }

    const challengeId = res.row.id;
    await this.otpSender.sendOtp(phoneE164, code);

    return { challengeId, expiresInSec: this.otpTtlSec() };
  }

  async verifyOtp(args: { challengeId: string; code: string; deviceName?: string }) {
    const ch = await this.repo.getChallengeById(args.challengeId);
    if (!ch) throw new UnauthorizedException('Invalid challenge');
    if (ch.status !== OtpStatus.PENDING) throw new UnauthorizedException('Challenge not pending');
    if (new Date() > ch.expiresAt) {
      await this.repo.markChallengeStatus(ch.id, OtpStatus.EXPIRED);
      throw new UnauthorizedException('OTP expired');
    }
    if (ch.attempts >= this.otpMaxAttempts()) {
      await this.repo.markChallengeStatus(ch.id, OtpStatus.LOCKED);
      throw new UnauthorizedException('Too many attempts');
    }

    const expectedHash = makeOtpHash(args.code, ch.phoneE164, this.otpPepper());
    if (expectedHash !== ch.codeHash) {
      const bumped = await this.repo.bumpAttempt(ch.id);
      if (bumped.attempts >= this.otpMaxAttempts()) {
        await this.repo.markChallengeStatus(ch.id, OtpStatus.LOCKED);
      }
      throw new UnauthorizedException('Wrong code');
    }

    await this.repo.markChallengeStatus(ch.id, OtpStatus.VERIFIED);

    const user = await this.repo.findOrCreateUserByPhone(ch.phoneE164);

    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: this.accessTtlSec() },
    );

    const refreshToken = makeRefreshToken();
    const refreshTokenHash = makeRefreshTokenHash(refreshToken, this.refreshPepper());
    const expiresAt = new Date(Date.now() + this.refreshTtlSec() * 1000);

    await this.repo.createSession({
      userId: user.id,
      refreshTokenHash,
      deviceName: args.deviceName,
      expiresAt,
    });

    const needsOnboarding = !user.activeHouseholdId;

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, phoneE164: user.phoneE164, activeHouseholdId: user.activeHouseholdId },
      needsOnboarding,
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) throw new BadRequestException('Missing refresh token');
    const hash = makeRefreshTokenHash(refreshToken, this.refreshPepper());
    const session = await this.repo.findActiveSessionByHash(hash);
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    await this.repo.touchSession(session.id);

    const accessToken = await this.jwt.signAsync(
      { sub: session.userId },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: this.accessTtlSec() },
    );

    // rotate refresh token (recommended)
    await this.repo.revokeSession(session.id);

    const newRefresh = makeRefreshToken();
    const newHash = makeRefreshTokenHash(newRefresh, this.refreshPepper());
    const expiresAt = new Date(Date.now() + this.refreshTtlSec() * 1000);

    await this.repo.createSession({ userId: session.userId, refreshTokenHash: newHash, expiresAt });

    return { accessToken, refreshToken: newRefresh };
  }

  async logout(refreshToken: string) {
    const hash = makeRefreshTokenHash(refreshToken, this.refreshPepper());
    const session = await this.repo.findActiveSessionByHash(hash);
    if (!session) return { ok: true };
    await this.repo.revokeSession(session.id);
    return { ok: true };
  }

  async logoutAll(userId: string) {
    await this.repo.revokeAllSessions(userId);
    return { ok: true };
  }

  async googleLogin(idToken: string, deviceName?: string) {
    const gp = await this.google.verify(idToken);

    const user = await this.repo.upsertGoogleUser({
      googleSub: gp.sub,
      email: gp.email,
      displayName: gp.name,
      avatarUrl: gp.picture,
    });

    // אם אתה רוצה לשמור את אותו “סגנון” כמו OTP:
    // needsOnboarding = !activeHouseholdId
    // (זה תלוי איך אתה מנהל activeHouseholdId. כרגע אצלך ב-OTP זה זה.)
    const needsOnboarding = !user.activeHouseholdId;

    const accessToken = await this.jwt.signAsync(
      { sub: user.id },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: this.accessTtlSec() },
    );

    // ✅ אותו מנגנון refresh כמו OTP כדי ש-refresh/logout יעבדו
    const refreshToken = makeRefreshToken();
    const refreshTokenHash = makeRefreshTokenHash(refreshToken, this.refreshPepper());
    const expiresAt = new Date(Date.now() + this.refreshTtlSec() * 1000);

    await this.repo.createSession({
      userId: user.id,
      refreshTokenHash,
      deviceName,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        phoneE164: user.phoneE164,
        activeHouseholdId: user.activeHouseholdId,
      },
      needsOnboarding,
    };
  }
}
