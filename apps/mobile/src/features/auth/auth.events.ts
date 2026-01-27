type Listener = () => void;

let listeners: Listener[] = [];

export function onAuthRequired(cb: Listener) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((x) => x !== cb);
  };
}

export function emitAuthRequired() {
  for (const cb of listeners) cb();
}
