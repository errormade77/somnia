// Opt-in local diagnostics: /settings?perf. Never loaded on normal visits.
const panel = document.createElement('aside');
panel.id = 'performance-probe';
panel.dataset.noGlow = '';
panel.style.cssText = 'position:fixed;z-index:10000;top:76px;left:12px;width:250px;padding:12px;border:1px solid #ddd;border-radius:12px;background:#fff;font:12px/1.4 monospace;pointer-events:auto';
panel.innerHTML = '<button type="button" id="perf-start">Замерить 8 секунд</button><button type="button" id="perf-routes" style="margin-top:8px">Проверить переходы</button><pre id="perf-result" style="white-space:pre-wrap;margin:8px 0 0">Готов к замеру</pre>';
document.body.append(panel);
const button = panel.querySelector('button');
const routeButton = panel.querySelector('#perf-routes');
const output = panel.querySelector('pre');
function measure(routes = false) {
  if (button.disabled) return;
  button.disabled = routeButton.disabled = true;
  output.textContent = 'Прогрев…';
  setTimeout(() => {
    const times = [];
    const flightTimes = [];
    const tasks = [];
    // Exercise the real route links without automation snapshots between frames.
    const routeTimers = routes ? Array.from({ length: 6 }, (_, index) => setTimeout(() => {
      const selector = document.documentElement.dataset.page === 'settings' ? '.home-link' : '.device-link';
      document.querySelector(selector).click();
    }, index * 1300)) : [];
    const start = performance.now();
    let previous = start;
    let invalidations = 0;
    const observer = new MutationObserver(records => { invalidations += records.length; });
    const filter = document.querySelector('#orb-content-refraction');
    if (filter) observer.observe(filter, { subtree: true, attributes: true });
    let longTasks;
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) {
      longTasks = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => entry.duration)));
      longTasks.observe({ type: 'longtask' });
    }
    output.textContent = 'Замер…';
    function frame(now) {
      const delta = now - previous;
      times.push(delta);
      if (document.documentElement.dataset.deviceFlight) flightTimes.push(delta);
      previous = now;
      if (now - start < 8000 && !document.hidden) { requestAnimationFrame(frame); return; }
      observer.disconnect();
      longTasks?.disconnect();
      routeTimers.forEach(clearTimeout);
      const ordered = [...times].sort((a, b) => a - b);
      const orderedFlight = [...flightTimes].sort((a, b) => a - b);
      const round = value => Math.round(value * 10) / 10;
      const result = {
        sample: routes ? 'six-route-transitions' : 'steady',
        mode: document.querySelector('#device-preview').dataset.active,
        viewport: `${innerWidth}×${innerHeight}@${devicePixelRatio}`,
        fps: round(times.length * 1000 / (now - start)),
        p95_ms: round(ordered[Math.floor(ordered.length * .95)]),
        max_ms: round(Math.max(...times)),
        frames_over_25ms: times.filter(value => value > 25).length,
        ...(flightTimes.length ? {
          flight_fps: round(flightTimes.length * 1000 / flightTimes.reduce((sum, time) => sum + time, 0)),
          flight_p95_ms: round(orderedFlight[Math.floor(orderedFlight.length * .95)]),
        } : {}),
        long_tasks: tasks.length,
        blocking_ms: round(tasks.reduce((sum, duration) => sum + duration - 50, 0)),
        filter_mutations: invalidations,
        canvases: document.querySelectorAll('canvas').length,
        playing_videos: [...document.querySelectorAll('video')].filter(video => !video.paused).length,
        hidden: document.hidden,
      };
      output.textContent = JSON.stringify(result, null, 2);
      console.info('Somnia performance', JSON.stringify(result));
      button.disabled = routeButton.disabled = false;
    }
    requestAnimationFrame(frame);
  }, 1000);
}
button.addEventListener('click', () => measure());
routeButton.addEventListener('click', () => measure(true));
