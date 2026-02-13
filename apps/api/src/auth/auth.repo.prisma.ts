import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpChannel, OtpPurpose, OtpStatus } from '@prisma/client';

@Injectable()
export class AuthRepoPrisma {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPendingChallenge(args: {
    phoneE164: string;
    purpose: OtpPurpose;
    channel: OtpChannel;
    codeHash: string;
    expiresAt: Date;
    minResendSec: number;
  }) {
    const now = new Date();

    // if there is an existing PENDING, update it (resend)
    const existing = await this.prisma.otpChallenge.findFirst({
      where: { phoneE164: args.phoneE164, status: OtpStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const diffSec = Math.floor((now.getTime() - existing.updatedAt.getTime()) / 1000);
      if (diffSec < args.minResendSec) {
        return {
          kind: 'TOO_SOON' as const,
          challengeId: existing.id,
          waitSec: args.minResendSec - diffSec,
        };
      }

      const updated = await this.prisma.otpChallenge.update({
        where: { id: existing.id },
        data: {
          codeHash: args.codeHash,
          expiresAt: args.expiresAt,
          attempts: 0,
          sentCount: { increment: 1 },
          status: OtpStatus.PENDING,
        },
      });

      return { kind: 'UPDATED' as const, row: updated };
    }

    const created = await this.prisma.otpChallenge.create({
      data: {
        phoneE164: args.phoneE164,
        purpose: args.purpose,
        channel: args.channel,
        codeHash: args.codeHash,
        expiresAt: args.expiresAt,
        status: OtpStatus.PENDING,
      },
    });

    return { kind: 'CREATED' as const, row: created };
  }

  async getChallengeById(id: string) {
    return this.prisma.otpChallenge.findUnique({ where: { id } });
  }

  async bumpAttempt(id: string) {
    return this.prisma.otpChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async markChallengeStatus(id: string, status: OtpStatus) {
    return this.prisma.otpChallenge.update({
      where: { id },
      data: { status },
    });
  }

  async findOrCreateUserByPhone(phoneE164: string) {
    if (!phoneE164) throw new Error('phoneE164 is required');

    return this.prisma.user.upsert({
      where: { phoneE164 },
      update: { lastLoginAt: new Date() },
      create: { phoneE164, lastLoginAt: new Date() },
    });
  }

  async upsertGoogleUser(args: {
    googleSub: string;
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  }) {
    return this.prisma.user.upsert({
      where: { googleSub: args.googleSub },
      create: {
        googleSub: args.googleSub,
        email: args.email ?? undefined,
        displayName: args.displayName ?? undefined,
        avatarUrl: args.avatarUrl ?? undefined,
        lastLoginAt: new Date(),
      },
      update: {
        // אם אתה רוצה “בטוח” שלא ידרוס:
        ...(args.email ? { email: args.email } : {}),
        ...(args.displayName ? { displayName: args.displayName } : {}),
        ...(args.avatarUrl ? { avatarUrl: args.avatarUrl } : {}),
        lastLoginAt: new Date(),
      },
    });
  }

  async countActiveMemberships(userId: string) {
    return this.prisma.householdMember.count({
      where: { userId, status: 'ACTIVE' },
    });
  }

  async createSession(args: {
    userId: string;
    refreshTokenHash: string;
    deviceName?: string;
    expiresAt: Date;
  }) {
    return this.prisma.authSession.create({
      data: {
        userId: args.userId,
        refreshTokenHash: args.refreshTokenHash,
        deviceName: args.deviceName ?? null,
        expiresAt: args.expiresAt,
        lastUsedAt: new Date(),
      },
    });
  }

  async findActiveSessionByHash(refreshTokenHash: string) {
    return this.prisma.authSession.findFirst({
      where: { refreshTokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async touchSession(id: string) {
    return this.prisma.authSession.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async revokeSession(id: string) {
    return this.prisma.authSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string) {
    return this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
