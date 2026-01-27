import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CreateHouseholdSchema } from '@smart-kitchen/contracts';
import { parseOrThrow } from '../common/zod';
import { HouseholdsService } from './households.service';
import { CurrentUserId } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('households')
export class HouseholdsController {
  constructor(private readonly service: HouseholdsService) {}

  @Get('me')
  async me(@CurrentUserId() userId: string) {
    return this.service.myHouseholds(userId);
  }

  @Post()
  async create(@CurrentUserId() userId: string, @Body() body: unknown) {
    const dto = parseOrThrow(CreateHouseholdSchema, body);
    return this.service.createAsOwner(userId, dto.name);
  }
}
