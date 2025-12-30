import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabsNavigator } from './TabsNavigator';
import { CreateBoxScreen } from '../features/boxes/screens/CreateBoxScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={TabsNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="CreateBox"
        component={CreateBoxScreen}
        options={{ title: 'Create Box' }}
      />
    </Stack.Navigator>
  );
}
