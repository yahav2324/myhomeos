import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { BoxesService } from './boxes.service';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ActiveHouseholdGuard } from '../auth/active-household.guard';
import { ActiveHouseholdId } from '../auth/active-household.decorator';

const UuidSchema = z.string().uuid();

@UseGuards(JwtAuthGuard, ActiveHouseholdGuard)
@Controller('boxes')
export class BoxesController {
  constructor(private readonly service: BoxesService) {}

  @Post()
  async create(@ActiveHouseholdId() householdId: string, @Body() body: unknown) {
    return this.service.create(householdId, body);
  }

  @Get()
  async list(@ActiveHouseholdId() householdId: string) {
    return { ok: true, data: await this.service.findAllForHousehold(householdId) };
  }

  @Get(':id')
  async get(@ActiveHouseholdId() householdId: string, @Param('id') id: string) {
    return { ok: true, data: await this.service.getForHousehold(householdId, id) };
  }

  @Post(':id/identify')
  async identify(@ActiveHouseholdId() householdId: string, @Param('id') id: string) {
    await this.service.identifyBox(householdId, id);
    return { ok: true, data: { id, action: 'IDENTIFY' } };
  }

  @Patch(':id/set-full')
  setFull(
    @ActiveHouseholdId() householdId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const ok = UuidSchema.safeParse(id);
    if (!ok.success) {
      throw new BadRequestException('Invalid id (expected UUID). Use /by-code/:code/* for code.');
    }
    return this.service.setFullForHousehold(householdId, id, body);
  }

  @Post(':id/recalibrate-full')
  async recalibrateFull(
    @ActiveHouseholdId() householdId: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.service.recalibrateFullForHousehold(householdId, id, body);
  }

  @Delete(':id')
  async delete(@ActiveHouseholdId() householdId: string, @Param('id') id: string) {
    return this.service.deleteBoxForHousehold(householdId, id);
  }

  @Patch('by-code/:code/set-full')
  setFullByCode(
    @ActiveHouseholdId() householdId: string,
    @Param('code') code: string,
    @Body() body: unknown,
  ) {
    return this.service.setFullByCodeForHousehold(householdId, code, body);
  }
}
