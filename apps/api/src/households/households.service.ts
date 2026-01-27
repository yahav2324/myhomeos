import { Injectable } from '@nestjs/common';
import { HouseholdsRepoPrisma } from './households.repo.prisma';

@Injectable()
export class HouseholdsService {
  constructor(private readonly householdsRepo: HouseholdsRepoPrisma) {}

  async myHouseholds(userId: string) {
    const rows = await this.householdsRepo.getMyHouseholds(userId);
    return rows.map((row) => row.household);
  }

  async createAsOwner(userId: string, name: string) {
    return this.householdsRepo.createHouseholdAsOwner(userId, name);
  }
}
