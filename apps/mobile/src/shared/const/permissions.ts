import { Platform } from 'react-native';
import { PERMISSIONS, RESULTS, requestMultiple } from 'react-native-permissions';

export async function ensureBlePermissions(): Promise<{ ok: boolean; details?: any }> {
  if (Platform.OS === 'ios') {
    // iOS: אין runtime permissions כמו Android, אבל צריך להגדיר usage strings ב-Info.plist
    return { ok: true };
  }

  const perms =
    Number(Platform.Version) >= 31
      ? [
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]
      : [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];

  const res = await requestMultiple(perms);

  const ok = Object.values(res).every((v) => v === RESULTS.GRANTED);
  return { ok, details: res };
}
