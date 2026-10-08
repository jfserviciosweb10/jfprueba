#!/usr/bin/env node
/* traducir-contenido.js (sitio de cliente) — completa las traducciones (campos "*_i2")
   del contenido que el cliente carga desde el Panel (FAQ, menú, staff, promociones...).
   Corre solo en GitHub Actions (deploy.yml), ANTES de reconstruir la web.
   - Traduce por medio del Worker de JF Servicios Web (la clave de la IA NO está acá).
   - Solo traduce lo que falta, o lo que quedó viejo porque el cliente cambió el texto en español.
   - Si el cliente escribió la traducción a mano, no se toca.
   - Si algo falla (sin token, límite diario, Worker caído) NO rompe el deploy: la web sigue. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

const URL_WORKER = process.env.JF_TRAD_URL || 'https://jf-traducir.jfserviciosweb.workers.dev';
const TOKEN = process.env.JF_TRAD_TOKEN || '';
const SITIO = process.env.JF_SITIO || '';
const IDIOMA = (process.env.JF_IDIOMA2 || 'en').toLowerCase();
const LOTE = 40, MAX_POR_CORRIDA = 150;
const CACHE_ARCH = path.join('_data', 'traducciones-cache.json');

const sha = (es) => crypto.createHash('sha1').update(IDIOMA + '|' + es.trim()).digest('hex');
// CORE_SCHEMA: las fechas (2026-10-02) quedan como texto, tal como las guarda el Panel
const leerYaml = (txt) => yaml.load(txt, { schema: yaml.CORE_SCHEMA });
const esObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

// Campos traducibles = los que tienen un hermano "<campo>_i2" definido en admin/config.yml
function camposBase() {
  const bases = new Set();
  try {
    const cfg = leerYaml(fs.readFileSync(path.join('admin', 'config.yml'), 'utf8'));
    (function rec(n) {
      if (Array.isArray(n)) return n.forEach(rec);
      if (!esObj(n)) return;
      if (typeof n.name === 'string' && /_i2$/.test(n.name)) bases.add(n.name.replace(/_i2$/, ''));
      Object.values(n).forEach(rec);
    })(cfg);
  } catch (e) {}
  return bases;
}

function recorrer(nodo, bases, cb) {
  if (Array.isArray(nodo)) return nodo.forEach(x => recorrer(x, bases, cb));
  if (!esObj(nodo)) return;
  bases.forEach(b => { if (typeof nodo[b] === 'string' && nodo[b].trim()) cb(nodo, b); });
  Object.values(nodo).forEach(v => recorrer(v, bases, cb));
}

async function pedirTraducciones(textos) {
  const res = await fetch(URL_WORKER, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-jf-token': TOKEN },
    body: JSON.stringify({ sitio: SITIO, idioma: IDIOMA, textos }),
    signal: AbortSignal.timeout(60000)
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error((data && data.error) || ('HTTP ' + res.status)); err.status = res.status; throw err; }
  if (!Array.isArray(data.traducciones) || data.traducciones.length !== textos.length) throw new Error('respuesta inesperada');
  return data.traducciones;
}

(async () => {
  if (!TOKEN || !SITIO) { console.log('Traducción automática: sin token o sin sitio configurado — se omite.'); return; }
  if (!fs.existsSync('_data')) { console.log('Sin carpeta _data — nada para traducir.'); return; }
  const bases = camposBase();
  if (!bases.size) { console.log('El Panel no tiene campos de traducción — nada para hacer.'); return; }

  // Archivos de datos
  const archivos = fs.readdirSync('_data').filter(f => /\.ya?ml$/i.test(f)).map(f => {
    const ruta = path.join('_data', f);
    let datos = null; try { datos = leerYaml(fs.readFileSync(ruta, 'utf8')); } catch (e) { console.log('No pude leer ' + f + ': ' + e.message); }
    return { ruta, datos, cambio: false };
  }).filter(a => a.datos && typeof a.datos === 'object');

  // Memoria de lo ya traducido (por texto). En la primera corrida se siembra con los pares que ya
  // existen: vienen de la generación del sitio (traducidos por JF), así que se consideran automáticos.
  let cache = {}; let cacheNuevo = false;
  try { cache = JSON.parse(fs.readFileSync(CACHE_ARCH, 'utf8')); } catch (e) { cacheNuevo = true; cache = {}; }
  const memo = cache[IDIOMA] || (cache[IDIOMA] = {});
  if (cacheNuevo) {
    archivos.forEach(a => recorrer(a.datos, bases, (o, b) => {
      const i2 = o[b + '_i2']; if (typeof i2 === 'string' && i2.trim()) memo[sha(o[b])] = i2;
    }));
  }
  const autoValores = new Set(Object.values(memo));

  // Qué hay que traducir
  const pendientes = []; // {obj, base, es, h}
  archivos.forEach(a => recorrer(a.datos, bases, (o, b) => {
    const es = o[b], h = sha(es), actual = typeof o[b + '_i2'] === 'string' ? o[b + '_i2'].trim() : '';
    if (!actual) { pendientes.push({ a, o, b, es, h }); return; }
    const eraAutomatica = autoValores.has(actual);
    if (eraAutomatica && memo[h] !== actual) pendientes.push({ a, o, b, es, h }); // el español cambió: la traducción quedó vieja
  }));

  // Primero lo que ya está en memoria, después lo que hay que pedir
  const aPedir = [];
  pendientes.forEach(p => {
    if (memo[p.h]) { p.o[p.b + '_i2'] = memo[p.h]; p.a.cambio = true; }
    else aPedir.push(p);
  });
  const unicos = [...new Set(aPedir.map(p => p.es.trim()))].slice(0, MAX_POR_CORRIDA);
  let traducidos = 0, error = '';
  for (let i = 0; i < unicos.length; i += LOTE) {
    const lote = unicos.slice(i, i + LOTE);
    try {
      const out = await pedirTraducciones(lote);
      lote.forEach((es, j) => { memo[sha(es)] = out[j]; });
      traducidos += lote.length;
    } catch (e) { error = e.message + (e.status ? ' (' + e.status + ')' : ''); break; }
  }
  aPedir.forEach(p => { const en = memo[p.h]; if (en) { p.o[p.b + '_i2'] = en; p.a.cambio = true; } });

  archivos.filter(a => a.cambio).forEach(a => {
    fs.writeFileSync(a.ruta, yaml.dump(a.datos, { lineWidth: -1, noRefs: true, schema: yaml.CORE_SCHEMA }), 'utf8');
    console.log('Actualizado ' + a.ruta);
  });
  if (cacheNuevo || traducidos) fs.writeFileSync(CACHE_ARCH, JSON.stringify(cache, null, 1) + '\n', 'utf8');
  console.log('Traducción automática: ' + traducidos + ' texto(s) traducido(s), ' + (pendientes.length - aPedir.length) + ' tomado(s) de la memoria.' + (error ? ' ⚠️ ' + error + ' — lo pendiente queda en español por ahora.' : ''));
})().catch(e => { console.log('Traducción automática omitida: ' + e.message); });
