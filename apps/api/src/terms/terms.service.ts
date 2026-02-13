import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ShoppingCategory, ShoppingUnit, TermScope, TermStatus, VoteValue } from '@prisma/client';
import { z } from 'zod';
import { TermsRepoPrisma } from './terms.repo.prisma';
import { UpsertMyDefaultsSchema } from '@smart-kitchen/contracts';

// ---- Zod schemas ----
const CreateTermBodySchema = z.object({
  text: z.string().min(1).max(80),
  lang: z.string().min(2).max(10).optional(), // "he" | "en" ...
  scope: z.enum(['GLOBAL', 'PRIVATE']).optional(),
  category: z.nativeEnum(ShoppingCategory).optional(),
  unit: z.nativeEnum(ShoppingUnit).optional(),
  qty: z.number().positive().optional(),
  extras: z.record(z.string(), z.string()).optional(),
  imageUrl: z.string().url().optional(),

  // new names from client (optional)
  defaultCategory: z.nativeEnum(ShoppingCategory).optional(),
  defaultUnit: z.nativeEnum(ShoppingUnit).optional(),
  defaultQty: z.number().positive().optional(),
  defaultExtras: z.record(z.string(), z.string()).optional(),
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

function detectLang(text: string): string {
  const t = text.trim();
  if (/[֐-׿]/.test(t)) return 'he';
  if (/[a-zA-Z]/.test(t)) return 'en';
  return 'und';
}

// בעתיד: translate provider
async function translateToEnglish(text: string, fromLang: string): Promise<string | null> {
  void text;
  void fromLang;
  return null;
}

@Injectable()
export class TermsService {
  constructor(private readonly repo: TermsRepoPrisma) {}

  async getCatalogConfig(): Promise<CatalogConfig> {
    const row = await this.repo.getSystemConfig('catalog');

    if (!row?.json || typeof row.json !== 'object') {
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

  async setTermImage(termId: string, imageUrl: string | null, userId: string) {
    const term = await this.repo.findTermById(termId);
    if (!term) throw new NotFoundException('Term not found');

    // רק הבעלים של מונח פרטי או אדמין יכולים לשנות את התמונה
    if (term.scope === TermScope.PRIVATE && term.ownerUserId !== userId) {
      throw new BadRequestException('Not authorized to change image of this term');
    }

    const updated = await this.repo.setTermImage(termId, imageUrl);
    return { ok: true, data: updated };
  }

  async suggest(args: { q: string; lang: string; limit: number; userId?: string | null }) {
    const cfg = await this.getCatalogConfig();

    const qTrim = args.q.trim();
    if (qTrim.length < cfg.minQueryChars) return [];

    const qNorm = normalizeText(qTrim);
    const lang = (args.lang || 'en').trim().toLowerCase();
    const limit = Math.min(Math.max(args.limit || 10, 1), 30);

    return this.repo.suggest({ qNorm, lang, limit, userId: args.userId });
  }

  async create(body: unknown, userId: string) {
    const parsed = CreateTermBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const text = parsed.data.text.trim();
    const lang = (parsed.data.lang?.trim() || detectLang(text) || 'und').toLowerCase();
    const scope = (parsed.data.scope ?? 'GLOBAL') as 'GLOBAL' | 'PRIVATE';
    const cat = parsed.data.defaultCategory ?? parsed.data.category ?? null;
    const unit = parsed.data.defaultUnit ?? parsed.data.unit ?? null;
    const qty = parsed.data.defaultQty ?? parsed.data.qty ?? null;
    const extras = parsed.data.defaultExtras ?? parsed.data.extras ?? null;
    const imageUrl = parsed.data.imageUrl ?? null;
    // ✅ PRIVATE נשאר פרטי ליוצר
    const term = await this.repo.createTerm({
      scope: scope === 'PRIVATE' ? TermScope.PRIVATE : TermScope.GLOBAL,
      ownerUserId: scope === 'PRIVATE' ? userId : null,
      status: scope === 'PRIVATE' ? TermStatus.PENDING : TermStatus.LIVE,
      translations: [{ lang, text, normalized: normalizeText(text), source: 'USER' }],
      imageUrl,
      defaultCategory: cat,
      defaultUnit: unit,
      defaultQty: qty,
      defaultExtras: extras,
    });

    // Auto translate to English (optional)
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
        // ignore
      }
    }

    const fresh = await this.repo.findTermById(term.id);

    return {
      ok: true,
      data: fresh,
    };
  }

  async upsertMyDefaults(termId: string, body: unknown, userId: string) {
    const parsed = UpsertMyDefaultsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const term = await this.repo.findTermById(termId);
    if (!term) throw new NotFoundException('Term not found');

    const d = parsed.data;

    const row = await this.repo.upsertMyDefaults({
      termId,
      userId,
      category: d.category ?? null,
      unit: d.unit ?? null,
      qty: d.qty ?? null,
      extras: d.extras ?? null,
    });

    return { ok: true, data: row };
  }

  async vote(termId: string, body: unknown, userId: string) {
    const parsed = VoteBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());

    const term = await this.repo.findTermById(termId);
    if (!term) throw new NotFoundException('Term not found');

    // vote upsert
    await this.repo.upsertVote({
      termId,
      userId,
      vote: parsed.data.vote === 'UP' ? VoteValue.UP : VoteValue.DOWN,
    });

    const cfg = await this.getCatalogConfig();
    const counts = await this.repo.getVoteCounts(termId);

    let newStatus: TermStatus = term.status;
    let approvedAt: Date | null = term.approvedAt ?? null;

    if (term.approvedByAdmin) {
      newStatus = TermStatus.APPROVED;
      if (!approvedAt) approvedAt = new Date();
    } else if (counts.up >= cfg.upApproveMin) {
      newStatus = TermStatus.APPROVED;
      if (!approvedAt) approvedAt = new Date();
    } else if (counts.down >= cfg.downRejectMin) {
      newStatus = TermStatus.REJECTED;
      approvedAt = null;
    } else {
      // ✅ נשאר LIVE כדי שכולם ימשיכו לראות ולדרג
      // (PENDING שמור למקרה של “ריסאבמיט” בעתיד / או PRIVATE)
      newStatus = term.scope === TermScope.PRIVATE ? TermStatus.PENDING : TermStatus.LIVE;
      approvedAt = null;
    }

    const updated = await this.repo.updateTermStatus(termId, newStatus, approvedAt);

    return {
      ok: true,
      data: {
        id: termId,
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
