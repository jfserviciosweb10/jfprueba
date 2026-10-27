#!/usr/bin/env node
// demos-ciclo.js - vive en jfprueba/.github/scripts/ y lo corre deploy.yml todos los dias.
// Lee demos-prueba.json (en la raiz del repo):
//   { "slug": { "nombre": "...", "publicada": "2026-10-26", "conservar": false, "pausada": false } }
// Dia 7  -> la web de la demo se reemplaza por una pagina "tu prueba termino" y se borran sus fotos.
// Dia 30 -> se borra la carpeta entera y la demo sale del registro.
// "conservar": true -> no se toca (cliente que siguio).
const fs = require('fs');
const path = require('path');

const REGISTRO = 'demos-prueba.json';
const DIAS_PAUSA = 7;
const DIAS_BORRADO = 30;
const WHATSAPP_JOSE = '5493496591636';
const HOY = process.env.DEMOS_HOY ? new Date(process.env.DEMOS_HOY) : new Date();

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dias = (iso) => Math.floor((HOY - new Date(iso + 'T00:00:00Z')) / 86400000);
const fecha = (iso, mas) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + mas); return d.toISOString().slice(0, 10).split('-').reverse().join('/'); };

function paginaPausa(nombre, publicada) {
  const msg = encodeURIComponent('Hola! Mi demo de prueba de ' + nombre + ' termino y quiero seguir con mi web.');
  return `<!doctype html>
<html lang="es" data-pagefind-ignore>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(nombre)} - prueba finalizada</title>
<style>
body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0d2b5e;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.c{max-width:560px;text-align:center}
h1{font-size:1.9rem;margin:0 0 12px}
p{line-height:1.55;color:#cfdcf2;margin:0 0 14px}
a.b{display:inline-block;background:#25d366;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;margin-top:8px}
small{display:block;margin-top:22px;color:#8fa6cc}
</style>
</head>
<body data-pagefind-ignore>
<div class="c">
<h1>La prueba de ${esc(nombre)} termin&oacute;</h1>
<p>Tus 7 d&iacute;as de Demo-Prueba pasaron. Tu web, tus textos y tus fotos siguen guardados unos d&iacute;as m&aacute;s: si quer&eacute;s quedarte con tu web, escribinos y la dejamos funcionando con tu dominio propio.</p>
<a class="b" href="https://wa.me/${WHATSAPP_JOSE}?text=${msg}">Quiero seguir con mi web</a>
<small>Si no seguimos, el ${fecha(publicada, DIAS_BORRADO)} dejamos de publicar tu web y borramos tus datos de nuestros sistemas.</small>
</div>
</body>
</html>
`;
}

if (!fs.existsSync(REGISTRO)) { console.log('Sin ' + REGISTRO + ': nada que hacer.'); process.exit(0); }
let reg;
try { reg = JSON.parse(fs.readFileSync(REGISTRO, 'utf8')); } catch (e) { console.log('No pude leer ' + REGISTRO + ': ' + e.message); process.exit(0); }

let cambio = false;
for (const slug of Object.keys(reg)) {
  const d = reg[slug] || {};
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) { console.log('Nombre invalido, lo ignoro: ' + slug); continue; }
  if (['admin', 'blog', 'img', 'icons', 'panel', '_data', 'pagefind', 'node_modules', 'demos', 'www', 'api'].includes(slug)) { console.log('Nombre reservado, lo ignoro: ' + slug); continue; }
  if (d.conservar === true) continue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.publicada || '')) { console.log(slug + ': sin fecha valida, lo ignoro.'); continue; }
  const n = dias(d.publicada);
  const carpeta = path.join(process.cwd(), slug);
  if (n >= DIAS_BORRADO) {
    fs.rmSync(carpeta, { recursive: true, force: true });
    delete reg[slug];
    cambio = true;
    console.log(slug + ': dia ' + n + ' -> BORRADA.');
  } else if (n >= DIAS_PAUSA && !d.pausada) {
    if (fs.existsSync(carpeta)) {
      fs.rmSync(path.join(carpeta, 'img'), { recursive: true, force: true });
      fs.writeFileSync(path.join(carpeta, 'index.html'), paginaPausa(d.nombre || slug, d.publicada), 'utf8');
    }
    d.pausada = true;
    reg[slug] = d;
    cambio = true;
    console.log(slug + ': dia ' + n + ' -> PAUSADA.');
  }
}
if (cambio) fs.writeFileSync(REGISTRO, JSON.stringify(reg, null, 2) + '\n', 'utf8');
console.log('Ciclo de demos listo.');
