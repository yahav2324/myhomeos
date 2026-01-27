import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AdminCatalogRepoPrisma } from './admin-catalog.repo.prisma';

export type CatalogConfig = {
  minQueryChars: number;
  upApproveMin: number;
  downRejectMin: number;
};

const CatalogConfigSchema = z.object({
  minQueryChars: z.number().int().min(1).max(10),
  upApproveMin: z.number().int().min(1).max(1000),
  downRejectMin: z.number().int().min(1).max(1000),
});

const PatchCatalogConfigSchema = z.object({
  minQueryChars: z.number().int().min(1).max(10).optional(),
  upApproveMin: z.number().int().min(1).max(1000).optional(),
  downRejectMin: z.number().int().min(1).max(1000).optional(),
});

const DEFAULT_CFG: CatalogConfig = {
  minQueryChars: 2,
  upApproveMin: 5,
  downRejectMin: 10,
};

function normalizeCfg(x: any): CatalogConfig {
  return {
    minQueryChars: Number(x?.minQueryChars ?? DEFAULT_CFG.minQueryChars),
    upApproveMin: Number(x?.upApproveMin ?? DEFAULT_CFG.upApproveMin),
    downRejectMin: Number(x?.downRejectMin ?? DEFAULT_CFG.downRejectMin),
  };
}

@Injectable()
export class AdminCatalogService {
  constructor(private readonly repo: AdminCatalogRepoPrisma) {}

  async getConfig(): Promise<CatalogConfig> {
    const row = await this.repo.getCatalogConfigRow();
    if (!row) {
      await this.repo.upsertCatalogConfig(DEFAULT_CFG);
      return DEFAULT_CFG;
    }
    return normalizeCfg(row.json);
  }

  async patchConfig(body: unknown): Promise<CatalogConfig> {
    const parsed = PatchCatalogConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const current = await this.getConfig();
    const merged: CatalogConfig = {
      ...current,
      ...parsed.data,
    };

    const ok = CatalogConfigSchema.safeParse(merged);
    if (!ok.success) throw new BadRequestException(ok.error.flatten());

    await this.repo.upsertCatalogConfig(merged);
    return merged;
  }
}
