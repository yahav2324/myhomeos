import { Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminTermsService } from './admin-terms.service';
import { AdminGuard } from '../auth/guard/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('/admin/terms')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminTermsController {
  constructor(private readonly svc: AdminTermsService) {}

  @Get()
  async list(@Query() query: any) {
    return this.svc.list(query);
  }

  @Patch('/:id/approve')
  async approve(@Req() req: any, @Param('id') id: string) {
    return this.svc.approve(req.user.id, id);
  }

  @Patch('/:id/reject')
  async reject(@Req() req: any, @Param('id') id: string) {
    return this.svc.reject(req.user.id, id);
  }

  @Post('/:id/auto-remove-if-too-many-down')
  async autoRemove(@Req() req: any, @Param('id') id: string) {
    return this.svc.autoRemoveIfTooManyDown(req.user.id, id);
  }
}
