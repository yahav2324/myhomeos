import * as React from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { RootNavigator } from './navigation/RootNavigator';
import { useLangStore } from './shared/i18n/lang.store';
import { maybePromptRtlRestartIfPending } from './shared/i18n/rtl';
import { theme } from './shared/theme/theme';
import { initSqlite } from './shared/db/sqlite';
import { useNetStore } from './shared/offline/net.store';
import { useShoppingStore } from './features/shopping/store/shopping.store';
import { useNetworkStore } from './shared/network/network.store';

export default function App() {
  const hydrated = useLangStore((s) => s.hydrated);

  // ✅ init network ONCE (בלי deps שיכולים להשתנות)
  React.useEffect(() => {
    const cleanup = useNetworkStore.getState().init();
    return cleanup;
  }, []);

  // ✅ init db once
  React.useEffect(() => {
    if (Platform.OS !== 'web') {
      initSqlite().catch((e) => console.log('initSqlite failed', e));
    }
  }, []);

  // ✅ net hydrate once (native only)
  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    const unsub = useNetStore.getState().hydrate();
    return unsub;
  }, []);

  // ✅ when network comes back -> try sync (native only)
  React.useEffect(() => {
    if (Platform.OS === 'web') return;

    let prev = useNetStore.getState().isOnline;

    const unsub = useNetStore.subscribe((state) => {
      const now = state.isOnline;
      if (!prev && now) {
        void useShoppingStore.getState().trySync();
      }
      prev = now;
    });

    return unsub;
  }, []);

  // ✅ hydrate lang ONCE
  React.useEffect(() => {
    void useLangStore.getState().hydrate();
  }, []);

  // ✅ show prompt only after hydrated
  React.useEffect(() => {
    if (!hydrated) return;
    void maybePromptRtlRestartIfPending();
  }, [hydrated]);

  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
