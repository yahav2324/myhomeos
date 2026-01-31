import * as React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ShoppingListsScreen } from '../screens/ShoppingListsScreen';
import { ShoppingListScreen } from '../screens/ShoppingListScreen';

export type ShoppingStackParamList = {
  ShoppingLists: undefined;
  ShoppingList: { listId: string };
};

const Stack = createNativeStackNavigator<ShoppingStackParamList>();

export function ShoppingStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ShoppingLists"
        component={ShoppingListsScreen}
        options={{ title: 'רשימות קניות' }}
      />
      <Stack.Screen
        name="ShoppingList"
        component={ShoppingListScreen}
        options={{ title: 'רשימה' }}
      />
    </Stack.Navigator>
  );
}
