import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ShoppingListsScreen } from '../screens/ShoppingListsScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';
import { t } from '../../../shared/i18n/i18n';
import { useLangStore } from '../../../shared/i18n/lang.store';

export type ShoppingStackParamList = {
  ShoppingLists: undefined;
  ShoppingList: { listLocalId: string; listName?: string };
};

const Stack = createNativeStackNavigator<ShoppingStackParamList>();

export function ShoppingStack() {
  const lang = useLangStore((s) => s.lang);
  const isRTL = lang === 'he';

  return (
    <Stack.Navigator screenOptions={{ headerTitleAlign: isRTL ? 'center' : 'left' }}>
      <Stack.Screen
        name="ShoppingLists"
        component={ShoppingListsScreen}
        options={{ title: t('shopping_lists') }}
      />
      <Stack.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
        options={({ route }) => ({
          title: route.params?.listName ? route.params.listName : t('shopping_list'),
        })}
      />
    </Stack.Navigator>
  );
}
