import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { AdminCatalogService } from './admin-catalog.service';

// TODO: החלף לשם הגארד שלך
// import { JwtAuthGuard } from '../auth/guards/jwt.guard';

function assertAdmin(req: any) {
  // אצלך תבדוק user.isAdmin או role
  if (!req?.user?.isAdmin) {
    // אפשר גם throw Unauthorized/Forbidden
    throw new Error('Forbidden: admin only');
  }
}

@Controller('/admin/catalog')
export class AdminCatalogController {
  constructor(private readonly svc: AdminCatalogService) {}

  // @UseGuards(JwtAuthGuard)
  @Get('/config')
  async getConfig(@Req() req: any) {
    assertAdmin(req);
    return { ok: true, data: await this.svc.getConfig() };
  }

  // @UseGuards(JwtAuthGuard)
  @Patch('/config')
  async patchConfig(@Req() req: any, @Body() body: unknown) {
    assertAdmin(req);
    return { ok: true, data: await this.svc.patchConfig(body) };
  }
}
