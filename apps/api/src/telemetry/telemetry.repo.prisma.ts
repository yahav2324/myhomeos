import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type TelemetryPoint = {
  boxId: string;
  quantity: number;
  percent: number;
  state: 'OK' | 'LOW' | 'EMPTY';
  timestamp: string;
};

@Injectable()
export class TelemetryRepoPrisma {
  constructor(private readonly prisma: PrismaService) {}

  async append(p: TelemetryPoint): Promise<void> {
    await this.prisma.telemetryEvent.create({
      data: {
        boxId: p.boxId,
        quantity: p.quantity,
        percent: p.percent,
        state: p.state,
        timestamp: new Date(p.timestamp),
      },
    });
  }

  async list(boxId: string, sinceIso?: string): Promise<TelemetryPoint[]> {
    const since = sinceIso ? new Date(sinceIso) : undefined;

    const rows = await this.prisma.telemetryEvent.findMany({
      where: {
        boxId,
        ...(since ? { timestamp: { gte: since } } : {}),
      },
      orderBy: { timestamp: 'asc' },
      take: 5000,
    });

    return rows.map((r) => ({
      boxId: r.boxId,
      quantity: r.quantity,
      percent: r.percent,
      state: r.state,
      timestamp: r.timestamp.toISOString(),
    }));
  }
}
