// Pagina di debug: una scheda per ogni sensore con stato, servizi, dati, log copiabili.
import { uuidName } from './debug.js';
import { RIDE_ON, buttonLabel } from './click.js';

const el = (tag, attrs = {}, ...children) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  e.append(...children);
  return e;
};

export async function copyText(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch { /* niente */ }
    ta.remove();
  }
  if (btn) {
    const old = btn.textContent;
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    setTimeout(() => { btn.textContent = old; }, 1500);
  }
}

export function setupDebug({ trainer, click, hrm, extra = [], appLog }) {
  const panel = document.getElementById('debugPanel');
  const cards = document.getElementById('debugCards');
  const sensors = [trainer, click, hrm, ...extra];
  const views = sensors.map((s) => buildCard(s, s === click ? click : null));
  cards.append(...views.map((v) => v.root));

  let scheduled = false;
  const refresh = () => {
    if (scheduled || panel.hidden) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; views.forEach((v) => v.update()); });
  };
  sensors.forEach((s) => s.dbg.addEventListener('change', refresh));

  document.getElementById('openDebug').addEventListener('click', () => { panel.hidden = false; document.body.classList.add('debug-open'); refresh(); });
  document.getElementById('closeDebug').addEventListener('click', () => { panel.hidden = true; document.body.classList.remove('debug-open'); });
  document.getElementById('copyAll').addEventListener('click', (e) => {
    const env = [
      `Spindro – debug report ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      `Web Bluetooth: ${'bluetooth' in navigator ? 'yes' : 'no'}`,
    ];
    copyText([...env, '', ...sensors.map((s) => s.dbg.report()), '', '=== App ===', appLog()].join('\n\n'), e.target);
  });
}

function buildCard(sensor, click) {
  const d = sensor.dbg;
  const status = el('span', { class: 'chip' });
  const device = el('div', { class: 'dbg-device' });
  const services = el('pre', { class: 'dbg-pre small' });
  const values = el('dl', { class: 'dbg-values' });
  const raw = el('pre', { class: 'dbg-pre small' });
  const logPre = el('pre', { class: 'dbg-pre log' });
  const copyBtn = el('button', { onclick: (e) => copyText(d.report(), e.target) }, 'Copy log');
  const clearBtn = el('button', { onclick: () => d.clear() }, 'Clear');

  const root = el('section', { class: 'dbg-card' },
    el('header', {}, el('h3', {}, d.title), status),
    device);

  let clickView = null;
  if (click) clickView = buildClickView(click);
  if (clickView) root.append(clickView.root);

  root.append(
    el('h4', {}, 'Values'), values,
    el('h4', {}, 'Latest packets received'), raw,
    el('details', {}, el('summary', {}, 'Services and characteristics'), services),
    el('h4', {}, 'Log'), logPre,
    el('div', { class: 'dbg-actions' }, copyBtn, clearBtn),
  );

  let lastLines = -1;
  const update = () => {
    status.textContent = d.status;
    status.classList.toggle('ok', d.status.startsWith('Connected'));
    device.textContent = d.device ? `${d.device.name} · id ${d.device.id}` : 'No device';

    services.textContent = d.services.length
      ? d.services.map((s) => `${uuidName(s.uuid)}\n${s.chars.map((c) => `  • ${uuidName(c.uuid)} [${c.props.join(', ')}]`).join('\n')}`).join('\n')
      : '—';

    const entries = Object.entries({ ...d.values, ...flatten(d.extra) });
    values.replaceChildren(...entries.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v))]));
    if (!entries.length) values.append(el('dd', {}, '—'));

    const now = Date.now();
    raw.textContent = Object.entries(d.lastRaw).map(([k, v]) => `${k} ×${d.counts[k]} (${((now - v.at) / 1000).toFixed(1)}s ago)\n  ${v.hex}`).join('\n') || '—';

    if (d.lines.length !== lastLines || d.lines.length === 500) {
      const atBottom = logPre.scrollTop + logPre.clientHeight >= logPre.scrollHeight - 20;
      logPre.textContent = d.lines.slice(-200).join('\n') || '—';
      if (atBottom) logPre.scrollTop = logPre.scrollHeight;
      lastLines = d.lines.length;
    }
    clickView?.update();
  };
  update();
  return { root, update };
}

function buildClickView(click) {
  const d = click.dbg;
  const plus = el('div', { class: 'btn-ind' }, '+');
  const minus = el('div', { class: 'btn-ind' }, '−');
  const pressedList = el('div', { class: 'dbg-chips' });
  const last = el('div', { class: 'dbg-last' });
  const hexInput = el('input', { type: 'text', placeholder: 'es. 52 69 64 65 4f 6e', class: 'dbg-hex', autocapitalize: 'off', spellcheck: 'false' });

  const assignRow = el('div', { class: 'dbg-actions' },
    el('button', { onclick: () => d.extra.lastPressed && (click.assign(d.extra.lastPressed, +1), view.update()) }, 'Use as +'),
    el('button', { onclick: () => d.extra.lastPressed && (click.assign(d.extra.lastPressed, -1), view.update()) }, 'Use as −'),
    el('button', { onclick: () => d.extra.lastPressed && (click.assign(d.extra.lastPressed, 0), view.update()) }, 'No action'),
    el('button', { onclick: () => { click.resetMap(); view.update(); } }, 'Reset'),
  );
  const send = async (bytes) => { try { await click.write(bytes); } catch (err) { d.log(`Send error: ${err.message}`); } };
  const writeRow = el('div', { class: 'dbg-actions' },
    el('button', { onclick: () => send(RIDE_ON) }, 'Resend RideOn'),
    hexInput,
    el('button', { onclick: () => {
      const bytes = hexInput.value.trim().split(/[\s,]+/).filter(Boolean).map((h) => parseInt(h, 16));
      if (!bytes.length || bytes.some((b) => Number.isNaN(b) || b < 0 || b > 255)) { d.log('Invalid hex'); return; }
      send(bytes);
    } }, 'Send'),
  );

  const root = el('div', { class: 'dbg-click' },
    el('p', { class: 'hint' }, 'Press the Click buttons: the matching circle should light up. If nothing happens, check "Latest packets received" and the log.'),
    el('div', { class: 'btn-row' }, minus, plus),
    el('h4', {}, 'Buttons pressed now'), pressedList,
    last, assignRow,
    el('details', {}, el('summary', {}, 'Manual send (advanced)'), writeRow),
  );

  const view = {
    root,
    update() {
      const pressed = d.extra.pressed || [];
      const dirs = pressed.map((id) => click.map[id]);
      plus.classList.toggle('on', dirs.includes(1));
      minus.classList.toggle('on', dirs.includes(-1));
      pressedList.replaceChildren(...(pressed.length ? pressed.map((id) => el('span', { class: 'chip ok' }, buttonLabel(id))) : [el('span', { class: 'chip' }, 'nessuno')]));
      const lp = d.extra.lastPressed;
      last.textContent = lp
        ? `Last button: ${buttonLabel(lp)} → ${click.map[lp] > 0 ? 'shifts +' : click.map[lp] < 0 ? 'shifts −' : 'no action'}`
        : 'Last button: none detected';
    },
  };
  return view;
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v == null) continue;
    if (Array.isArray(v)) out[prefix + k] = v.join(', ') || '—';
    else if (typeof v === 'object') Object.assign(out, flatten(v, `${prefix}${k}.`));
    else out[prefix + k] = v;
  }
  return out;
}
