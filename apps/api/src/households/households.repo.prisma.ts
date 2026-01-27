import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseholdRole, MemberStatus } from '@prisma/client';

@Injectable()
export class HouseholdsRepoPrisma {
  constructor(private readonly prisma: PrismaService) {}

  async getMyHouseholds(userId: string) {
    return this.prisma.householdMember.findMany({
      where: { userId, status: MemberStatus.ACTIVE },
      include: { household: true },
    });
  }

  async createHouseholdAsOwner(userId: string, name: string) {
    return this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({ data: { name } });

      await tx.householdMember.create({
        data: {
          role: 'OWNER',
          status: 'ACTIVE',
          user: { connect: { id: userId } },
          household: { connect: { id: household.id } },
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { activeHouseholdId: household.id },
      });

      return household;
    });
  }
}
