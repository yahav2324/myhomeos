import * as React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

import { RootNavigator } from './navigation/RootNavigator';
import { useLangStore } from './shared/i18n/lang.store';
import { maybePromptRtlRestartIfPending } from './shared/i18n/rtl';
import { theme } from './shared/theme/theme';

export default function App() {
  const hydrated = useLangStore((s) => s.hydrated);
  const hydrate = useLangStore((s) => s.hydrate);
  const version = useLangStore((s) => s.version);

  // 1) hydrate פעם אחת בתחילת האפליקציה
  React.useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // 2) להציג prompt רק אחרי שסיימנו hydrate
  React.useEffect(() => {
    if (!hydrated) return;
    void maybePromptRtlRestartIfPending();
  }, [hydrated]);

  // 3) בזמן טעינה – לא להרים את הניווט בכלל
  // (מונע ריצות מוקדמות / UI לא יציב)
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

  // אם אתה באמת צריך rerender של כל ה-navigation על שינוי שפה,
  // אפשר להשאיר key=version. אחרת עדיף להסיר.
  return (
    <NavigationContainer key={version}>
      <RootNavigator />
    </NavigationContainer>
  );
}
