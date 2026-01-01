import * as React from 'react';
import { BoxUpsertedPayload, getSocket } from './socket';
import { useBoxesStore } from '../../features/boxes/store/boxes.store';

type BoxDeletedPayload = { id: string };

export function WsProvider({ children }: { children: React.ReactNode }) {
  const upsertFromWs = useBoxesStore((s) => s.upsertFromWs);
  const remove = useBoxesStore((s) => s.remove);

  React.useEffect(() => {
    const s = getSocket();

    const onUpsert = (payload: BoxUpsertedPayload) => {
      upsertFromWs(payload);
    };

    const onDeleted = (payload: BoxDeletedPayload) => {
      remove(payload.id);
    };

    s.on('boxUpserted', onUpsert);
    s.on('boxDeleted', onDeleted);

    return () => {
      s.off('boxUpserted', onUpsert);
      s.off('boxDeleted', onDeleted);
    };
  }, [upsertFromWs, remove]);

  return <>{children}</>;
}
