import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminCatalogRepoPrisma {
  constructor(private readonly prisma: PrismaService) {}

  async getConfigRow() {
    return this.prisma.systemConfig.findUnique({ where: { key: 'catalog' } });
  }

  async upsertConfig(json: unknown) {
    return this.prisma.systemConfig.upsert({
      where: { key: 'catalog' },
      update: { json: json as any },
      create: { key: 'catalog', json: json as any },
    });
  }

  async audit(args: {
    adminId: string;
    action: string;
    targetId?: string;
    before?: any;
    after?: any;
  }) {
    return this.prisma.adminAuditLog.create({
      data: {
        adminId: args.adminId,
        action: args.action,
        targetId: args.targetId ?? null,
        before: args.before ?? undefined,
        after: args.after ?? undefined,
      },
    });
  }
}
