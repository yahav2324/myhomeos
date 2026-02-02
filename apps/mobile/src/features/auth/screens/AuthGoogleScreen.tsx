import * as React from 'react';
import { View, Pressable, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

import { googleLogin } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';

WebBrowser.maybeCompleteAuthSession();

export function AuthGoogleScreen({ navigation }: any) {
  const setSession = useAuthStore((s) => s.setSession);

  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const expoClientId = webClientId; // לרוב אפשר להשתמש באותו Web Client ID

  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId,
    androidClientId,
    iosClientId,
    webClientId,
    scopes: ['openid', 'profile', 'email'],
  });
  console.log('androidClientId=', androidClientId);
  console.log('iosClientId=', iosClientId);
  console.log('webClientId=', webClientId);
  console.log('redirectUri=', request?.redirectUri);
  React.useEffect(() => {
    (async () => {
      if (response?.type !== 'success') return;

      // ✅ זה ה-id_token שמגיע מגוגל בצורה “תקינה” לנייטיב
      const idToken = response.authentication?.idToken;
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

  // UI
  if (!androidClientId) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700' }}>התחברות</Text>
        <Text style={{ color: 'red' }}>חסר EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ב-.env</Text>
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
        onPress={() => promptAsync({ useProxy: true })}
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
