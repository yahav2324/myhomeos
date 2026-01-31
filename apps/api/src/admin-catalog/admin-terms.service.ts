import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TermStatus } from '@prisma/client';
import { z } from 'zod';
import { AdminTermsRepoPrisma } from './admin-terms.repo.prisma';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminCatalogRepoPrisma } from './admin-catalog.repo.prisma';

const ListSchema = z.object({
  status: z.enum(['LIVE', 'PENDING', 'APPROVED', 'REJECTED']).default('LIVE'),
  lang: z.string().min(2).max(10).default('en'),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

@Injectable()
export class AdminTermsService {
  constructor(
    private readonly repo: AdminTermsRepoPrisma,
    private readonly cfg: AdminCatalogService,
    private readonly audit: AdminCatalogRepoPrisma,
  ) {}

  async list(query: unknown) {
    const parsed = ListSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { status, lang, q, limit, cursor } = parsed.data;
    const res = await this.repo.list({ status: status as TermStatus, lang, q, limit, cursor });

    const items = await Promise.all(
      res.rows.map(async (t) => {
        const counts = await this.repo.voteCounts(t.id);
        const text =
          t.translations.find((x) => x.lang === lang)?.text ??
          t.translations.find((x) => x.lang === 'en')?.text ??
          t.translations[0]?.text ??
          '';

        return {
          id: t.id,
          status: t.status,
          approvedByAdmin: t.approvedByAdmin,
          text,
          upCount: counts.up,
          downCount: counts.down,
          translations: t.translations.map((x) => ({
            lang: x.lang,
            text: x.text,
            source: x.source,
          })),
          updatedAt: t.updatedAt,
        };
      }),
    );

    return { ok: true, data: { items, nextCursor: res.nextCursor } };
  }

  async approve(adminId: string, termId: string) {
    const before = await this.repo.getTerm(termId);
    if (!before) throw new NotFoundException('Term not found');

    const after = await this.repo.approve(termId);
    await this.audit.audit({ adminId, action: 'TERM_APPROVE', targetId: termId, before, after });
    return { ok: true };
  }

  async reject(adminId: string, termId: string) {
    const before = await this.repo.getTerm(termId);
    if (!before) throw new NotFoundException('Term not found');

    const after = await this.repo.reject(termId);
    await this.audit.audit({ adminId, action: 'TERM_REJECT', targetId: termId, before, after });
    return { ok: true };
  }

  async autoRemoveIfTooManyDown(adminId: string, termId: string) {
    const cfg = await this.cfg.getConfig();
    const before = await this.repo.getTerm(termId);
    if (!before) throw new NotFoundException('Term not found');

    const counts = await this.repo.voteCounts(termId);
    if (counts.down < cfg.downRejectMin) {
      return { ok: true, removed: false, downCount: counts.down, threshold: cfg.downRejectMin };
    }

    const after = await this.repo.reject(termId);
    await this.audit.audit({
      adminId,
      action: 'TERM_REJECT_BY_DOWN_THRESHOLD',
      targetId: termId,
      before,
      after,
    });

    return { ok: true, removed: true, downCount: counts.down, threshold: cfg.downRejectMin };
  }
}
