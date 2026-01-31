import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const userId = req.user?.id; // חייב ש-JwtAuthGuard ישים לפחות id

    if (!userId) throw new ForbiddenException('Forbidden');

    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!u?.isAdmin) throw new ForbiddenException('Admin only');
    return true;
  }
}
