import * as React from 'react';
import type { BoxItem } from '../model/types';
import { BoxUpsertedPayload, getSocket } from '../../../shared/ws/socket';
import { mapWsToBox } from '../mappers/ws-to-box.mapper';

type Handlers = {
  onUpsert: (box: BoxItem) => void;
  onDelete?: (id: string) => void;
};

export function useBoxesSocket({ onUpsert, onDelete }: Handlers) {
  React.useEffect(() => {
    const socket = getSocket();

    const handleUpsert = (payload: BoxUpsertedPayload) => {
      onUpsert(mapWsToBox(payload));
    };

    const handleDelete = (payload: { id: string }) => {
      onDelete?.(payload.id);
    };

    socket.on('boxUpserted', handleUpsert);
    socket.on('boxDeleted', handleDelete);

    return () => {
      socket.off('boxUpserted', handleUpsert);
      socket.off('boxDeleted', handleDelete);
    };
  }, [onUpsert, onDelete]);
}
