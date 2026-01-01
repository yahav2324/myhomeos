import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabsNavigator } from './TabsNavigator';
import { CreateBoxScreen } from '../features/boxes/screens/CreateBoxScreen';
import { RootStackParamList } from './types';
import { SetFullLevelScreen } from '../features/boxes/screens/SetFullLevelScreen';
import { ConnectBoxScreen } from '../features/boxes/screens/ConnectBoxScreen';
import { WsProvider } from '../shared/ws/WsProvider';
import { BoxDetailsScreen } from '../features/boxes/screens/BoxDetailsScreen';
import { useLangStore } from '../shared/i18n/lang.store';
import { SettingsScreen } from '../features/settings/screen/SettingsScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const hydrate = useLangStore((s) => s.hydrate);
  const hydrated = useLangStore((s) => s.hydrated);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) return null; // או Splash קטן
  return (
    <WsProvider>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
        <Stack.Screen
          name="ConnectBox"
          component={ConnectBoxScreen}
          options={{ title: 'Connect box' }}
        />
        <Stack.Screen
          name="CreateBox"
          component={CreateBoxScreen}
          options={{ title: 'Create Box' }}
        />
        <Stack.Screen
          name="SetFullLevel"
          component={SetFullLevelScreen}
          options={{ title: 'Full level' }}
        />
        <Stack.Screen name="BoxDetails" component={BoxDetailsScreen} options={{ title: 'Box' }} />
      </Stack.Navigator>
    </WsProvider>
  );
}
