const DEFAULT_API = 'http://localhost:3000/api';

export function getApiBase(): string {
  // אם יש לך ENV – תחליף פה, אבל בינתיים נשאיר קבוע
  return DEFAULT_API;
}

export function getWsBase(): string {
  // WS חייב להיות בלי /api
  return getApiBase().replace(/\/api\/?$/, '');
}
