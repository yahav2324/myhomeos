import * as React from 'react';
import { useLangStore } from '../../shared/i18n/lang.store';

export function LanguageGate({ children }: { children: React.ReactNode }) {
  const version = useLangStore((s) => s.version);
  return <React.Fragment key={version}>{children}</React.Fragment>;
}
