import { BadRequestException, Injectable } from '@nestjs/common';
import { TermStatus } from '@prisma/client';
import { z } from 'zod';
import { AdminTermsRepoPrisma } from './admin-terms.repo.prisma';
import { AdminCatalogService } from './admin-catalog.service';

const ListSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
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
  ) {}

  async list(query: unknown) {
    const parsed = ListSchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const { status, lang, q, limit, cursor } = parsed.data;

    const res = await this.repo.listTerms({
      status: status as TermStatus,
      lang,
      q,
      limit,
      cursor,
    });

    // enrich with vote counts + display text
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
          updatedAt: t.updatedAt,
          createdAt: t.createdAt,
          text,
          lang,
          upCount: counts.up,
          downCount: counts.down,
          translations: t.translations.map((x) => ({
            lang: x.lang,
            text: x.text,
            source: x.source,
          })),
        };
      }),
    );

    return { ok: true, data: { items, nextCursor: res.nextCursor } };
  }

  async approve(termId: string) {
    await this.repo.approve(termId);
    return { ok: true };
  }

  async reject(termId: string) {
    await this.repo.reject(termId);
    return { ok: true };
  }

  // “אם יש הרבה DOWN מתחת ל-10 להעיף” -> בפועל זה:
  // אם downCount >= downRejectMin -> remove או reject
  async autoRemoveIfTooManyDown(termId: string) {
    const cfg = await this.cfg.getConfig();
    const counts = await this.repo.voteCounts(termId);

    if (counts.down >= cfg.downRejectMin) {
      await this.repo.remove(termId);
      return { ok: true, removed: true, downCount: counts.down, threshold: cfg.downRejectMin };
    }

    return { ok: true, removed: false, downCount: counts.down, threshold: cfg.downRejectMin };
  }
}
