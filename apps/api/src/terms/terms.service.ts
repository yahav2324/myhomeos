import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TermScope, VoteValue } from '@prisma/client';
import { z } from 'zod';
import { TermsRepoPrisma } from './terms.repo.prisma';

// ---- Zod schemas ----
const CreateTermBodySchema = z.object({
  text: z.string().min(1).max(80),
  lang: z.string().min(2).max(10).optional(), // "he" | "en" ...
  scope: z.enum(['GLOBAL', 'PRIVATE']).optional(),
});

const VoteBodySchema = z.object({
  vote: z.enum(['UP', 'DOWN']),
});

// ---- config types ----
type CatalogConfig = {
  minQueryChars: number;
  upApproveMin: number;
  downRejectMin: number;
};

const DEFAULT_CATALOG_CONFIG: CatalogConfig = {
  minQueryChars: 2,
  upApproveMin: 5,
  downRejectMin: 10,
};

// ---- helpers ----
function normalizeText(s: string) {
  return s.trim().toLowerCase();
}

// זיהוי שפה “פשוט אבל עובד” (עברית מול אנגלית/אחר)
function detectLang(text: string): string {
  const t = text.trim();
  // Hebrew block
  if (/[֐-׿]/.test(t)) return 'he';
  // Latin
  if (/[a-zA-Z]/.test(t)) return 'en';
  return 'und';
}

// כאן תכניס בעתיד Google Translate. כרגע stub.
async function translateToEnglish(text: string, fromLang: string): Promise<string | null> {
  // TODO: integrate Google Translate / other provider
  // IMPORTANT: do NOT block user if translation fails
  void fromLang;
  void text;
  return null;
}

@Injectable()
export class TermsService {
  constructor(private readonly repo: TermsRepoPrisma) {}

  // Always read config from DB (SystemConfig key="catalog")
  async getCatalogConfig(): Promise<CatalogConfig> {
    const row = await this.repo.getSystemConfig('catalog');
    if (!row?.json || typeof row.json !== 'object') {
      // create once (still not a prisma default; it is runtime init)
      await this.repo.upsertSystemConfig('catalog', { catalog: DEFAULT_CATALOG_CONFIG });
      return DEFAULT_CATALOG_CONFIG;
    }

    const obj = row.json as any;
    const cfg = obj.catalog ?? obj;

    return {
      minQueryChars: Number(cfg.minQueryChars ?? DEFAULT_CATALOG_CONFIG.minQueryChars),
      upApproveMin: Number(cfg.upApproveMin ?? DEFAULT_CATALOG_CONFIG.upApproveMin),
      downRejectMin: Number(cfg.downRejectMin ?? DEFAULT_CATALOG_CONFIG.downRejectMin),
    };
  }

  async suggest(args: { q: string; lang: string; limit: number; userId?: string | null }) {
    const cfg = await this.getCatalogConfig();

    const qTrim = args.q.trim();
    if (qTrim.length < cfg.minQueryChars) return [];

    const qNorm = normalizeText(qTrim);
    const lang = (args.lang || 'en').trim();
    const limit = Math.min(Math.max(args.limit || 10, 1), 30);

    return this.repo.suggest({ qNorm, lang, limit, userId: args.userId });
  }

  async create(body: unknown, userId: string) {
    const parsed = CreateTermBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const text = parsed.data.text.trim();
    const lang = (parsed.data.lang?.trim() || detectLang(text) || 'und').toLowerCase();
    const scope = (parsed.data.scope ?? 'GLOBAL') as 'GLOBAL' | 'PRIVATE';

    const term = await this.repo.createTerm({
      scope: scope === 'PRIVATE' ? TermScope.PRIVATE : TermScope.GLOBAL,
      ownerUserId: scope === 'PRIVATE' ? userId : null,
      translations: [
        {
          lang,
          text,
          normalized: normalizeText(text),
          source: 'USER',
        },
      ],
    });

    // Auto translate to English if missing
    const hasEn = term.translations.some((t) => t.lang === 'en');
    if (!hasEn && lang !== 'en') {
      try {
        const en = await translateToEnglish(text, lang);
        if (en && en.trim().length > 0) {
          await this.repo.addTranslation({
            termId: term.id,
            lang: 'en',
            text: en.trim(),
            normalized: normalizeText(en),
            source: 'AUTO',
          });
        }
      } catch {
        // swallow translation errors – internal only
      }
    }

    const fresh = await this.repo.findTermById(term.id);
    return { ok: true, data: fresh };
  }

  async vote(termId: string, body: unknown, userId: string) {
    const parsed = VoteBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const term = await this.repo.findTermById(termId);
    if (!term) throw new NotFoundException('Term not found');

    // vote
    await this.repo.upsertVote({
      termId,
      userId,
      vote: parsed.data.vote === 'UP' ? VoteValue.UP : VoteValue.DOWN,
    });

    // counts + config -> status update (unless admin-approved)
    const cfg = await this.getCatalogConfig();
    const counts = await this.repo.getVoteCounts(termId);

    let newStatus: any = term.status;
    let approvedAt: Date | null = term.approvedAt ?? null;

    if (term.approvedByAdmin) {
      newStatus = 'APPROVED';
      if (!approvedAt) approvedAt = new Date();
    } else if (counts.up >= cfg.upApproveMin) {
      newStatus = 'APPROVED';
      if (!approvedAt) approvedAt = new Date();
    } else if (counts.down >= cfg.downRejectMin) {
      newStatus = 'REJECTED';
      approvedAt = null;
    } else {
      newStatus = 'PENDING';
      approvedAt = null;
    }

    const updated = await this.repo.updateTermStatus(termId, newStatus, approvedAt);

    return {
      ok: true,
      data: {
        termId,
        status: updated.status,
        approvedAt: updated.approvedAt,
        upCount: counts.up,
        downCount: counts.down,
        myVote: parsed.data.vote,
        thresholds: cfg,
      },
    };
  }
}
