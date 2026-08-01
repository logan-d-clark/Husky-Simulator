import { config, DEFAULTS, applyConfig, resetConfig, serializeConfig, type GameConfig } from '../config/gameConfig';

const KEYS = Object.keys(DEFAULTS) as (keyof GameConfig)[];

// A dev-only HTML overlay for live-tuning the runtime config. Sits above the
// Phaser canvas; toggled with the backtick key. Not part of the game render —
// plain DOM so every config field gets a real number input.
export class DevPanel {
  private root: HTMLDivElement;
  private inputs = new Map<keyof GameConfig, HTMLInputElement>();
  private open = false;

  constructor() {
    this.root = document.createElement('div');
    Object.assign(this.root.style, {
      position: 'fixed', top: '12px', right: '12px', zIndex: '9999',
      width: '290px', maxHeight: '92vh', overflowY: 'auto', boxSizing: 'border-box',
      background: 'rgba(36,31,27,0.96)', color: '#f2ede0',
      font: '12px monospace', padding: '10px', borderRadius: '10px',
      border: '1px solid rgba(242,237,224,0.2)', boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
    } as Partial<CSSStyleDeclaration>);
    this.build();
    document.body.appendChild(this.root);
    this.setOpen(false);
  }

  private build(): void {
    const title = document.createElement('div');
    title.textContent = 'DEV CONFIG  ( ` to toggle )';
    Object.assign(title.style, { fontWeight: 'bold', color: '#ffd27f', marginBottom: '8px' } as Partial<CSSStyleDeclaration>);
    this.root.appendChild(title);

    for (const key of KEYS) {
      const row = document.createElement('label');
      Object.assign(row.style, {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', margin: '2px 0',
      } as Partial<CSSStyleDeclaration>);
      const name = document.createElement('span');
      name.textContent = key;
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.value = String(config[key]);
      Object.assign(input.style, {
        width: '92px', background: '#1a1613', color: '#f2ede0',
        border: '1px solid #555', borderRadius: '4px', padding: '2px 4px',
      } as Partial<CSSStyleDeclaration>);
      input.addEventListener('change', () => {
        const v = parseFloat(input.value);
        if (!Number.isNaN(v)) applyConfig({ [key]: v } as Partial<GameConfig>);
      });
      this.inputs.set(key, input);
      row.append(name, input);
      this.root.appendChild(row);
    }

    const buttons = document.createElement('div');
    Object.assign(buttons.style, { display: 'flex', gap: '6px', marginTop: '10px' } as Partial<CSSStyleDeclaration>);
    buttons.append(
      this.button('Reset', () => { resetConfig(); this.syncInputs(); }),
      this.button('Save .txt', () => this.save()),
    );
    this.root.appendChild(buttons);
  }

  private button(label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
      flex: '1', cursor: 'pointer', background: '#8fd98f', color: '#26301f',
      border: 'none', borderRadius: '6px', padding: '6px', fontWeight: 'bold',
    } as Partial<CSSStyleDeclaration>);
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
