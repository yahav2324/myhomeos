import { Module } from '@nestjs/common';
import { HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';
import { HouseholdsRepoPrisma } from './households.repo.prisma';

@Module({
  controllers: [HouseholdsController],
  providers: [HouseholdsService, HouseholdsRepoPrisma],
  exports: [HouseholdsService],
})
export class HouseholdsModule {}
