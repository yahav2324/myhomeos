import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ShoppingListsScreen } from '../screens/ShoppingListsScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';
import { t } from '../../../shared/i18n/i18n';

export type ShoppingStackParamList = {
  ShoppingLists: undefined;
  ShoppingList: { listId: string; listName?: string };
};

const Stack = createNativeStackNavigator<ShoppingStackParamList>();

export function ShoppingStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ShoppingLists"
        component={ShoppingListsScreen}
        options={{ title: t('shopping_lists') }}
      />
      <Stack.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
        options={{ title: t('shopping_list') }}
      />
    </Stack.Navigator>
  );
}
