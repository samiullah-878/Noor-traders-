// manager.js — v211: manager ki app. Upar switch: "Meri hazri" (apna Check-In, parchi) | "Manager panel" (malik jaisa panel, hazri badalna band).
import { createOwnerView } from './owner.js';
import { createStaffView } from './staffview.js';

export function createManagerView(shared) {
  const owner = createOwnerView({ ...shared, manager: true });
  const staff = createStaffView({ ...shared, manager: true });
  let mode = 'panel';
  try { mode = localStorage.getItem('nt-hazri-mgr-mode') || 'panel'; } catch { /* ignore */ }
  const cur = () => (mode === 'me' ? staff : owner), other = () => (mode === 'me' ? owner : staff);
  const bar = () => `<div class="mode-bar" role="tablist" aria-label="Manager"><button type="button" role="tab" aria-selected="${mode === 'me'}" data-action="mgr-mode" data-arg="me">Meri hazri</button><button type="button" role="tab" aria-selected="${mode === 'panel'}" data-action="mgr-mode" data-arg="panel">Manager panel</button></div>`;
  const setMode = el => { mode = el.dataset.arg === 'me' ? 'me' : 'panel'; try { localStorage.setItem('nt-hazri-mgr-mode', mode); } catch { /* ignore */ } shared.rerender(); window.scrollTo?.(0, 0); };
  const pick = key => new Proxy({}, { get: (_, name) => (key === 'actions' && name === 'mgr-mode') ? setMode : (cur()[key]?.[name] || other()[key]?.[name]) });
  return {
    render() {
      const html = cur().render(), i = html.indexOf('<main');
      // Rules abhi publish nahi hue to panel ka data nahi aata — saaf batao (apni hazri phir bhi chalti hai)
      const denied = mode === 'panel' && Object.values(shared.data.state.errors || {}).some(v => v === 'permission-denied')
        ? '<p class="error-line" style="margin:0">Manager panel ka data nahi aa raha (permission-denied). Malik ko Firebase mein v211 wale rules Publish karne hain. Tab tak "Meri hazri" se apna kaam karein.</p>' : '';
      return i < 0 ? bar() + denied + html : html.slice(0, i) + bar() + denied + html.slice(i);
    },
    actions: pick('actions'), forms: pick('forms'), changes: pick('changes'), inputs: pick('inputs'),
    onData() { owner.onData?.(); staff.onData?.(); },
    onConfirmed(p) { staff.onConfirmed?.(p); }, // v217: apni hazri / wapsi ki kamyabi ki animation
    get mode() { return mode; }
  };
}
