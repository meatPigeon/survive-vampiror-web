export const DEFAULT_BINDINGS = {
  up: 'KeyW', left: 'KeyA', down: 'KeyS', right: 'KeyD',
  ability1: 'KeyQ', ability2: 'KeyE', sprint: 'Space', stop: 'KeyX', restart: 'KeyR', pause: 'KeyP',
} as const;
export type ControlAction = keyof typeof DEFAULT_BINDINGS;
export type Bindings = Record<ControlAction, string>;
export const CONTROL_NAMES: Record<ControlAction, string> = {
  up: 'Move up', left: 'Move left', down: 'Move down', right: 'Move right',
  ability1: 'First ability', ability2: 'Second ability', sprint: 'Sprint', stop: 'Stop moving', restart: 'New march', pause: 'Pause',
};
export const controlKey = (code: string) => code.replace(/^Key|^Digit/, '').replace('Arrow', '').replace('Space', 'Space');
export const allowedKey = (code: string) => /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space)$/.test(code);
export function rebind(bindings: Bindings, action: ControlAction, code: string): Bindings {
  if (!allowedKey(code)) return bindings;
  const next = { ...bindings }, other = (Object.keys(next) as ControlAction[]).find(key => next[key] === code);
  if (other) next[other] = next[action];
  next[action] = code; return next;
}
