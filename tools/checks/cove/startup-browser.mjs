import { createViewingPage } from '../../../src/shared/viewing/page.js';
const assertions = [];
const check = (value, name) => { if (!value) throw new Error(name); assertions.push(name); };
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const moods = { afternoon: { time: '15:00', weather: 'sun', label: 'day' } };
const cameras = [{ id: 'auto', label: 'auto' }];
const boats = [{ id: 'boat', label: 'Boat' }, { id: 'retired-boat', label: 'Retired boat' }];
const preferenceKey = 'sunny-cove.startup-check.preferences';
const previousPreferences = localStorage.getItem(preferenceKey);
let callbacks, snapshot, page, calls = 0;
function fakeViewer(options) {
  callbacks = options; calls++;
  snapshot = { ready: true, paused: false, active: true, sound: false, mood: 'afternoon',
    camera: { mode: 'auto', activeMode: 'auto' }, boatId: 'boat', boat: { phase: 'cruising' },
    boatChange: { status: 'idle' }, renderCount: 0 };
  if (window.earlyFrame) { snapshot.renderCount = 1; options.onFrame(snapshot); }
  return Promise.resolve({ state: { ready: true, paused: false }, snapshot: () => snapshot,
    dispose() {}, setPaused() {}, setMood() {}, setCamera() {}, setBoat() {}, setSound() {}, capture() {} });
}
function mount() {
  return createViewingPage({ createViewer: fakeViewer, moods, cameraModes: cameras, debugKey: '__TEST__',
    capturePrefix: 'test', manifestPath: 'unused.json', boats, defaultBoatId: 'boat', preferenceKey });
}
try {
  localStorage.setItem(preferenceKey, JSON.stringify({ boatId: 'retired-boat', mood: 'afternoon', cameraMode: 'auto' }));
  page = mount(); await pause();
  check(callbacks.boatId === 'boat' && callbacks.mood === 'afternoon' && callbacks.cameraMode === 'auto', 'legacy boat preference is ignored while valid viewing preferences survive');
  check(!document.querySelector('#loading').hidden && document.querySelector('#pause').disabled, 'loading remains until first frame');
  snapshot.renderCount = 1; callbacks.onFrame(snapshot);
  check(document.querySelector('#loading').hidden && !document.querySelector('#pause').disabled, 'first frame enables controls');
  page.dispose();
  document.querySelector('#world').dataset.renderCount = '99'; window.earlyFrame = true;
  page = mount(); await pause();
  check(!document.querySelector('#world').dataset.renderCount, 'new canvas drops stale render count');
  check(document.querySelector('#loading').hidden && !document.querySelector('#pause').disabled, 'synchronous first frame before viewer return works');
  page.dispose(); window.earlyFrame = false;
  page = mount(); await pause(); callbacks.onError(new Error('first draw failed'));
  snapshot.renderCount = 1; callbacks.onFrame(snapshot);
  check(!document.querySelector('#loading').hidden && !document.querySelector('#retry').hidden && document.querySelector('#pause').disabled, 'failed draw retains retry and disabled controls');
  document.querySelector('#retry').click(); await pause();
  check(document.querySelector('#retry').hidden && !document.querySelector('#loading').hidden && calls === 4, 'retry creates a fresh waiting viewer');
  snapshot.renderCount = 1; callbacks.onFrame(snapshot);
  check(document.querySelector('#loading').hidden && !document.querySelector('#pause').disabled, 'retry recovers on first frame');
  page.dispose(); document.body.innerHTML = `<pre id="result">${JSON.stringify({ status: 'passed', assertions })}</pre>`;
} catch (error) { document.body.innerHTML = `<pre id="result">${JSON.stringify({ status: 'failed', assertions, error: String(error) })}</pre>`; }
finally {
  if (previousPreferences === null) localStorage.removeItem(preferenceKey);
  else localStorage.setItem(preferenceKey, previousPreferences);
}
