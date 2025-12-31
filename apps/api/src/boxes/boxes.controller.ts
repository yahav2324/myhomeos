import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { BoxesService } from './boxes.service';

@Controller('boxes')
export class BoxesController {
  constructor(private readonly service: BoxesService) {}

  @Post()
  create(@Body() body: unknown) {
    return this.service.create(body);
  }

  @Get()
  list() {
    return { ok: true, data: this.service.list() };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return { ok: true, data: this.service.get(id) };
  }

  @Patch(':id/set-full')
  setFull(@Param('id') id: string, @Body() body: unknown) {
    return this.service.setFull(id, body);
  }

  @Post(':id/recalibrate-full')
  recalibrateFull(@Param('id') id: string, @Body() body: unknown) {
    return this.service.recalibrateFull(id, body);
  }
}
