import { Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { AdminTermsService } from './admin-terms.service';

function assertAdmin(req: any) {
  if (!req?.user?.isAdmin) throw new Error('Forbidden: admin only');
}

@Controller('/admin/terms')
export class AdminTermsController {
  constructor(private readonly svc: AdminTermsService) {}

  @Get()
  async list(@Req() req: any, @Query() query: any) {
    assertAdmin(req);
    return this.svc.list(query);
  }

  @Patch('/:id/approve')
  async approve(@Req() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return this.svc.approve(id);
  }

  @Patch('/:id/reject')
  async reject(@Req() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return this.svc.reject(id);
  }

  // אופציונלי: ניקוי אוטומטי לפי downRejectMin
  @Post('/:id/auto-remove-if-too-many-down')
  async autoRemove(@Req() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return this.svc.autoRemoveIfTooManyDown(id);
  }
}
