import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabsNavigator } from './TabsNavigator';
import { CreateBoxScreen } from '../features/boxes/screens/CreateBoxScreen';
import { RootStackParamList } from './types';
import { SetFullLevelScreen } from '../features/boxes/screens/SetFullLevelScreen';
import { ConnectBoxScreen } from '../features/boxes/screens/ConnectBoxScreen';
import { WsProvider } from '../shared/ws/WsProvider';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
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
      </Stack.Navigator>
    </WsProvider>
  );
}
