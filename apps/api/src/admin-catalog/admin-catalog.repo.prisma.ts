import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminCatalogRepoPrisma {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalogConfigRow() {
    return this.prisma.systemConfig.findUnique({ where: { key: 'catalog' } });
  }

  async upsertCatalogConfig(json: unknown) {
    return this.prisma.systemConfig.upsert({
      where: { key: 'catalog' },
      update: { json: json as any },
      create: { key: 'catalog', json: json as any },
    });
  }
}
