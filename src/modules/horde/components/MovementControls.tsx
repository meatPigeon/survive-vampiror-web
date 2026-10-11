import type { HordeController } from '../game/controller';
export function MovementControls({ controller }: { controller: HordeController }) {
  return <div className="horde-dpad" aria-label="Horde direction controls">{['up', 'left', 'down', 'right'].map((dir, i) => <button key={dir} className={`horde-${dir}`} aria-label={`Move horde ${dir}`}
    onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); controller.input.holdTouch(e.pointerId, dir); }}
    onPointerUp={e => controller.input.releaseTouch(e.pointerId)}
    onPointerCancel={e => controller.input.releaseTouch(e.pointerId)}
    onLostPointerCapture={e => controller.input.releaseTouch(e.pointerId)}
    onKeyDown={e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); controller.input.holdTouch(-i - 1, dir); } }}
    onKeyUp={e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); controller.input.releaseTouch(-i - 1); } }}
    onBlur={() => controller.input.releaseTouch(-i - 1)}>{['↑', '←', '↓', '→'][i]}</button>)}</div>;
}
