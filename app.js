const storageKey = 'somnia.settings.v1';
const defaults = {
  retention: '14',
  style: 'abstract',
  saving: 'ask',
  gesture: 'left',
  actions: { left: 'next', up: 'volume-up', right: 'previous', down: 'volume-down', tap: 'play' },
};
const state = structuredClone(defaults);
const groups = Object.fromEntries([...document.querySelectorAll('[data-choice]')].map(group => [group.dataset.choice, group]));
const actionValues = [...groups.action.querySelectorAll('[data-value]')].map(button => button.dataset.value);

const powerButton = document.querySelector('.home-power-status');
const powerStorageKey = 'somnia.device-power.v1';
let devicePowered = true;
try { devicePowered = localStorage.getItem(powerStorageKey) !== 'off'; }
catch { /* Power still works when browser storage is unavailable. */ }

function renderDevicePower() {
  document.documentElement.dataset.devicePower = devicePowered ? 'on' : 'off';
  powerButton.querySelector('.home-power-label').textContent = devicePowered ? 'выкл.' : 'вкл.';
  powerButton.setAttribute('aria-label', devicePowered ? 'Выключить сферу устройства' : 'Включить сферу устройства');
  powerButton.title = devicePowered ? 'Выключить сферу устройства' : 'Включить сферу устройства';
  document.dispatchEvent(new CustomEvent('somnia:device-power', { detail: { powered: devicePowered } }));
}
powerButton.addEventListener('click', () => {
  devicePowered = !devicePowered;
  renderDevicePower();
  try { localStorage.setItem(powerStorageKey, devicePowered ? 'on' : 'off'); }
  catch { /* Keep the chosen state for the current session. */ }
  document.querySelector('#announcement').textContent = devicePowered ? 'Сфера устройства включена' : 'Сфера устройства выключена';
});
renderDevicePower();

try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') {
    for (const key of ['retention', 'style', 'saving', 'gesture']) {
      const valid = [...groups[key].querySelectorAll('[data-value]')].some(button => button.dataset.value === saved[key]);
      if (valid) state[key] = saved[key];
    }
    for (const gesture of Object.keys(defaults.actions)) {
      if (actionValues.includes(saved.actions?.[gesture])) state.actions[gesture] = saved.actions[gesture];
    }
  }
} catch { /* The page also works when browser storage is unavailable. */ }

const descriptions = {
  ask: 'в этом режиме устройство при вашем пробуждении спросит вас хотите ли вы сохранить сон',
  all: 'в этом режиме устройство автоматически сохраняет все сны после вашего пробуждения',
  pleasant: 'в этом режиме устройство сохраняет только приятные сны после вашего пробуждения',
};

// One white surface travels beneath each segmented control's fixed labels.
function createTabMotion(group) {
  const pill = document.createElement('span');
  pill.className = 'segmented-selection';
  pill.setAttribute('aria-hidden', 'true');
  group.append(pill);
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let animation = null;
  let selectedValue = null;
  let destination = 0;
  let width = 0;

  function move(animate = true) {
    const selected = group.querySelector('[aria-pressed="true"]');
    if (!selected || !group.clientWidth) return;
    const groupRect = group.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const next = selectedRect.left - groupRect.left;
    const nextWidth = selectedRect.width;
    if (animate && selectedValue === selected.dataset.value && destination === next && width === nextWidth) return;
    const transform = getComputedStyle(pill).transform;
    const from = transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(transform);
    const shouldAnimate = animate && selectedValue !== null && !document.hidden
      && !preference.matches && document.documentElement.dataset.previewMotion !== 'off';
    animation?.cancel();
    animation = null;
    delete pill.dataset.moving;
    selectedValue = selected.dataset.value;
    destination = next;
    width = nextWidth;
    pill.style.width = `${width}px`;
    pill.style.transform = `translateX(${next}px)`;
    group.dataset.motionReady = 'true';
    if (!shouldAnimate) return;

    const spring = t => 1 - Math.exp(-8.5 * t) * (Math.cos(8 * t) + 8.5 / 8 * Math.sin(8 * t));
    const frames = Array.from({ length: 61 }, (_, index) => {
      const t = index / 60;
      const progress = spring(t) / spring(1);
      const x = from.m41 + (next - from.m41) * progress;
      return { offset: t, transform: `translateX(${x}px)` };
    });
    const running = pill.animate(frames, { duration: 540, easing: 'linear' });
    animation = running;
    pill.dataset.moving = 'true';
    running.finished.then(() => {
      if (animation !== running) return;
      animation = null;
      delete pill.dataset.moving;
    }).catch(() => {});
  }
  const settle = () => move(false);
  new ResizeObserver(settle).observe(group);
  document.addEventListener('somnia:motion-change', settle);
  document.addEventListener('somnia:navigate', settle);
  document.addEventListener('visibilitychange', () => { if (document.hidden) settle(); });
  preference.addEventListener('change', settle);
  return { move };
}
const tabMotions = new Map([...document.querySelectorAll('.segmented')].map(group => [group, createTabMotion(group)]));

function render(changedKey = null) {
  for (const [key, group] of Object.entries(groups)) {
    if (changedKey && key !== changedKey && !(changedKey === 'gesture' && key === 'action')) continue;
    const value = key === 'action' ? state.actions[state.gesture] : state[key];
    for (const button of group.querySelectorAll('[data-value]')) {
      const pressed = String(button.dataset.value === value);
      if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    }
    tabMotions.get(group)?.move();
  }
  if (!changedKey || changedKey === 'saving') document.querySelector('#saving-description').textContent = descriptions[state.saving];
  document.dispatchEvent(new CustomEvent('somnia:settings-change', { detail: structuredClone(state) }));
}

for (const [key, group] of Object.entries(groups)) {
  group.addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    if (button.getAttribute('aria-pressed') === 'true') {
      if (key === 'action') document.dispatchEvent(new Event('somnia:gesture-replay'));
      return;
    }
    if (key === 'action') state.actions[state.gesture] = button.dataset.value;
    else state[key] = button.dataset.value;
    render(key);
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      document.querySelector('#announcement').textContent = 'Настройки сохранены в этом браузере';
    } catch {
      document.querySelector('#announcement').textContent = 'Настройки изменены на время текущего сеанса';
    }
  });
  group.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const horizontal = ['ArrowLeft', 'ArrowRight'].includes(event.key);
    if (!horizontal && !['Home', 'End'].includes(event.key)) return;
    const buttons = [...group.querySelectorAll('button[data-value]')];
    const index = buttons.indexOf(document.activeElement);
    if (index === -1) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].focus({ preventScroll: true });
    if (key === 'gesture') buttons[next].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    buttons[next].click();
  });
}

const helpText = {
  retention: 'Выберите, сколько дней хранить записи снов: 7, 14 или 30.',
  style: 'Натуральный стиль сохраняет реалистичные образы сна, абстрактный — передаёт его настроение.',
  saving: 'Сохраняйте все сны, только приятные или подтверждайте сохранение после пробуждения.',
};
const popover = document.querySelector('#help-popover');
let activeHelp = null;

function closeHelp() {
  if (activeHelp) {
    activeHelp.setAttribute('aria-expanded', 'false');
    activeHelp.removeAttribute('aria-describedby');
  }
  popover.hidden = true;
  activeHelp = null;
}

document.querySelectorAll('[data-help]').forEach(button => {
  button.addEventListener('click', () => {
    const wasOpen = activeHelp === button;
    closeHelp();
    if (wasOpen) return;
    activeHelp = button;
    button.setAttribute('aria-expanded', 'true');
    button.setAttribute('aria-describedby', 'help-popover');
    popover.textContent = helpText[button.dataset.help];
    popover.hidden = false;
    const rect = button.getBoundingClientRect();
    const left = Math.max(16, Math.min(rect.right - popover.offsetWidth, window.innerWidth - popover.offsetWidth - 16));
    const below = rect.bottom + 10;
    const top = below + popover.offsetHeight <= window.innerHeight - 16 ? below : Math.max(16, rect.top - popover.offsetHeight - 10);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  });
});
document.addEventListener('click', event => {
  if (!event.target.closest('[data-help], #help-popover')) closeHelp();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeHelp(); });
window.addEventListener('resize', closeHelp);
window.addEventListener('scroll', closeHelp, { passive: true });

document.addEventListener('somnia:navigate', closeHelp);

render();

// The local server announces file edits so the preview stays current.
const reloadStream = new EventSource('/__reload');
reloadStream.addEventListener('reload', () => window.location.reload());
