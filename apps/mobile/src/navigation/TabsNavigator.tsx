import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BoxesScreen } from '../features/boxes/screens/BoxesScreen';
import { TabsParamList } from './types';

const Tab = createBottomTabNavigator<TabsParamList>();

export function TabsNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Boxes" component={BoxesScreen} />
      {/* <Tab.Screen name="Settings" component={SettingsScreen} /> */}
    </Tab.Navigator>
  );
}
