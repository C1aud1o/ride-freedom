// Campi numerici in stile vetro con pulsanti − / + (niente frecce di sistema: si usano bene anche col pollice).
function enhance(input) {
  if (input.dataset.glass) return;
  input.dataset.glass = '1';
  let box = input.closest('.unit-input');
  if (!box) { box = document.createElement('span'); box.className = 'unit-input'; input.replaceWith(box); box.append(input); }
  box.classList.add('stepper');
  const mk = (dir, text) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'step-btn'; b.textContent = text;
    b.setAttribute('aria-label', dir > 0 ? 'Aumenta' : 'Diminuisci');
    let rep = null;
    const go = () => {
      if (input.disabled) return;
      if (input.value === '') { input.value = input.dataset.start || input.min || 0; input.dispatchEvent(new Event('input', { bubbles: true })); return; }
      try { if (dir > 0) input.stepUp(); else input.stepDown(); } catch { input.value = (+input.value || 0) + dir * (+input.step || 1); }
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    // tenendo premuto continua a contare
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); go(); rep = setTimeout(function loop() { go(); rep = setTimeout(loop, 70); }, 420); });
    const stop = () => { if (rep !== null) { clearTimeout(rep); rep = null; input.dispatchEvent(new Event('change', { bubbles: true })); } };
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    return b;
  };
  box.prepend(mk(-1, '−'));
  box.append(mk(+1, '+'));
}
export function enhanceInputs(root = document) { root.querySelectorAll('input[type=number]').forEach(enhance); }
enhanceInputs();
new MutationObserver(() => enhanceInputs()).observe(document.body, { childList: true, subtree: true });
