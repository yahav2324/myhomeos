import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabsNavigator } from './TabsNavigator';
import { RootStackParamList } from './types';

import { ConnectBoxScreen } from '../features/boxes/screens/ConnectBoxScreen';
import { CreateBoxScreen } from '../features/boxes/screens/CreateBoxScreen';
import { SetFullLevelScreen } from '../features/boxes/screens/SetFullLevelScreen';
import { BoxDetailsScreen } from '../features/boxes/screens/BoxDetailsScreen';
import { SplashScreen } from '../features';
import { WsProvider } from '../shared/ws/WsProvider';
import { useLangStore } from '../shared/i18n/lang.store';

import { AuthPhoneScreen } from '../features/auth/screens/AuthPhoneScreen';
import { AuthGoogleScreen } from '../features/auth/screens/AuthGoogleScreen';
import { CreateHouseholdScreen } from '../features/households/screens/CreateHouseholdScreen';

import { getTokens } from '../features/auth/auth.tokens';
import { authedFetch } from '../features/auth/api/auth.api';
import { HubScreen } from '../features/hub/screen/HubScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// ✅ שים AuthGoogle כ-route הראשי במקום AuthPhone
type GateRoute = 'AuthGoogle' | 'CreateHousehold' | 'Tabs';

async function probeRoute(): Promise<GateRoute> {
  const { accessToken, refreshToken } = await getTokens();

  // אין טוקנים -> גוגל
  if (!accessToken && !refreshToken) return 'AuthGoogle';

  // יש טוקנים -> נבדוק האם יש Household פעיל דרך /boxes
  const res = await authedFetch('/boxes', { method: 'GET' });

  if (res.status === 401) return 'AuthGoogle';

  if (res.status === 403) {
    // אצלך לפעמים אין json, אז נעשה safe
    const json = await res.json().catch(() => null);
    const msg = json?.message ?? '';
    if (typeof msg === 'string' && msg.includes('No active household')) return 'CreateHousehold';
    return 'CreateHousehold';
  }

  return 'Tabs';
}

export function RootNavigator() {
  const hydrated = useLangStore((s) => s.hydrated);
  const [initialRoute, setInitialRoute] = React.useState<GateRoute | null>(null);

  React.useEffect(() => {
    if (useLangStore.getState().hydrated) return;
    void useLangStore.getState().hydrate();
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const route = await probeRoute();
      if (!alive) return;
      setInitialRoute(route);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!hydrated) return null;
  if (!initialRoute) return null;

  return (
    <WsProvider>
      <Stack.Navigator initialRouteName="Splash">
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          initialParams={{ next: initialRoute }}
          options={{ headerShown: false }}
        />
        {/* AUTH */}
        <Stack.Screen
          name="AuthGoogle"
          component={AuthGoogleScreen}
          options={{ headerShown: false }}
        />

        {/* אם אתה רוצה להשאיר OTP ל-debug, תשאיר – אבל הוא לא ה-default */}
        <Stack.Screen
          name="AuthPhone"
          component={AuthPhoneScreen}
          options={{ headerShown: false }}
        />
        {/* <Stack.Screen name="AuthOtp" component={AuthOtpScreen} options={{ headerShown: false }} /> */}

        {/* ONBOARDING */}
        <Stack.Screen
          name="CreateHousehold"
          component={CreateHouseholdScreen}
          options={{ title: 'Create household' }}
        />

        <Stack.Screen name="Hub" component={HubScreen} />

        {/* APP */}
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
