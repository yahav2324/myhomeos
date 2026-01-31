import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TermStatus, VoteValue } from '@prisma/client';

@Injectable()
export class AdminTermsRepoPrisma {
  constructor(private readonly prisma: PrismaService) {}

  async list(args: {
    status: TermStatus;
    lang: string;
    q?: string;
    limit: number;
    cursor?: string;
  }) {
    const where: any = { status: args.status, scope: 'GLOBAL' };

    if (args.q?.trim()) {
      where.translations = {
        some: { lang: args.lang, normalized: { contains: args.q.trim().toLowerCase() } },
      };
    }

    const rows = await this.prisma.term.findMany({
      where,
      take: args.limit,
      ...(args.cursor ? { skip: 1, cursor: { id: args.cursor } } : {}),
      include: { translations: true },
      orderBy: { updatedAt: 'desc' },
    });

    const nextCursor = rows.length === args.limit ? rows[rows.length - 1].id : null;
    return { rows, nextCursor };
  }

  async voteCounts(termId: string) {
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

  async getTerm(termId: string) {
    return this.prisma.term.findUnique({ where: { id: termId }, include: { translations: true } });
  }

  async approve(termId: string) {
    return this.prisma.term.update({
      where: { id: termId },
      data: { approvedByAdmin: true, status: 'APPROVED', approvedAt: new Date() },
    });
  }

  async reject(termId: string) {
    return this.prisma.term.update({
      where: { id: termId },
      data: { approvedByAdmin: false, status: 'REJECTED', approvedAt: null },
    });
  }

  async remove(termId: string) {
    return this.prisma.term.delete({ where: { id: termId } });
  }
}
