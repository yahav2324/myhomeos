import { Platform } from 'react-native';

export type BleApi = {
  isSupported: boolean;
  // פה אפשר להרחיב בעתיד: scan/connect וכו'
};

export function getBleApi(): BleApi {
  if (Platform.OS === 'web') {
    return { isSupported: false };
  }
  return { isSupported: true };
}
