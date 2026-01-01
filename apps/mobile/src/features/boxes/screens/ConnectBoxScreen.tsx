import * as React from 'react';
import { View, StyleSheet, I18nManager } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { theme } from '../../../shared/theme/theme';
import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import type { RootStackParamList } from '../../../navigation/types';
import { t } from '../../../shared/i18n/i18n'; // תעדכן נתיב לפי הפרויקט שלך

type Props = NativeStackScreenProps<RootStackParamList, 'ConnectBox'>;

export function ConnectBoxScreen({ navigation, route }: Props) {
  const onDone = route.params?.onDone;

  const isRTL = I18nManager.isRTL;

  // MOCK data (כאילו סרקנו BLE ומצאנו קופסה)
  const [connected, setConnected] = React.useState(false);
  const deviceId = 'SK-BOX-001';
  const unit: 'g' | 'ml' = 'g';

  // MOCK “current weight” מהקופסה
  const [currentQuantity, setCurrentQuantity] = React.useState(742);

  return (
    <View style={styles.container}>
      <Card>
        <AppText style={[styles.title, isRTL && styles.textRTL]}>{t('connectBoxTitle')}</AppText>

        <AppText tone="muted" style={[{ marginTop: 4 }, isRTL && styles.textRTL]}>
          {t('connectBoxSubtitle')}
        </AppText>

        <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
          {!connected ? (
            <>
              <AppButton title={t('scanMock')} onPress={() => setConnected(true)} />
              <AppText tone="muted" style={[{ fontSize: 12 }, isRTL && styles.textRTL]}>
                {t('nextRealBleScan')}
              </AppText>
            </>
          ) : (
            <>
              <AppText style={isRTL && styles.textRTL}>
                {t('deviceLabel')} <AppText>{deviceId}</AppText>
              </AppText>

              <AppText tone="muted" style={isRTL && styles.textRTL}>
                {t('currentAmountLabel')}{' '}
                <AppText>
                  {currentQuantity}
                  {unit}
                </AppText>
              </AppText>

              <View style={[styles.row, isRTL && styles.rowRTL]}>
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
                title={t('continue')}
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

  textRTL: { textAlign: 'right', writingDirection: 'rtl' },

  row: { flexDirection: 'row', gap: theme.space.md },
  rowRTL: { flexDirection: 'row-reverse' },
});
