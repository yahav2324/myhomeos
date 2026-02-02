import * as React from 'react';
import { View, Pressable, Text } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { googleLogin } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

type GoogleTokens = { accessToken: string; idToken?: string };

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

export function AuthGoogleScreen({ navigation }: any) {
  const setSession = useAuthStore((s) => s.setSession);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onGoogle() {
    setLoading(true);
    setErr(null);

    try {
      console.log('[GOOGLE] 1) hasPlayServices...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      console.log('[GOOGLE] 2) signIn...');
      await GoogleSignin.signIn();

      console.log('[GOOGLE] 3) getTokens...');
      const tokens = (await GoogleSignin.getTokens()) as unknown as GoogleTokens;
      console.log('[GOOGLE] tokens keys=', Object.keys(tokens));
      console.log('[GOOGLE] has idToken?', Boolean(tokens.idToken));

      const idToken = tokens.idToken;
      if (!idToken) throw new Error('חסר id_token מגוגל');

      console.log('[GOOGLE] 4) calling backend googleLogin...');
      const res = await googleLogin(idToken, 'mobile');

      console.log('[GOOGLE] 5) setSession...');
      await setSession(res.accessToken, res.refreshToken, Boolean(res.needsOnboarding));

      console.log('[GOOGLE] 6) navigation.reset...');
      navigation.reset({
        index: 0,
        routes: [{ name: res.needsOnboarding ? 'CreateHousehold' : 'Tabs' }],
      });
    } catch (e: any) {
      console.log('[GOOGLE] ERROR:', e);
      setErr(e?.message ?? String(e) ?? 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>התחברות</Text>
      <Text style={{ opacity: 0.8 }}>כניסה עם Google</Text>

      {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}

      <Pressable
        disabled={loading}
        onPress={onGoogle}
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ textAlign: 'center' }}>{loading ? 'מתחבר...' : 'הזדהות עם Google'}</Text>
      </Pressable>
    </View>
  );
}
