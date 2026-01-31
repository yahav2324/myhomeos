import { Platform } from 'react-native';

type EnsureRes = { ok: boolean; details?: any };

export async function ensureBlePermissions(): Promise<EnsureRes> {
  if (Platform.OS === 'web') {
    // Web: אין את react-native-permissions. Web Bluetooth מבקש הרשאות דרך הדפדפן.
    return { ok: true, details: { platform: 'web' } };
  }

  if (Platform.OS === 'ios') {
    return { ok: true };
  }

  const { PERMISSIONS, RESULTS, requestMultiple } = require('react-native-permissions');

  const perms =
    Number(Platform.Version) >= 31
      ? [
          PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
          PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
          PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ]
      : [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];

  const res = await requestMultiple(perms);
  const ok = Object.values(res).every((v: any) => v === RESULTS.GRANTED);

  return { ok, details: res };
}
