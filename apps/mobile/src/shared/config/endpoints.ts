const DEFAULT_API = 'https://api.myhomeos.app/api';

export function getApiBase(): string {
  return DEFAULT_API;
}

export function getWsBase(): string {
  // נחלץ את הבסיס (בלי ה-/api) ונחליף את ה-https ב-wss
  // התוצאה תהיה: wss://api.myhomeos.app
  return getApiBase()
    .replace(/\/api\/?$/, '')
    .replace(/^http/, 'ws');
}
