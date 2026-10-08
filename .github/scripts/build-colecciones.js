#!/usr/bin/env node
/* build-colecciones.js — reconstruye Menú, Staff, Portfolio, Promociones
   y Horarios en index.html a partir de sus _data/*.yml, entre las marcas
   correspondientes. Corre solo, vía GitHub Actions, cada vez que Decap/
   Sveltia comitea un cambio en cualquiera de esos archivos. Si un archivo
   no existe (colección no habilitada para este cliente), simplemente se
   la saltea, sin error. */

const fs = require('fs');
const yaml = require('js-yaml');

const RUTA_INDEX = 'index.html';
if (!fs.existsSync(RUTA_INDEX)) { console.error('No se encontro index.html.'); process.exit(1); }
let html = fs.readFileSync(RUTA_INDEX, 'utf8');
let cambio = false;

// FECHAS-SVELTIA: YAML lee 2026-10-05 como Date; lo mostramos como texto
function fechaTxt(v) {
  const iso = v instanceof Date ? v.toISOString().slice(0, 10) : String(v == null ? '' : v);
  const m = iso.match(/^(d{4})-(d{2})-(d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : iso;
}
function escAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toggleSeccion(claseSeccion, hayContenido) {
  const re = new RegExp('(<section class="' + claseSeccion + '" id="[^"]+")( style="display:none")?>');
  const reemplazo = hayContenido ? '$1>' : '$1 style="display:none">';
  const nuevo = html.replace(re, reemplazo);
  if (nuevo !== html) { html = nuevo; cambio = true; }
  // Enlaces del menu y del pie hacia esa seccion: se muestran solo si hay contenido
  const colNav = claseSeccion.replace('-seccion', '');
  const reLi = new RegExp('<li data-nav-col="' + colNav + '"( style="display:none")?>', 'g');
  const liNuevo = '<li data-nav-col="' + colNav + '"' + (hayContenido ? '' : ' style="display:none"') + '>';
  const html2 = html.replace(reLi, liNuevo);
  if (html2 !== html) { html = html2; cambio = true; }
}

function reemplazarBloque(marcaInicio, marcaFin, bloqueHTML) {
  const i0 = html.indexOf(marcaInicio);
  const i1 = html.indexOf(marcaFin);
  if (i0 === -1 || i1 === -1) return;
  const nuevo = html.slice(0, i0 + marcaInicio.length) + bloqueHTML + html.slice(i1);
  if (nuevo !== html) { html = nuevo; cambio = true; }
}

function campoDual(valorEs, valorI2) {
  if (!valorEs) return '';
  if (!valorI2) return escAttr(valorEs);
  return '<span data-i18n-dyn data-i18n-es="' + escAttr(valorEs) + '" data-i18n-i2="' + escAttr(valorI2) + '">' + escAttr(valorEs) + '</span>';
}

function tarjeta(imgHTML, tituloEs, tituloI2, subHTML, descEs, descI2) {
  let h = '<div class="coleccion-card reveal-up">' + imgHTML;
  h += '<div class="coleccion-info"><h3>' + campoDual(tituloEs, tituloI2) + '</h3>';
  if (subHTML) h += '<div class="coleccion-sub">' + subHTML + '</div>';
  if (descEs) h += '<p>' + campoDual(descEs, descI2) + '</p>';
  h += '</div></div>';
  return h;
}

function imgSimple(src, alt) {
  if (!src) return '';
  return '<div class="coleccion-img"><img src="' + escAttr(src) + '" alt="' + escAttr(alt) + '" loading="lazy"></div>';
}

function tarjetaPortfolio(it) {
  let imgHTML;
  if (it.foto_antes && it.foto_despues) {
    imgHTML = '<div class="coleccion-img coleccion-img-doble">' +
      '<div class="mitad"><img src="' + escAttr(it.foto_antes) + '" alt="Antes" loading="lazy">' +
      '<span class="tag-mitad" data-i18n="portfolio.antes">Antes</span></div>' +
      '<div class="mitad"><img src="' + escAttr(it.foto_despues) + '" alt="Despues" loading="lazy">' +
      '<span class="tag-mitad" data-i18n="portfolio.despues">Después</span></div></div>';
  } else {
    imgHTML = imgSimple(it.foto_despues || it.foto_antes, it.titulo);
  }
  return tarjeta(imgHTML, it.titulo, it.titulo_i2, '', it.descripcion, it.descripcion_i2);
}

const TIPOS = {
  menu: function (it) {
    return tarjeta(imgSimple(it.foto, it.nombre), it.nombre, it.nombre_i2, it.precio ? escAttr(it.precio) : '', it.descripcion, it.descripcion_i2);
  },
  staff: function (it) {
    return tarjeta(imgSimple(it.foto, it.nombre), it.nombre, it.nombre_i2, campoDual(it.cargo, it.cargo_i2), it.bio, it.bio_i2);
  },
  portfolio: function (it) { return tarjetaPortfolio(it); },
  promociones: function (it) {
    const subHTML = it.vencimiento ? ('<span data-i18n="promociones.vence">Vence</span>: ' + escAttr(fechaTxt(it.vencimiento))) : '';
    return tarjeta(imgSimple(it.foto, it.titulo), it.titulo, it.titulo_i2, subHTML, it.descripcion, it.descripcion_i2);
  },
};

Object.keys(TIPOS).forEach(function (tipo) {
  const ruta = '_data/' + tipo + '.yml';
  if (!fs.existsSync(ruta)) return;
  const datos = yaml.load(fs.readFileSync(ruta, 'utf8')) || {};
  const todos = Array.isArray(datos.items) ? datos.items : [];
  // 'activo' no marcado (undefined) cuenta como true, por compatibilidad
  // con items cargados antes de que existiera este interruptor.
  const items = todos.filter(function (it) { return it.activo !== false; }).slice(0, 31);
  const bloque = items.map(TIPOS[tipo]).join('');
  reemplazarBloque('<!-- ' + tipo.toUpperCase() + '-GRID-START -->', '<!-- ' + tipo.toUpperCase() + '-GRID-END -->', bloque);
  toggleSeccion(tipo + '-seccion', items.length > 0);
});

// Horarios especiales: lista, no grilla de tarjetas
if (fs.existsSync('_data/horarios.yml')) {
  const datos = yaml.load(fs.readFileSync('_data/horarios.yml', 'utf8')) || {};
  const todos = Array.isArray(datos.items) ? datos.items : [];
  const items = todos.filter(function (it) { return it.activo !== false; }).slice(0, 31);
  const bloque = items.map(function (it) {
    let h = '<div class="horario-item reveal-up"><span class="h-fecha">' + escAttr(fechaTxt(it.fecha)) + '</span>';
    h += '<span class="h-horario">' + campoDual(it.horario, it.horario_i2) + '</span>';
    if (it.nota) h += '<span class="h-nota">' + campoDual(it.nota, it.nota_i2) + '</span>';
    h += '</div>';
    return h;
  }).join('');
  reemplazarBloque('<!-- HORARIOS-LISTA-START -->', '<!-- HORARIOS-LISTA-END -->', bloque);
  toggleSeccion('horarios-seccion', items.length > 0);
}

if (cambio) {
  fs.writeFileSync(RUTA_INDEX, html, 'utf8');
  console.log('index.html actualizado con las colecciones.');
} else {
  console.log('Sin cambios en las colecciones.');
}
