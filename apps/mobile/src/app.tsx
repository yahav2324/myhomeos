import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './navigation/RootNavigator';
import { useLangStore } from './shared/i18n/lang.store';

export default function App() {
  const version = useLangStore((s) => s.version);

  return (
    <NavigationContainer key={version}>
      <RootNavigator />
    </NavigationContainer>
  );
}
