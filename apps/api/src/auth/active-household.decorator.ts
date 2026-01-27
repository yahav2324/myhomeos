import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const ActiveHouseholdId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest() as any;
  return req.householdId as string;
});
