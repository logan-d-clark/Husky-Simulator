import Phaser from 'phaser';
import {
  config,
  DEFAULTS,
  INIT_ONLY_KEYS,
  applyConfig,
  resetConfig,
  serializeConfig,
  parseConfig,
  type GameConfig,
} from '../config/gameConfig';
import { banditSettings, resetBanditSettings } from '../config/banditMode';
import { ITEMS, ITEM_TYPES, type ItemType } from '../entities/Item';

export interface DevPanelOpts {
  onRestart?: () => void;
  /** Hand Blizzard one of an item, so its behaviour can be exercised without
   *  waiting on a random drop or a 1000-food milestone. */
  onGrantItem?: (type: ItemType) => void;
}

const KEYS = Object.keys(DEFAULTS) as (keyof GameConfig)[];
const PROFILES_KEY = 'husky-dev-profiles';

function applyStyle(el: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(el.style, styles);
}

function loadProfiles(): Record<string, Partial<GameConfig>> {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function saveProfiles(p: Record<string, Partial<GameConfig>>): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

// A dev-only HTML overlay for live-tuning the runtime config. Sits above the
// Phaser canvas; toggled with the backtick key. Plain DOM (no Phaser) so every
// config field gets a real number input. Attach it to a scene via
// attachDevPanel() below.
export class DevPanel {
  private root: HTMLDivElement;
  private inputs = new Map<keyof GameConfig, HTMLInputElement>();
  private profileSelect!: HTMLSelectElement;
  private banditToggle!: HTMLInputElement;
  private open = false;

  constructor(private opts: DevPanelOpts = {}) {
    this.root = document.createElement('div');
    // Docked to the window's left edge so it sits in the left letterbox strip
    // beside the map. Visible by default in dev mode; backtick toggles it.
    applyStyle(this.root, {
      position: 'fixed',
      top: '8px',
      left: '6px',
      zIndex: '9999',
      width: '208px',
      maxHeight: '96vh',
      overflowY: 'auto',
      boxSizing: 'border-box',
      background: 'rgba(36,31,27,0.96)',
      color: '#f2ede0',
      font: '11px monospace',
      padding: '8px',
      borderRadius: '10px',
      border: '1px solid rgba(242,237,224,0.2)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
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

    const resets = this.buttonRow(
      this.button('Reset to Defaults', () => {
        resetConfig();
        resetBanditSettings();
        this.syncInputs();
      }),
      this.button('Restart Game', () => this.opts.onRestart?.()),
    );
    const files = this.buttonRow(
      this.button('Import .txt', () => this.importFile()),
      this.button('Save .txt', () => this.save()),
    );
    this.root.append(resets, files, this.buildItemGrants(), this.buildBanditToggle(), this.buildProfiles());
  }

  // Grant-an-item buttons. Built from ITEM_TYPES — the same table that drives
  // the number keys, the HUD belt and the tutorial — so a fifth item would show
  // up here on its own. Each routes through the production grant path, tutorial
  // included, rather than poking the count directly: a shortcut here would mean
  // the panel exercised something the real game never does.
  private buildItemGrants(): HTMLDivElement {
    const wrap = document.createElement('div');
    applyStyle(wrap, { marginTop: '10px', borderTop: '1px solid #4a423a', paddingTop: '8px' });
    const label = document.createElement('div');
    label.textContent = 'GRANT ITEM';
    applyStyle(label, { color: '#ffd27f', fontWeight: 'bold', marginBottom: '4px' });
    wrap.append(label);
    // Two per row so the labels stay legible in the narrow panel.
    for (let i = 0; i < ITEM_TYPES.length; i += 2) {
      wrap.append(
        this.buttonRow(
          ...ITEM_TYPES.slice(i, i + 2).map((type) =>
            this.button(`${ITEMS[type].key}  ${ITEMS[type].name}`, () => this.opts.onGrantItem?.(type)),
          ),
        ),
      );
    }
    return wrap;
  }

  // A live toggle for Bandit's AI mode. Its own labelled section (not folded
  // into the numeric per-key loop) since it's a behaviour switch, not a tunable;
  // a native checkbox gives keyboard operability for free. Read live by the AI.
  private buildBanditToggle(): HTMLDivElement {
    const wrap = document.createElement('div');
    applyStyle(wrap, { marginTop: '10px', borderTop: '1px solid #4a423a', paddingTop: '8px' });
    const label = document.createElement('div');
    label.textContent = 'BANDIT AI';
    applyStyle(label, { color: '#ffd27f', fontWeight: 'bold', marginBottom: '4px' });
    const row = document.createElement('label');
    applyStyle(row, { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' });
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = banditSettings.omniscient;
    cb.addEventListener('change', () => {
      banditSettings.omniscient = cb.checked;
    });
    const txt = document.createElement('span');
    txt.textContent = 'Omniscient (always finds the best food)';
    this.banditToggle = cb;
    row.append(cb, txt);
    wrap.append(label, row);
    return wrap;
  }

  private buttonRow(...children: HTMLElement[]): HTMLDivElement {
    const row = document.createElement('div');
    applyStyle(row, { display: 'flex', gap: '6px', marginTop: '8px' });
    row.append(...children);
    return row;
  }

  // Save/load named config profiles (persisted to localStorage) so several
  // tuning setups can be kept and swapped between for comparison.
  private buildProfiles(): HTMLDivElement {
    const wrap = document.createElement('div');
    applyStyle(wrap, { marginTop: '10px', borderTop: '1px solid #4a423a', paddingTop: '8px' });
    const label = document.createElement('div');
    label.textContent = 'PROFILES';
    applyStyle(label, { color: '#ffd27f', fontWeight: 'bold', marginBottom: '4px' });

    this.profileSelect = document.createElement('select');
    applyStyle(this.profileSelect, {
      width: '100%',
      background: '#1a1613',
      color: '#f2ede0',
      border: '1px solid #555',
      borderRadius: '4px',
      padding: '3px',
      marginBottom: '6px',
    });
    this.profileSelect.addEventListener('change', () => {
      const name = this.profileSelect.value;
      if (!name) return;
      const prof = loadProfiles()[name];
      if (prof) {
        applyConfig(prof);
        this.syncInputs();
      }
    });
    this.refreshProfiles();

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'profile name';
    applyStyle(nameInput, {
      flex: '1',
      minWidth: '0',
      background: '#1a1613',
      color: '#f2ede0',
      border: '1px solid #555',
      borderRadius: '4px',
      padding: '3px',
    });
    const saveBtn = this.button('Save', () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const profiles = loadProfiles();
      profiles[name] = { ...config };
      saveProfiles(profiles);
      nameInput.value = '';
      this.refreshProfiles(name);
    });
    const row = document.createElement('div');
    applyStyle(row, { display: 'flex', gap: '6px' });
    row.append(nameInput, saveBtn);

    wrap.append(label, this.profileSelect, row);
    return wrap;
  }

  private refreshProfiles(selected = ''): void {
    const names = Object.keys(loadProfiles());
    this.profileSelect.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = names.length ? '— load profile —' : '(no profiles yet)';
    this.profileSelect.append(ph);
    for (const n of names) {
      const o = document.createElement('option');
      o.value = n;
      o.textContent = n;
      this.profileSelect.append(o);
    }
    this.profileSelect.value = selected;
  }

  private importFile(): void {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.txt,text/plain';
    picker.addEventListener('change', () => {
      const file = picker.files?.[0];
      if (!file) return;
      file.text().then((text) => {
        applyConfig(parseConfig(text));
        this.syncInputs();
      });
    });
    picker.click();
  }

  private buildRow(key: keyof GameConfig): HTMLLabelElement {
    const initOnly = INIT_ONLY_KEYS.has(key);
    const row = document.createElement('label');
    applyStyle(row, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '8px',
      margin: '2px 0',
    });
    const name = document.createElement('span');
    name.textContent = initOnly ? `${key} ↻` : key;
    if (initOnly) {
      name.title = 'Applies on next game start';
      applyStyle(name, { color: '#b7a482' });
    }
    const input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
    input.value = String(config[key]);
    applyStyle(input, {
      width: '58px',
      background: '#1a1613',
      color: '#f2ede0',
      border: '1px solid #555',
      borderRadius: '4px',
      padding: '2px 3px',
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
      flex: '1',
      cursor: 'pointer',
      background: '#8fd98f',
      color: '#26301f',
      border: 'none',
      borderRadius: '6px',
      padding: '6px',
      fontWeight: 'bold',
    });
    b.addEventListener('click', fn);
    return b;
  }

  private syncInputs(): void {
    for (const [key, input] of this.inputs) input.value = String(config[key]);
    if (this.banditToggle) this.banditToggle.checked = banditSettings.omniscient;
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

  toggle(): void {
    this.setOpen(!this.open);
  }

  setOpen(v: boolean): void {
    this.open = v;
    this.root.style.display = v ? 'block' : 'none';
  }

  destroy(): void {
    this.root.remove();
  }
}

// Wire a dev panel to a scene: create it, toggle on backtick, tear it down when
// the scene shuts down. Keeps the Phaser lifecycle glue out of the scene body.
export function attachDevPanel(scene: Phaser.Scene, opts: DevPanelOpts = {}): DevPanel {
  const panel = new DevPanel(opts);
  scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK).on('down', () => panel.toggle());
  scene.events.once('shutdown', () => panel.destroy());
  return panel;
}
