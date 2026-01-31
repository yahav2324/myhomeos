import * as React from 'react';
import { View, Pressable, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

import { googleLogin } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

WebBrowser.maybeCompleteAuthSession();

export function AuthGoogleScreen({ navigation }: any) {
  const setSession = useAuthStore((s) => s.setSession);

  // ✅ תמיד לחשב, אבל בלי early-return לפני hooks
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

  // ✅ useProxy הוסר בגרסאות מסוימות; preferLocalhost כן קיים
  const redirectUri = AuthSession.makeRedirectUri({
    preferLocalhost: true,
    path: '--/redirect',
  });

  console.log('GOOGLE clientId=', clientId);
  console.log('GOOGLE redirectUri=', redirectUri);
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'MISSING_CLIENT_ID',
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false, // ✅ חשוב!
      extraParams: { nonce: 'nonce', prompt: 'select_account' },
    },
    discovery,
  );

  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      if (response?.type !== 'success') return;

      const idToken = (response.params as any)?.id_token;
      if (!idToken) {
        setErr('חסר id_token מגוגל');
        return;
      }

      setLoading(true);
      setErr(null);
      try {
        const res = await googleLogin(idToken, 'mobile');
        await setSession(res.accessToken, res.refreshToken, Boolean(res.needsOnboarding));

        navigation.reset({
          index: 0,
          routes: [{ name: res.needsOnboarding ? 'CreateHousehold' : 'Tabs' }],
        });
      } catch (e: any) {
        setErr(e?.message ?? 'Failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [response, navigation, setSession]);

  // ✅ עכשיו מותר לעשות UI conditionally (זה לא Hooks)
  if (!clientId) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>התחברות</Text>
        <Text style={{ color: 'red' }}>חסר EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ב-.env</Text>
      </View>
    );
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>התחברות</Text>
      <Text style={{ opacity: 0.8 }}>כניסה עם Google (בלי SMS)</Text>

      {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}

      <Pressable
        disabled={!request || loading}
        onPress={() => promptAsync()}
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          opacity: !request || loading ? 0.6 : 1,
        }}
      >
        <Text style={{ textAlign: 'center' }}>{loading ? 'מתחבר...' : 'הזדהות עם Google'}</Text>
      </Pressable>
    </View>
  );
}
