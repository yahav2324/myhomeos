import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AdminCatalogService } from './admin-catalog.service';
import { CurrentHouseholdId } from '../auth/current-user.decorator';
import { AdminGuard } from '../auth/guard/admin.guard';

@Controller('/admin/catalog')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminCatalogController {
  constructor(private readonly svc: AdminCatalogService) {}

  @Get('/config')
  async get() {
    return { ok: true, data: await this.svc.getConfig() };
  }

  @Patch('/config')
  async patch(@CurrentHouseholdId() userId: string, @Body() body: unknown) {
    return { ok: true, data: await this.svc.patchConfig(userId, body) };
  }
}
