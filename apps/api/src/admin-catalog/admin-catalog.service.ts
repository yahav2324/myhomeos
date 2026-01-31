import { BadRequestException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AdminCatalogRepoPrisma } from './admin-catalog.repo.prisma';

export type CatalogConfig = {
  minQueryChars: number;
  upApproveMin: number;
  downRejectMin: number;
};

const DEFAULT_CFG: CatalogConfig = { minQueryChars: 2, upApproveMin: 5, downRejectMin: 10 };

const PatchSchema = z.object({
  minQueryChars: z.number().int().min(1).max(10).optional(),
  upApproveMin: z.number().int().min(1).max(1000).optional(),
  downRejectMin: z.number().int().min(1).max(1000).optional(),
});

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
    const row = await this.repo.getConfigRow();
    if (!row) {
      await this.repo.upsertConfig(DEFAULT_CFG);
      return DEFAULT_CFG;
    }
    return normalizeCfg(row.json);
  }

  async patchConfig(adminId: string, body: unknown): Promise<CatalogConfig> {
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const before = await this.getConfig();
    const after: CatalogConfig = { ...before, ...parsed.data };

    await this.repo.upsertConfig(after);
    await this.repo.audit({ adminId, action: 'CONFIG_PATCH', before, after });

    return after;
  }
}
