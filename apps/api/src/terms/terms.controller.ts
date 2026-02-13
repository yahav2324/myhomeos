import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TermsService } from './terms.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AuthGuard } from '@nestjs/passport';

function getUserIdOrNull(req: any): string | null {
  return req?.user?.id ?? null;
}

function getUserIdOrThrow(req: any): string {
  const id = getUserIdOrNull(req);
  if (!id) throw new Error('Unauthorized (missing req.user.id)');
  return id;
}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // אם אין טוקן / לא תקין – פשוט נחזיר null ולא נזרוק
    if (err) return null;
    return user ?? null;
  }
}

@Controller()
export class TermsController {
  constructor(private readonly terms: TermsService) {}
  @UseGuards(JwtAuthGuard)
  @Put('/terms/:id/image')
  async setImage(
    @Param('id') id: string,
    @Body() body: { imageUrl: string | null },
    @Req() req: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.terms.setTermImage(id, body.imageUrl ?? null, userId);
  }

  // GET /terms/suggest?q=ri&lang=en&limit=10
  @UseGuards(OptionalJwtAuthGuard)
  @Get('/terms/suggest')
  async suggest(
    @Query('q') q: string,
    @Query('lang') lang: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    const userId = getUserIdOrNull(req); // optional
    const lim = limit ? Number(limit) : 10;

    return {
      ok: true,
      data: await this.terms.suggest({
        q: q ?? '',
        lang: (lang ?? 'en').toLowerCase(),
        limit: Number.isFinite(lim) ? lim : 10,
        userId,
      }),
    };
  }

  // POST /terms  (requires auth)
  @UseGuards(JwtAuthGuard)
  @Post('/terms')
  async create(@Body() body: unknown, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.terms.create(body, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/terms/:id/my-defaults')
  async upsertMyDefaults(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.terms.upsertMyDefaults(id, body, userId);
  }

  // POST /terms/:id/vote  (requires auth)
  @UseGuards(JwtAuthGuard)
  @Post('/terms/:id/vote')
  async vote(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const userId = getUserIdOrThrow(req);
    return this.terms.vote(id, body, userId);
  }
}
