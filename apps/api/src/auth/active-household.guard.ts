import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActiveHouseholdGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest() as any;
    const userId = req.user?.sub ?? req.user?.id;

    if (!userId) throw new ForbiddenException('Not authenticated');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeHouseholdId: true },
    });

    const householdId = user?.activeHouseholdId;
    if (!householdId) throw new ForbiddenException('No active household. Complete onboarding.');

    req.householdId = householdId;
    return true;
  }
}
