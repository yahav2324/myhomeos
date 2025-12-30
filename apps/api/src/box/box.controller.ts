import { Body, Controller, Get, Post, Param } from '@nestjs/common';
import { BoxSchema, type Box } from '@smart-kitchen/contracts';

const boxes = new Map<string, Box>();

@Controller('boxes')
export class BoxController {
  @Post()
  create(@Body() body: unknown) {
    const parsed = BoxSchema.safeParse(body);
    if (!parsed.success) return { ok: false, errors: parsed.error.flatten() };

    const box = parsed.data;
    boxes.set(box.id, box);
    return { ok: true, data: box };
  }

  @Get()
  list() {
    return { ok: true, data: Array.from(boxes.values()) };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return { ok: true, data: boxes.get(id) ?? null };
  }
}
