import * as React from 'react';
import { View, Pressable, Text, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Prompt } from 'expo-auth-session';

// ספריות תמיכה ל-Web
import * as GoogleWeb from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

import { googleLogin } from '../api/auth.api';
import { useAuthStore } from '../store/auth.store';
import { importGuestToServer } from '../../shopping/offline/shopping.sync';
import { setMeta } from '../../../shared/db/sqlite';

// נדרש עבור Web כדי להשלים את תהליך האימות
WebBrowser.maybeCompleteAuthSession();

// קונפיגורציה ל-Mobile
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  offlineAccess: true,
  forceCodeForRefreshToken: true,
});

export function AuthGoogleScreen({ navigation }: any) {
  const setSession = useAuthStore((s) => s.setSession);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // הגדרת Hook עבור Web בלבד
  const [request, response, promptAsync] = GoogleWeb.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    responseType: 'id_token',
    prompt: Prompt.SelectAccount,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: AuthSession.makeRedirectUri({
      preferLocalhost: true,
    }),
  });

  // פונקציית עזר לפענוח השם מה-Token ב-Web (מכיוון שזה Base64 פשוט)
  const decodeNameFromIdToken = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(jsonPayload).name;
    } catch (e) {
      return 'משתמש גוגל';
    }
  };

  // מאזין לתגובה ב-Web
  React.useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token || response.authentication?.idToken;
      if (idToken) {
        const name = decodeNameFromIdToken(idToken);
        handleSuccessLogin(idToken, name);
      } else {
        setErr('לא התקבל id_token מגוגל');
        setLoading(false);
      }
    } else if (response?.type === 'error' || response?.type === 'cancel') {
      setLoading(false);
      if (response?.type === 'error') setErr('שגיאת התחברות בדפדפן');
    }
  }, [response]);

  async function handleSuccessLogin(idToken: string | undefined | null, userName: string) {
    try {
      if (!idToken) throw new Error('חסר id_token מגוגל');

      console.log('[GOOGLE] Calling backend googleLogin...');
      const res = await googleLogin(idToken, Platform.OS === 'web' ? 'web' : 'mobile');

      console.log('[GOOGLE] Setting session for:', userName);
      // שימוש ב-setSession המעודכן שכולל שם
      await setSession(res.accessToken, res.refreshToken, userName, Boolean(res.needsOnboarding));
      await setMeta('auth.mode', 'authed');
      await importGuestToServer();

      navigation.reset({
        index: 0,
        routes: [{ name: res.needsOnboarding ? 'CreateHousehold' : 'Tabs' }],
      });
    } catch (e: any) {
      setErr(e?.response?.data?.message || e?.message || 'שגיאה באימות מול השרת');
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    setErr(null);

    try {
      if (Platform.OS === 'web') {
        await promptAsync();
      } else {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const userInfo = await GoogleSignin.signIn();
        const tokens = await GoogleSignin.getTokens();

        // שליפת השם מה-userInfo של הנייטיב
        const name = userInfo.data?.user.name || 'משתמש גוגל';
        await handleSuccessLogin(tokens.idToken, name);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Failed');
      setLoading(false);
    }
  }

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>התחברות</Text>
      <Text style={{ opacity: 0.8 }}>כניסה עם Google</Text>

      {err ? <Text style={{ color: 'red', fontSize: 14 }}>{err}</Text> : null}

      <Pressable
        disabled={loading || (Platform.OS === 'web' && !request)}
        onPress={onGoogle}
        style={{
          padding: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#ddd',
          backgroundColor: loading ? '#f0f0f0' : 'white',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <Text style={{ textAlign: 'center', fontWeight: '600' }}>
          {loading ? 'מתחבר...' : 'הזדהות עם Google'}
        </Text>
      </Pressable>
    </View>
  );
}
