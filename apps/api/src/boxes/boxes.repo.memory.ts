import { Injectable } from '@nestjs/common';
import type { Box } from '@smart-kitchen/contracts';
import type { BoxesRepository } from './boxes.repository';

@Injectable()
export class MemoryBoxesRepository implements BoxesRepository {
  private readonly store = new Map<string, Box>(); // id -> Box

  findAll(): Box[] {
    return Array.from(this.store.values());
  }

  findById(id: string): Box | null {
    return this.store.get(id) ?? null;
  }

  findByDeviceId(deviceId: string): Box | null {
    for (const b of this.store.values()) {
      if (b.deviceId === deviceId) return b;
    }
    return null;
  }

  save(box: Box): void {
    this.store.set(box.id, box);
  }
}
