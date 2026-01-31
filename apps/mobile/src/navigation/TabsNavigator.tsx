import React from 'react';
import { I18nManager } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { BoxesScreen } from '../features/boxes/screens/BoxesScreen';
import { SettingsScreen } from '../features/settings/screen/SettingsScreen';
import { TabsParamList } from './types';
import { t } from '../shared/i18n/i18n';
import { theme } from '../shared/theme/theme';
import { AppText } from '../shared/ui/AppText';
import { ShoppingStack } from '../features/shopping/navigation/shopping.stack';

const Tab = createBottomTabNavigator<TabsParamList>();

export function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // חשוב: אתה כבר מציג כותרות בתוך המסכים
        tabBarStyle: {
          backgroundColor: theme.colors.bg,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.text,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarLabel: ({ color, focused, children }) => (
          <AppText
            style={{
              color,
              fontSize: 12,
              fontWeight: focused ? '900' : '700',
              // לוודא label לא נשבר ב-RTL
              textAlign: 'center',
              writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
            }}
          >
            {children}
          </AppText>
        ),
      }}
    >
      <Tab.Screen
        name="Boxes"
        component={BoxesScreen}
        options={{
          title: t('boxes'),
          tabBarIcon: ({ color }) => (
            <AppText style={{ color, fontSize: 16, fontWeight: '900' }}>▦</AppText>
          ),
        }}
      />
      <Tab.Screen
        name="ShoppingTab"
        component={ShoppingStack}
        options={{
          title: 'רשימות',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings'),
          tabBarIcon: ({ color }) => (
            <AppText style={{ color, fontSize: 16, fontWeight: '900' }}>⚙︎</AppText>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
