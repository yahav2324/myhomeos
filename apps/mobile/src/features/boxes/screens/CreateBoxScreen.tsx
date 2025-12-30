import * as React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { theme } from '../../../shared/theme/theme';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import { Card } from '../../../shared/ui/Card';

export function CreateBoxScreen() {
  const [name, setName] = React.useState('');
  const [capacity, setCapacity] = React.useState('');
  const [unit, setUnit] = React.useState<'g' | 'ml'>('g');

  const canSubmit = name.trim().length > 0 && Number(capacity) > 0;

  return (
    <View style={styles.container}>
      <Card>
        <AppText style={styles.title}>Create Box</AppText>
        <AppText tone="muted" style={{ marginTop: 4 }}>
          Define a new storage box to track.
        </AppText>

        <View style={{ marginTop: theme.space.lg, gap: theme.space.md }}>
          <Field label="Name">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Rice"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              autoCapitalize="words"
            />
          </Field>

          <Field label="Capacity">
            <TextInput
              value={capacity}
              onChangeText={setCapacity}
              placeholder="e.g. 1000"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              keyboardType="numeric"
            />
          </Field>

          <View style={styles.unitRow}>
            <AppButton
              title="g"
              variant={unit === 'g' ? 'primary' : 'ghost'}
              onPress={() => setUnit('g')}
              style={{ flex: 1 }}
            />
            <AppButton
              title="ml"
              variant={unit === 'ml' ? 'primary' : 'ghost'}
              onPress={() => setUnit('ml')}
              style={{ flex: 1 }}
            />
          </View>

          <AppButton
            title="Create"
            onPress={() => console.log('Create box')}
            disabled={!canSubmit}
          />
          <AppText tone="muted" style={{ fontSize: 12 }}>
            (Next step: wire to UseCase + API)
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
  unitRow: { flexDirection: 'row', gap: theme.space.md },
});
