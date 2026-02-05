import { sqlAll, sqlRun } from '../../../shared/db/sqlite';

export type OutboxOp =
  | 'LIST_CREATE'
  | 'LIST_RENAME'
  | 'LIST_DELETE'
  | 'ITEM_ADD'
  | 'ITEM_UPDATE'
  | 'ITEM_DELETE';

export type OutboxRow = {
  id: number;
  createdAt: number;
  op: OutboxOp;
  payload: any;
  status: 'PENDING' | 'DONE' | 'FAILED';
  lastError: string | null;
  tries: number;
  nextAttemptAt: number | null;
};

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function backoffMs(tries: number) {
  const t = Math.max(0, Number(tries || 0));
  return Math.min(5 * 60_000, 1000 * Math.pow(2, t));
}

export async function outboxEnqueue(op: OutboxOp, payload: any) {
  const now = Date.now();
  await sqlRun(
    `INSERT INTO outbox(created_at, op, payload_json, status, last_error, tries, next_attempt_at)
   VALUES(?,?,?,?,?,?,?);`,
    [now, op, JSON.stringify(payload ?? {}), 'PENDING', null, 0, null],
  );
}

export async function outboxPeekPending(limit = 50): Promise<OutboxRow[]> {
  const now = Date.now();
  const rows = await sqlAll<any>(
    `SELECT id, created_at, op, payload_json, status, last_error, tries, next_attempt_at
     FROM outbox
     WHERE status='PENDING'
       AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
     ORDER BY id ASC
     LIMIT ?;`,
    [now, limit],
  );

  return rows.map((r) => ({
    id: Number(r.id),
    createdAt: Number(r.created_at),
    op: String(r.op) as OutboxOp,
    payload: safeParse(String(r.payload_json)),
    status: String(r.status) as any,
    lastError: r.last_error ? String(r.last_error) : null,
    tries: Number(r.tries ?? 0),
    nextAttemptAt: r.next_attempt_at == null ? null : Number(r.next_attempt_at),
  }));
}

export async function outboxMarkDone(id: number) {
  await sqlRun(
    `UPDATE outbox
     SET status='DONE', last_error=NULL, next_attempt_at=NULL
     WHERE id=?;`,
    [id],
  );
}

// נשאר לשימוש כללי, אבל לא "final"
export async function outboxMarkFailed(id: number, err: string) {
  await sqlRun(
    `UPDATE outbox
     SET status='FAILED', last_error=?, next_attempt_at=NULL
     WHERE id=?;`,
    [err, id],
  );
}

export async function outboxMarkFailedFinal(id: number, err: string) {
  // זהה ל-Failed, אבל השם תואם לסינק שלך
  await outboxMarkFailed(id, err);
}

export async function outboxDefer(id: number, err: string, tries: number) {
  const nextTries = Math.min(20, Number(tries ?? 0) + 1);
  const nextAttemptAt = Date.now() + backoffMs(nextTries);

  await sqlRun(
    `UPDATE outbox
     SET status='PENDING', last_error=?, tries=?, next_attempt_at=?
     WHERE id=?;`,
    [err, nextTries, nextAttemptAt, id],
  );
}

export async function outboxResetFailedToPending() {
  await sqlRun(
    `UPDATE outbox
     SET status='PENDING', next_attempt_at=NULL
     WHERE status='FAILED';`,
    [],
  );
}

export async function outboxClearDone() {
  await sqlRun(`DELETE FROM outbox WHERE status='DONE';`, []);
}
