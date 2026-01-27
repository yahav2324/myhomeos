import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS = 'auth.accessToken';
const REFRESH = 'auth.refreshToken';

export async function saveTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    [ACCESS, accessToken],
    [REFRESH, refreshToken],
  ]);
}

export async function getTokens() {
  const pairs = await AsyncStorage.multiGet([ACCESS, REFRESH]);
  const map = Object.fromEntries(pairs);
  return {
    accessToken: map[ACCESS] ?? null,
    refreshToken: map[REFRESH] ?? null,
  };
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS, REFRESH]);
}
