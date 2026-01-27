import React, { useState } from 'react';
import { View, TextInput, Text, Pressable } from 'react-native';
import { authedFetch } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

export function CreateHouseholdScreen({ navigation }: any) {
  const [name, setName] = useState('משפחת זמיר');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const onCreate = async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await authedFetch('/households', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'Failed');
      }

      // needsOnboarding becomes false (tokens unchanged)
      if (accessToken && refreshToken) await setSession(accessToken, refreshToken, false);

      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } catch (e: any) {
      setErr(e.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>יצירת בית</Text>
      <Text>תן שם לבית/משפחה</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}

      <Pressable
        onPress={onCreate}
        disabled={loading || name.trim().length < 2}
        style={{ padding: 14, borderRadius: 12, borderWidth: 1, opacity: loading ? 0.6 : 1 }}
      >
        <Text style={{ textAlign: 'center' }}>{loading ? 'יוצר...' : 'צור בית'}</Text>
      </Pressable>
    </View>
  );
}
