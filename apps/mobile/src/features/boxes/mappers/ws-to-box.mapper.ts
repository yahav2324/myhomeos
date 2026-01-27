import type { BoxItem } from '../model/types';
import type { BoxUpsertedPayload } from '../../../shared/ws/socket';

export function mapWsToBox(payload: BoxUpsertedPayload): BoxItem {
  return {
    id: payload.id,
    code: payload.code,
    deviceId: payload.deviceId,
    name: payload.name,
    unit: payload.unit,
    quantity: payload.quantity,
    percent: payload.percent,
    state: payload.state,
    fullQuantity: payload.fullQuantity,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    lastReadingAt: payload.lastReadingAt,
  };
}
