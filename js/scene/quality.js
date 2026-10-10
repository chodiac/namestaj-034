/* Nivoi kvaliteta 3D scene. Početni nivo je konzervativan (heuristika uređaja), a stvarno stanje
   određuju merenja: probno renderovanje pri pokretanju i praćenje trajanja kadrova tokom skrola.
   Nivo se samo SPUŠTA (bez ping-ponga); na kraju je statični poster. */
import { model as modelCfg } from '../../config/site.js';

export const TIERS = {
  // dpr: gornja granica pixel ratio; shadow: veličina shadow mape (0 = bez senki); shadowEvery: osvežavanje senki na N kadrova
  high: { model: modelCfg.high, dpr: 2,   shadow: 2048, shadowEvery: 1, lights: 'full', fade: true,  aa: true,  fps: 0,  normals: true,  budget: 24, px: 4.2e6, cell: 1 },
  mid:  { model: modelCfg.mid,  dpr: 1.5, shadow: 1024, shadowEvery: 2, lights: 'lite', fade: false, aa: true,  fps: 0,  normals: true,  budget: 28, px: 1.8e6, cell: 1.5 },
  low:  { model: modelCfg.low,  dpr: 1,   shadow: 0,    shadowEvery: 0, lights: 'min',  fade: false, aa: false, fps: 30, normals: false, budget: 42, px: 0.8e6, cell: 2 },
};

export function detect() {
  const q = new URLSearchParams(location.search);
  const forced = q.get('tier');
  const nav = navigator, conn = nav.connection || {};
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  const mem = nav.deviceMemory, cores = nav.hardwareConcurrency || 4;
  const info = { mobile, mem, cores, saveData: !!conn.saveData, net: conn.effectiveType || null };
  if (forced && (forced === 'poster' || TIERS[forced])) return { tier: forced, reason: 'forsirano (?tier=)', ...info };
  if (q.get('motion') === 'reduce') return { tier: 'poster', reason: '?motion=reduce', ...info };
  if (conn.saveData) return { tier: 'poster', reason: 'uključena ušteda podataka', ...info };
  if (/(^|-)2g$/.test(conn.effectiveType || '') || conn.effectiveType === '3g') return { tier: 'poster', reason: 'spora mreža', ...info };
  if (mobile) {
    if ((mem && mem <= 2) || cores <= 2) return { tier: 'poster', reason: 'slab telefon (memorija/jezgra)', ...info };
    return { tier: 'low', reason: 'mobilni — konzervativan početak', ...info };
  }
  if ((mem && mem <= 2) || cores <= 2) return { tier: 'low', reason: 'slab računar', ...info };
  if ((mem || 4) >= 8 && cores >= 8) return { tier: 'high', reason: 'jak računar', ...info };
  return { tier: 'mid', reason: 'računar — standardno', ...info };
}

/** softverski renderer (SwiftShader, llvmpipe…) nije upotrebljiv za 3D */
export function isSoftwareGL(gl) {
  try {
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    const name = e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|software|microsoft basic/i.test(name) ? name : '';
  } catch { return ''; }
}
