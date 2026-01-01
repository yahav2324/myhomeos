import * as React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable } from 'react-native';

import { theme } from '../../../shared/theme/theme';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import { Card } from '../../../shared/ui/Card';
import type { RootStackParamList } from '../../../navigation/types';
import { recalibrateFullLevel, setFullLevel } from '../api/boxes.api';

type Props = NativeStackScreenProps<RootStackParamList, 'SetFullLevel'>;

export function SetFullLevelScreen({ navigation, route }: Props) {
  const { boxId, boxName, unit, onDone, mode } = route.params;

  const [fullQuantity, setFullQuantity] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);

  const canSubmit = Number(fullQuantity) > 0 && confirmed;
  React.useEffect(() => {
    setConfirmed(false);
    if (route.params.currentFullQuantity != null) {
      setFullQuantity(String(route.params.currentFullQuantity));
    }
  }, [route.params.currentFullQuantity]);

  const onSave = async () => {
    setErr(null);
    setLoading(true);
    try {
      if (mode === 'set') {
        await setFullLevel(boxId, Number(fullQuantity));
      } else {
        await recalibrateFullLevel(boxId, Number(fullQuantity));
      }
      onDone?.(); // refresh list
      navigation.goBack();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card>
        <AppText style={styles.title}>Define full level</AppText>
        <AppText tone="muted" style={{ marginTop: 4 }}>
          Set what is considered a <AppText>full</AppText> box for <AppText>{boxName}</AppText>. The
          scale will report the current amount automatically.
        </AppText>

        <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
          <View style={{ gap: 8 }}>
            <AppText style={{ fontWeight: '800' }}>Full quantity ({unit})</AppText>
            <TextInput
              value={fullQuantity}
              onChangeText={setFullQuantity}
              placeholder="e.g. 1000"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              keyboardType="numeric"
            />
          </View>

          {err ? (
            <AppText tone="danger" style={{ fontWeight: '800' }}>
              {err}
            </AppText>
          ) : null}

          <AppButton
            title={loading ? 'Saving...' : 'Save full level'}
            onPress={onSave}
            disabled={!canSubmit || loading}
          />
          <Pressable
            onPress={() => setConfirmed((v) => !v)}
            style={({ pressed }) => [styles.confirmRow, pressed && { opacity: 0.8 }]}
          >
            <View style={[styles.checkbox, confirmed && styles.checkboxOn]}>
              {confirmed ? <AppText style={{ fontWeight: '900' }}>✓</AppText> : null}
            </View>

            <AppText tone="muted" style={{ flex: 1 }}>
              I understand this will affect percent & alerts for this box.
            </AppText>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.space.xl },
  title: { fontSize: 20, fontWeight: '900' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.text,
    backgroundColor: '#0F172A',
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  checkboxOn: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderColor: 'rgba(34,197,94,0.6)',
  },
});
