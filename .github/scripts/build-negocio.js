#!/usr/bin/env node
/* build-negocio.js (sitio de cliente) — reconstruye la portada (título y subtítulo), los servicios,
   el horario y los datos para Google a partir de _data/negocio.yml, que el cliente edita desde el
   Panel de Contenidos ("Datos de mi negocio"). Corre solo en GitHub Actions (deploy.yml).
   Si el archivo no existe, está roto o un dato viene vacío, NO se toca esa parte de la web. */
const fs = require('fs');
const yaml = require('js-yaml');

if (!fs.existsSync('index.html') || !fs.existsSync('_data/negocio.yml')) { console.log('Sin index.html o _data/negocio.yml — nada para hacer.'); process.exit(0); }
let datos = {};
try { datos = yaml.load(fs.readFileSync('_data/negocio.yml', 'utf8'), { schema: yaml.CORE_SCHEMA }) || {}; }
catch (e) { console.log('negocio.yml inválido, no se toca la web:', e.message); process.exit(0); }

const txt = (v) => (v == null ? '' : String(v)).trim();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dual = (es, i2) => txt(i2)
  ? `<span data-i18n-dyn data-i18n-es="${esc(es)}" data-i18n-i2="${esc(i2)}">${esc(es)}</span>`
  : esc(es);

let html = fs.readFileSync('index.html', 'utf8');
const original = html;
const avisos = [];

// Reemplaza lo que hay entre dos marcas (todas las veces que aparezcan)
function entreMarcas(nombre, contenido) {
  const A = `<!-- NEGOCIO-${nombre}-START -->`, B = `<!-- NEGOCIO-${nombre}-END -->`;
  if (!html.includes(A) || !html.includes(B)) { avisos.push(`sin marcas ${nombre}`); return false; }
  const re = new RegExp(A.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + B.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  html = html.replace(re, () => A + contenido + B);
  return true;
}

// 1) Título y subtítulo de la portada
const slogan = txt(datos.slogan), subtitulo = txt(datos.subtitulo);
if (slogan) entreMarcas('H1', `<h1>${dual(slogan, datos.slogan_i2)}</h1>`);
if (subtitulo) entreMarcas('SUB', `<p>${dual(subtitulo, datos.subtitulo_i2)}</p>`);

// 2) Horario (se muestra en Contacto y en el pie)
const horario = txt(datos.horario);
if (horario) {
  // Si la web ya trae el horario traducido (de la generación) y el texto no cambió, se deja como está
  const yaTraducido = !txt(datos.horario_i2) && html.includes(`data-i18n-es="${esc(horario)}"`);
  if (!yaTraducido) entreMarcas('HOR', dual(horario, datos.horario_i2));
}

// 3) Servicios (hasta 4)
const ICONOS = ['fa-star', 'fa-check-circle', 'fa-thumbs-up', 'fa-heart'];
const servicios = (Array.isArray(datos.servicios) ? datos.servicios : [])
  .filter(s => s && txt(s.titulo)).slice(0, 4);
if (servicios.length) {
  const tarjetas = servicios.map((s, i) => `
    <div class="service-card reveal-up" style="animation-delay:${(i * 0.08).toFixed(2).replace(/0+$/, '').replace(/\.$/, '') || 0}s">
      <div class="service-icon"><i class="fas ${/^fa-[a-z0-9-]+$/.test(txt(s.icono)) ? txt(s.icono) : ICONOS[i]}"></i></div>
      <h3>${dual(txt(s.titulo), s.titulo_i2)}</h3>
      <p>${dual(txt(s.desc), s.desc_i2)}</p>
    </div>`).join('');
  const clase = servicios.length === 4 ? ' s4' : servicios.length === 2 ? ' s2' : '';
  const okServ = entreMarcas('SERV', `<div class="services-grid${clase}">${tarjetas}</div>`);

  // Datos para Google: lista de servicios del negocio (solo si la web se pudo actualizar)
  if (okServ) html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (m, cuerpo) => {
    let j; try { j = JSON.parse(cuerpo); } catch (e) { return m; }
    const lista = j && j.hasOfferCatalog && j.hasOfferCatalog.itemListElement;
    if (!Array.isArray(lista)) return m;
    const prov = (lista[0] && lista[0].itemOffered && lista[0].itemOffered.provider) || { '@type': j['@type'] || 'LocalBusiness', name: j.name };
    j.hasOfferCatalog.itemListElement = servicios.map(s => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: txt(s.titulo), description: txt(s.desc), provider: prov }
    }));
    return '<script type="application/ld+json">' + JSON.stringify(j).replace(/</g, '\\u003c') + '</script>';
  });
}

if (html !== original) { fs.writeFileSync('index.html', html, 'utf8'); console.log('Datos del negocio actualizados.' + (avisos.length ? ' (' + avisos.join('; ') + ')' : '')); }
else console.log('Datos del negocio sin cambios.' + (avisos.length ? ' (' + avisos.join('; ') + ')' : ''));
