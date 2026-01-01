import { Injectable } from '@nestjs/common';

export type TelemetryPoint = {
  boxId: string;
  quantity: number;
  percent: number;
  state: 'OK' | 'LOW' | 'EMPTY';
  timestamp: string;
};

@Injectable()
export class TelemetryStore {
  constructor() {
    console.log('[TelemetryStore] instance', Math.random().toString(16).slice(2));
  }
  private byBox = new Map<string, TelemetryPoint[]>();

  append(p: TelemetryPoint) {
    const arr = this.byBox.get(p.boxId) ?? [];
    arr.push(p);
    if (arr.length > 5000) arr.splice(0, arr.length - 5000);
    this.byBox.set(p.boxId, arr);
  }

  list(boxId: string, sinceIso?: string) {
    const arr = this.byBox.get(boxId) ?? [];
    if (!sinceIso) return arr;

    const since = new Date(sinceIso).getTime();
    return arr.filter((x) => new Date(x.timestamp).getTime() >= since);
  }

  deleteBox(boxId: string) {
    this.byBox.delete(boxId);
  }
}
