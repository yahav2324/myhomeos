import * as React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NameAutocompleteField } from '../../../shared/components';
import { theme } from '../../../shared/theme/theme';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import { Card } from '../../../shared/ui/Card';
import type { RootStackParamList } from '../../../navigation/types';
import { useCreateBox } from '../hooks/useCreateBox';
import { setFullLevel } from '../api/boxes.api'; // PATCH /boxes/:id/set-full
import { authedFetch } from '../../auth/api/auth.api';
import { useLangStore } from '../../../shared/i18n/lang.store';
import { useHubStore, selectTelemetryForBox } from '../../hub/hub.store';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateBox'>;

export function CreateBoxScreen({ navigation, route }: Props) {
  const { deviceId, currentQuantity, unit, onCreated } = route.params;
  const lang = useLangStore((s) => s.lang);
  const telemetry = useHubStore((s) => {
    for (const hub of Object.values(s.hubs)) {
      const t = hub.lastTelemetryByAddr?.[deviceId];
      if (t) return t;
    }
    return undefined;
  });

  const liveQuantity = telemetry?.quantity ?? currentQuantity;
  const [name, setName] = React.useState('');
  const [fullQuantity, setFullQuantity] = React.useState(String(liveQuantity));

  const { submit, loading, error } = useCreateBox();

  const canSubmit = name.trim().length > 0 && Number(fullQuantity) > 0;

  const onCreate = async () => {
    const created = await submit({
      deviceId,
      name: name.trim(),
      unit,
    });

    await setFullLevel(created.id, Number(fullQuantity));

    onCreated?.();
    navigation.popToTop();
  };

  return (
    <View style={styles.container}>
      <Card>
        <AppText style={styles.title}>Create Box</AppText>
        <AppText tone="muted" style={{ marginTop: 4 }}>
          Connected to <AppText>{deviceId}</AppText>. Current amount:{' '}
          <AppText>
            {liveQuantity}
            {unit}
          </AppText>
        </AppText>

        <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
          <NameAutocompleteField
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rice"
            minChars={2}
            lang={lang}
            fetchSuggest={async (q, lang) => {
              const res = await authedFetch(
                `/terms/suggest?q=${encodeURIComponent(q)}&lang=${lang}&limit=10`,
              );
              const json = await res.json();
              if (!res.ok || !json?.ok) throw new Error('suggest failed');
              return json.data as any; // צריך להיות SuggestTerm[]
            }}
            onCreateNew={async (text, lang) => {
              const res = await authedFetch(`/terms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, lang }),
              });
              const json = await res.json();
              if (!res.ok || !json?.ok) throw new Error(json?.errors?.formErrors?.[0] ?? 'Failed');
            }}
            onVote={async (termId, vote) => {
              const res = await authedFetch(`/terms/${termId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vote }), // 'UP' | 'DOWN'
              });
              const json = await res.json();
              if (!res.ok || !json?.ok) throw new Error('vote failed');
            }}
          />

          <Field label={`Full level (${unit})`}>
            <TextInput
              value={fullQuantity}
              onChangeText={setFullQuantity}
              placeholder="e.g. 1000"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              keyboardType="numeric"
            />
          </Field>

          <AppButton
            title={`Use current (${liveQuantity}${unit})`}
            variant="ghost"
            onPress={() => setFullQuantity(String(liveQuantity))}
          />

          {error ? (
            <AppText tone="danger" style={{ fontWeight: '800' }}>
              {error}
            </AppText>
          ) : null}

          <AppButton
            title={loading ? 'Creating...' : 'Create'}
            onPress={onCreate}
            disabled={!canSubmit || loading}
          />

          <AppText tone="muted" style={{ fontSize: 12 }}>
            (Next: real Bluetooth scan + real live telemetry)
          </AppText>
        </View>
      </Card>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <AppText style={{ fontWeight: '800' }}>{label}</AppText>
      {children}
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
});
