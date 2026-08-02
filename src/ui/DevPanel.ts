import Phaser from 'phaser';
import {
  config, DEFAULTS, INIT_ONLY_KEYS, applyConfig, resetConfig, serializeConfig, type GameConfig,
} from '../config/gameConfig';

const KEYS = Object.keys(DEFAULTS) as (keyof GameConfig)[];

function applyStyle(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}

// A dev-only HTML overlay for live-tuning the runtime config. Sits above the
// Phaser canvas; toggled with the backtick key. Plain DOM (no Phaser) so every
// config field gets a real number input. Attach it to a scene via
// attachDevPanel() below.
export class DevPanel {
  private root: HTMLDivElement;
  private inputs = new Map<keyof GameConfig, HTMLInputElement>();
  private open = false;

  constructor() {
    this.root = document.createElement('div');
    // Docked to the window's left edge so it sits in the left letterbox strip
    // beside the map. Visible by default in dev mode; backtick toggles it.
    applyStyle(this.root, {
      position: 'fixed', top: '8px', left: '6px', zIndex: '9999',
      width: '208px', maxHeight: '96vh', overflowY: 'auto', boxSizing: 'border-box',
      background: 'rgba(36,31,27,0.96)', color: '#f2ede0',
      font: '11px monospace', padding: '8px', borderRadius: '10px',
      border: '1px solid rgba(242,237,224,0.2)', boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
    });
    this.build();
    document.body.appendChild(this.root);
    this.setOpen(true);
  }

  private build(): void {
    const title = document.createElement('div');
    title.textContent = 'DEV CONFIG  ( ` to toggle )';
    applyStyle(title, { fontWeight: 'bold', color: '#ffd27f', marginBottom: '6px' });
    const legend = document.createElement('div');
    legend.textContent = '↻ = applies on next game start';
    applyStyle(legend, { color: '#b7a482', marginBottom: '8px', fontSize: '11px' });
    this.root.append(title, legend);

    for (const key of KEYS) this.root.appendChild(this.buildRow(key));

    const buttons = document.createElement('div');
    applyStyle(buttons, { display: 'flex', gap: '6px', marginTop: '10px' });
    buttons.append(
      this.button('Reset', () => { resetConfig(); this.syncInputs(); }),
      this.button('Save .txt', () => this.save()),
    );
    this.root.appendChild(buttons);
  }

  private buildRow(key: keyof GameConfig): HTMLLabelElement {
    const initOnly = INIT_ONLY_KEYS.has(key);
    const row = document.createElement('label');
    applyStyle(row, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', margin: '2px 0' });
    const name = document.createElement('span');
    name.textContent = initOnly ? `${key} ↻` : key;
    if (initOnly) { name.title = 'Applies on next game start'; applyStyle(name, { color: '#b7a482' }); }
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = String(config[key]);
    applyStyle(input, {
      width: '58px', background: '#1a1613', color: '#f2ede0',
      border: '1px solid #555', borderRadius: '4px', padding: '2px 3px',
    });
    input.addEventListener('change', () => {
      const v = parseFloat(input.value);
      if (!Number.isNaN(v)) applyConfig({ [key]: v } as Partial<GameConfig>);
    });
    this.inputs.set(key, input);
    row.append(name, input);
    return row;
  }

  private button(label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    applyStyle(b, {
      flex: '1', cursor: 'pointer', background: '#8fd98f', color: '#26301f',
      border: 'none', borderRadius: '6px', padding: '6px', fontWeight: 'bold',
    });
    b.addEventListener('click', fn);
    return b;
  }

  private syncInputs(): void {
    for (const [key, input] of this.inputs) input.value = String(config[key]);
  }

  private save(): void {
    const blob = new Blob([serializeConfig()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'husky-config.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  toggle(): void { this.setOpen(!this.open); }

  setOpen(v: boolean): void {
    this.open = v;
    this.root.style.display = v ? 'block' : 'none';
  }

  destroy(): void { this.root.remove(); }
}

// Wire a dev panel to a scene: create it, toggle on backtick, tear it down when
// the scene shuts down. Keeps the Phaser lifecycle glue out of the scene body.
export function attachDevPanel(scene: Phaser.Scene): DevPanel {
  const panel = new DevPanel();
  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK)
    .on('down', () => panel.toggle());
  scene.events.once('shutdown', () => panel.destroy());
  return panel;
}
