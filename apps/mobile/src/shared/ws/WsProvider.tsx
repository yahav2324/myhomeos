import * as React from 'react';
import { BoxUpsertedPayload, getSocket } from './socket';
import { useBoxesStore } from '../../features/boxes/store/boxes.store';

export function WsProvider({ children }: { children: React.ReactNode }) {
  const upsertFromWs = useBoxesStore((s) => s.upsertFromWs);

  React.useEffect(() => {
    const s = getSocket();

    const onUpsert = (payload: BoxUpsertedPayload) => {
      // payload כבר מגיע מהשרת כ-Box
      upsertFromWs(payload);
    };

    s.on('boxUpserted', onUpsert);
    return () => {
      s.off('boxUpserted', onUpsert);
    };
  }, [upsertFromWs]);

  return <>{children}</>;
}
