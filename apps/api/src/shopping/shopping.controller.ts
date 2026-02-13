// apps/api/src/shopping/shopping.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ShoppingService } from './shopping.service';
import { ShoppingCategory } from '@smart-kitchen/contracts';
import { JwtAuthGuard } from '../auth/jwt.guard';

type ApiUnit = 'PCS' | 'G' | 'KG' | 'ML' | 'L';

@UseGuards(JwtAuthGuard)
@Controller('shopping')
export class ShoppingController {
  constructor(private readonly shopping: ShoppingService) {}

  private getHouseholdId(req: any): string {
    const householdId = req?.user?.activeHouseholdId;
    if (!householdId) throw new BadRequestException('Missing activeHouseholdId on user');
    return householdId;
  }

  // ===== Lists =====

  @Get('lists')
  listLists(@Req() req: any) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.listLists(householdId);
  }

  @Post('lists')
  createList(@Req() req: any, @Body() body: { name: string }) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.createList(householdId, body);
  }

  @Patch('lists/:id')
  renameList(@Req() req: any, @Param('id') id: string, @Body() body: { name: string }) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.renameList(householdId, id, body);
  }

  @Delete('lists/:id')
  deleteList(@Req() req: any, @Param('id') id: string) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.deleteList(householdId, id);
  }

  // ===== Items =====

  @Get('lists/:id/items')
  listItems(@Req() req: any, @Param('id') listId: string) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.listItems(householdId, listId);
  }

  @Post('lists/:id/items')
  addItem(
    @Req() req: any,
    @Param('id') listId: string,
    @Body()
    body: {
      text: string;
      termId?: string; // ✅ חדש
      qty?: number;
      category?: ShoppingCategory;
      unit?: ApiUnit;
      extra?: any;
      imageUrl?: string | null; // ✅ NEW
    },
  ) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.addItem(householdId, listId, body);
  }

  // ✅ Update item (text/qty/unit/category/extra/checked)
  @Patch('lists/:listId/items/:itemId')
  updateItem(
    @Req() req: any,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body()
    body: {
      text?: string;
      qty?: number;
      unit?: ApiUnit;
      category?: ShoppingCategory | null;
      extra?: any | null;
      checked?: boolean;
      imageUrl?: string | null; // ✅ NEW
    },
  ) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.updateItem(householdId, listId, itemId, body);
  }

  // ✅ Toggle checked (convenience)
  @Patch('lists/:listId/items/:itemId/checked')
  setChecked(
    @Req() req: any,
    @Param('listId') listId: string,
    @Param('itemId') itemId: string,
    @Body() body: { checked: boolean },
  ) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.updateItem(householdId, listId, itemId, { checked: body.checked });
  }

  // ✅ Delete item
  @Delete('lists/:listId/items/:itemId')
  deleteItem(@Req() req: any, @Param('listId') listId: string, @Param('itemId') itemId: string) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.deleteItem(householdId, listId, itemId);
  }

  @Post('import')
  importGuest(@Req() req: any, @Body() body: { lists: any[] }) {
    const householdId = this.getHouseholdId(req);
    return this.shopping.importGuestData(householdId, body);
  }
}
