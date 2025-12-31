import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { theme } from '../../../shared/theme/theme';
import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ConnectBox'>;

export function ConnectBoxScreen({ navigation, route }: Props) {
  const onDone = route.params?.onDone;

  // MOCK data (כאילו סרקנו BLE ומצאנו קופסה)
  const [connected, setConnected] = React.useState(false);
  const deviceId = 'SK-BOX-001';
  const unit: 'g' | 'ml' = 'g';

  // MOCK “current weight” מהקופסה
  const [currentQuantity, setCurrentQuantity] = React.useState(742);

  return (
    <View style={styles.container}>
      <Card>
        <AppText style={styles.title}>Connect your box</AppText>
        <AppText tone="muted" style={{ marginTop: 4 }}>
          Turn on the box and keep it nearby. We’ll connect via Bluetooth.
        </AppText>

        <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
          {!connected ? (
            <>
              <AppButton title="Scan (mock)" onPress={() => setConnected(true)} />
              <AppText tone="muted" style={{ fontSize: 12 }}>
                (Next: real BLE scan)
              </AppText>
            </>
          ) : (
            <>
              <AppText>
                Device: <AppText>{deviceId}</AppText>
              </AppText>

              <AppText tone="muted">
                Current amount:{' '}
                <AppText>
                  {currentQuantity}
                  {unit}
                </AppText>
              </AppText>

              <View style={{ flexDirection: 'row', gap: theme.space.md }}>
                <AppButton
                  title="-50"
                  variant="ghost"
                  onPress={() => setCurrentQuantity((q) => Math.max(0, q - 50))}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="+50"
                  variant="ghost"
                  onPress={() => setCurrentQuantity((q) => q + 50)}
                  style={{ flex: 1 }}
                />
              </View>

              <AppButton
                title="Continue"
                onPress={() =>
                  navigation.replace('CreateBox', {
                    deviceId,
                    currentQuantity,
                    unit,
                    onCreated: () => {
                      onDone?.();
                    },
                  })
                }
              />
            </>
          )}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.xl },
  title: { fontSize: 20, fontWeight: '900' },
});
