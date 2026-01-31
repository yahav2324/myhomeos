// apps/api/src/shopping/shopping.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShoppingCategory } from '@smart-kitchen/contracts';
import { ShoppingUnit } from '@prisma/client';

type ApiUnit = 'PCS' | 'G' | 'KG' | 'ML' | 'L';

@Injectable()
export class ShoppingService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Lists =====

  async listLists(householdId: string) {
    const rows = await this.prisma.shoppingList.findMany({
      where: { householdId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    return { ok: true, data: rows };
  }

  async createList(householdId: string, body: { name: string }) {
    const name = (body?.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');

    const row = await this.prisma.shoppingList.create({
      data: { householdId, name },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    return { ok: true, data: row };
  }

  async renameList(householdId: string, listId: string, body: { name: string }) {
    const name = (body?.name ?? '').trim();
    if (!name) throw new BadRequestException('name is required');

    await this.assertListOwned(householdId, listId);

    const row = await this.prisma.shoppingList.update({
      where: { id: listId },
      data: { name },
      select: { id: true, name: true, createdAt: true, updatedAt: true },
    });

    return { ok: true, data: row };
  }

  async deleteList(householdId: string, listId: string) {
    await this.assertListOwned(householdId, listId);

    await this.prisma.shoppingList.delete({ where: { id: listId } }); // cascade items
    return { ok: true };
  }

  // ===== Items =====

  async listItems(householdId: string, listId: string) {
    await this.assertListOwned(householdId, listId);

    const rows = await this.prisma.shoppingItem.findMany({
      where: { listId },
      orderBy: [{ checked: 'asc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        termId: true,
        text: true,
        qty: true,
        unit: true,
        checked: true,
        category: true,
        extra: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { ok: true, data: rows };
  }

  async addItem(
    householdId: string,
    listId: string,
    body: {
      text: string;
      termId?: string; // ✅ חדש
      qty?: number;
      category?: ShoppingCategory;
      unit?: ApiUnit;
      extra?: any;
    },
  ) {
    await this.assertListOwned(householdId, listId);

    const text = (body?.text ?? '').trim();
    if (!text) throw new BadRequestException('text is required');

    const termId = body.termId ? String(body.termId) : null;

    const qty = this.safeQty(body.qty);
    const unit = this.toPrismaUnit(body.unit);
    const category = body.category ?? null;
    const extra = body.extra ?? null;

    const normalizedText = normalize(text);
    const dedupeKey = makeDedupeKey(text, termId);

    // ✅ ניסיון ליצור; אם כבר קיים (unique) נחזיר את הקיים
    let row;
    try {
      row = await this.prisma.shoppingItem.create({
        data: {
          listId,
          termId,
          text,
          normalizedText,
          dedupeKey,
          qty,
          unit,
          category,
          extra,
        },
        select: {
          id: true,
          termId: true, // ✅ מומלץ להחזיר ללקוח
          text: true,
          qty: true,
          unit: true,
          checked: true,
          category: true,
          extra: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (e: any) {
      // Prisma unique violation
      if (e?.code === 'P2002') {
        row = await this.prisma.shoppingItem.findFirst({
          where: { listId, dedupeKey },
          select: {
            id: true,
            termId: true,
            text: true,
            qty: true,
            unit: true,
            checked: true,
            category: true,
            extra: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        if (!row) throw e; // נדיר מאוד, אבל נשמור בטוח
      } else {
        throw e;
      }
    }

    // bump list updatedAt
    await this.prisma.shoppingList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    return { ok: true, data: row };
  }

  async updateItem(
    householdId: string,
    listId: string,
    itemId: string,
    body: {
      text?: string;
      qty?: number;
      unit?: ApiUnit;
      category?: ShoppingCategory | null;
      extra?: any | null;
      checked?: boolean;
    },
  ) {
    await this.assertListOwned(householdId, listId);
    await this.assertItemInList(listId, itemId);

    const data: any = {};

    if (body.text !== undefined) {
      const t = String(body.text).trim();
      if (!t) throw new BadRequestException('text cannot be empty');
      data.text = t;
      data.normalizedText = normalize(t);
    }
    if (body.qty !== undefined) data.qty = this.safeQty(body.qty);
    if (body.unit !== undefined) data.unit = this.toPrismaUnit(body.unit);
    if (body.checked !== undefined) data.checked = Boolean(body.checked);

    if (body.category !== undefined) {
      // allow null to clear
      data.category = body.category === null ? null : body.category;
    }

    if (body.extra !== undefined) {
      data.extra = body.extra === null ? null : body.extra;
    }

    const row = await this.prisma.shoppingItem.update({
      where: { id: itemId },
      data,
      select: {
        id: true,
        text: true,
        qty: true,
        unit: true,
        checked: true,
        category: true,
        extra: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // bump list updatedAt
    await this.prisma.shoppingList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    return { ok: true, data: row };
  }

  async deleteItem(householdId: string, listId: string, itemId: string) {
    await this.assertListOwned(householdId, listId);
    await this.assertItemInList(listId, itemId);

    await this.prisma.shoppingItem.delete({ where: { id: itemId } });

    // bump list updatedAt
    await this.prisma.shoppingList.update({
      where: { id: listId },
      data: { updatedAt: new Date() },
      select: { id: true },
    });

    return { ok: true };
  }

  // ===== helpers =====

  private async assertListOwned(householdId: string, listId: string) {
    const exists = await this.prisma.shoppingList.findFirst({
      where: { id: listId, householdId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('ShoppingList not found');
  }

  private async assertItemInList(listId: string, itemId: string) {
    const exists = await this.prisma.shoppingItem.findFirst({
      where: { id: itemId, listId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('ShoppingItem not found in list');
  }

  private safeQty(q?: number) {
    const n = Number(q);
    if (!Number.isFinite(n) || n <= 0) return 1;
    return Math.round(n * 100) / 100;
  }

  private toPrismaUnit(u?: ApiUnit): ShoppingUnit {
    // default PCS
    if (!u) return ShoppingUnit.PCS;

    // validate
    if (u === 'PCS') return ShoppingUnit.PCS;
    if (u === 'G') return ShoppingUnit.G;
    if (u === 'KG') return ShoppingUnit.KG;
    if (u === 'ML') return ShoppingUnit.ML;
    if (u === 'L') return ShoppingUnit.L;

    return ShoppingUnit.PCS;
  }
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function makeDedupeKey(text: string, termId: string | null): string {
  if (termId) {
    return `${termId}`;
  }
  return normalize(text);
}
