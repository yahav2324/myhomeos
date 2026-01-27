import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TermScope, VoteValue } from '@prisma/client';

@Injectable()
export class TermsRepoPrisma {
  constructor(private readonly prisma: PrismaService) {}

  // ---- System config ----
  async getSystemConfig(key: string) {
    return this.prisma.systemConfig.findUnique({ where: { key } });
  }

  async upsertSystemConfig(key: string, json: unknown) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      update: { json: json as any },
      create: { key, json: json as any },
    });
  }

  // ---- Suggest ----
  async suggest(args: { qNorm: string; lang: string; limit: number; userId?: string | null }) {
    // Find matching translations by lang + prefix
    const matches = await this.prisma.termTranslation.findMany({
      where: {
        lang: args.lang,
        normalized: { startsWith: args.qNorm },
        term: {
          // only global approved/pending + private of this user
          OR: [
            { scope: TermScope.GLOBAL, status: { in: ['APPROVED', 'PENDING'] } as any },
            args.userId ? { scope: TermScope.PRIVATE, ownerUserId: args.userId } : undefined,
          ].filter(Boolean) as any,
        },
      },
      take: args.limit * 3, // oversample; we'll sort and cut later
      include: {
        term: {
          select: {
            id: true,
            scope: true,
            ownerUserId: true,
            status: true,
            approvedByAdmin: true,
            translations: {
              select: { lang: true, text: true },
            },
            _count: { select: { votes: true } },
          },
        },
      },
      orderBy: [{ normalized: 'asc' }],
    });

    // load votes aggregate + myVote in one go for the term ids
    const termIds = Array.from(new Set(matches.map((m) => m.termId)));
    if (termIds.length === 0) return [];

    const grouped = await this.prisma.termVote.groupBy({
      by: ['termId', 'vote'],
      where: { termId: { in: termIds } },
      _count: { _all: true },
    });

    const countsByTerm = new Map<string, { up: number; down: number }>();
    for (const g of grouped) {
      const cur = countsByTerm.get(g.termId) ?? { up: 0, down: 0 };
      if (g.vote === VoteValue.UP) cur.up = g._count._all;
      if (g.vote === VoteValue.DOWN) cur.down = g._count._all;
      countsByTerm.set(g.termId, cur);
    }

    const myVotes = args.userId
      ? await this.prisma.termVote.findMany({
          where: { termId: { in: termIds }, userId: args.userId },
          select: { termId: true, vote: true },
        })
      : [];

    const myVoteByTerm = new Map<string, VoteValue>();
    for (const v of myVotes) myVoteByTerm.set(v.termId, v.vote);

    // pick best display text: requested lang, else english, else any
    const out = matches.map((m) => {
      const t = m.term;
      const c = countsByTerm.get(t.id) ?? { up: 0, down: 0 };

      const textLang =
        t.translations.find((x) => x.lang === args.lang)?.text ??
        t.translations.find((x) => x.lang === 'en')?.text ??
        t.translations[0]?.text ??
        m.text;

      const approved = t.approvedByAdmin || t.status === ('APPROVED' as any);

      return {
        termId: t.id,
        text: textLang,
        lang: args.lang,
        status: t.status,
        approved,
        scope: t.scope,
        upCount: c.up,
        downCount: c.down,
        myVote: args.userId ? (myVoteByTerm.get(t.id) ?? null) : null,
      };
    });

    // rank: private first, then approved, then higher score
    out.sort((a, b) => {
      const aPrivate = a.scope === TermScope.PRIVATE ? 1 : 0;
      const bPrivate = b.scope === TermScope.PRIVATE ? 1 : 0;
      if (aPrivate !== bPrivate) return bPrivate - aPrivate;

      const aAppr = a.approved ? 1 : 0;
      const bAppr = b.approved ? 1 : 0;
      if (aAppr !== bAppr) return bAppr - aAppr;

      const aScore = a.upCount - a.downCount;
      const bScore = b.upCount - b.downCount;
      if (aScore !== bScore) return bScore - aScore;

      return a.text.localeCompare(b.text);
    });

    // unique by termId (because we oversampled translations)
    const seen = new Set<string>();
    const uniq: typeof out = [];
    for (const x of out) {
      if (seen.has(x.termId)) continue;
      seen.add(x.termId);
      uniq.push(x);
      if (uniq.length >= args.limit) break;
    }

    return uniq;
  }

  // ---- Create term + translations ----
  async createTerm(args: {
    scope: TermScope;
    ownerUserId?: string | null;
    translations: Array<{ lang: string; text: string; normalized: string; source: string }>;
  }) {
    return this.prisma.term.create({
      data: {
        scope: args.scope,
        ownerUserId: args.ownerUserId ?? null,
        translations: { create: args.translations },
      },
      include: { translations: true },
    });
  }

  async addTranslation(args: {
    termId: string;
    lang: string;
    text: string;
    normalized: string;
    source: string;
  }) {
    return this.prisma.termTranslation.create({
      data: {
        termId: args.termId,
        lang: args.lang,
        text: args.text,
        normalized: args.normalized,
        source: args.source,
      },
    });
  }

  async findTermById(termId: string) {
    return this.prisma.term.findUnique({
      where: { id: termId },
      include: { translations: true },
    });
  }

  // ---- Vote ----
  async upsertVote(args: { termId: string; userId: string; vote: VoteValue }) {
    return this.prisma.termVote.upsert({
      where: { termId_userId: { termId: args.termId, userId: args.userId } },
      update: { vote: args.vote },
      create: { termId: args.termId, userId: args.userId, vote: args.vote },
    });
  }

  async getVoteCounts(termId: string) {
    const grouped = await this.prisma.termVote.groupBy({
      by: ['vote'],
      where: { termId },
      _count: { _all: true },
    });

    let up = 0;
    let down = 0;
    for (const g of grouped) {
      if (g.vote === VoteValue.UP) up = g._count._all;
      if (g.vote === VoteValue.DOWN) down = g._count._all;
    }
    return { up, down };
  }

  async updateTermStatus(termId: string, status: any, approvedAt?: Date | null) {
    return this.prisma.term.update({
      where: { id: termId },
      data: { status, approvedAt: approvedAt ?? undefined },
    });
  }
}
