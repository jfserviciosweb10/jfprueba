#!/usr/bin/env node
/* build-blog.js (sitio de cliente) — convierte los artículos que el cliente
   escribe en el Panel de Contenidos (Markdown en blog/_posts/) en páginas
   HTML reales, arma blog/index.html, suma el enlace "Blog" al menú del sitio
   (solo cuando hay artículos) y actualiza sitemap.xml.
   Corre solo en GitHub Actions (deploy.yml) en cada cambio. Es idempotente:
   regenera todo desde blog/_posts cada vez. Datos del negocio: blog/blog-config.json */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const yaml = require('js-yaml');

const CARPETA_POSTS = 'blog/_posts';
const MARCA = '<!-- JF-BLOG-AUTO -->';
const cfg = JSON.parse(fs.readFileSync('blog/blog-config.json', 'utf8'));
const URL_BASE = 'https://' + cfg.dominio;

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parsear(texto) {
  const m = texto.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { datos: {}, cuerpo: texto };
  let datos = {};
  try { datos = yaml.load(m[1]) || {}; } catch (e) { console.log('Frontmatter inválido, se ignora:', e.message); }
  return { datos, cuerpo: m[2] };
}

function aISO(f) {
  const d = f instanceof Date ? f : new Date(f);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
function legible(iso) {
  try { return new Date(iso).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); }
  catch (e) { return iso.slice(0, 10); }
}
function slugDe(archivo) { return archivo.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, ''); }

const gaOk = cfg.ga && !/XXXX/.test(cfg.ga);
const gaHTML = gaOk ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${cfg.ga}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${cfg.ga}');
document.addEventListener('click',function(e){var a=e.target.closest?e.target.closest('a'):null;if(!a||!a.href)return;if(a.href.indexOf('whatsapp.com')>-1||a.href.indexOf('wa.me')>-1){gtag('event','clic_whatsapp',{pagina:location.pathname});}});</script>` : '';

const fuenteURL = 'https://fonts.googleapis.com/css2?family=' + String(cfg.fuente || 'Roboto Slab').replace(/ /g, '+') + ':wght@600;700&family=Lato:wght@400;700&display=swap';
const CSS = `:root{--p:${cfg.p};--a:${cfg.a};--fondo:${cfg.fondo};--texto:${cfg.texto};--osc:${cfg.osc};--ff-d:'${cfg.fuente}',Georgia,serif;--ff-b:'Lato',sans-serif}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:var(--ff-b);color:var(--texto);background:var(--fondo);line-height:1.7}
a{color:inherit;text-decoration:none}img{max-width:100%;height:auto}
.top{background:var(--p);color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.top .nom{font-family:var(--ff-d);font-weight:700;font-size:1.2rem}.top img{max-height:40px;width:auto}
.top nav a{margin-left:18px;font-weight:700;font-size:.92rem;opacity:.95}.top nav a:hover{opacity:1;text-decoration:underline}
.wrap{max-width:820px;margin:0 auto;padding:40px 22px 70px}
.wrap.ancho{max-width:1100px}
.migas{font-size:.82rem;opacity:.7;margin-bottom:18px}
.fecha{font-size:.78rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.65;margin-bottom:8px}
h1{font-family:var(--ff-d);color:var(--p);font-size:clamp(1.8rem,4.5vw,2.6rem);line-height:1.2;margin-bottom:22px}
.cuerpo h2,.cuerpo h3{font-family:var(--ff-d);color:var(--p);margin:28px 0 10px;line-height:1.3}
.cuerpo p,.cuerpo ul,.cuerpo ol{margin-bottom:16px}.cuerpo ul,.cuerpo ol{padding-left:24px}
.cuerpo img{display:block;margin:24px auto;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.15)}
.cuerpo a{color:var(--p);text-decoration:underline}
.cta{margin-top:44px;padding:26px;border:2px solid var(--a);border-radius:14px;background:rgba(0,0,0,.03)}
.cta p{margin-bottom:14px}.btn{display:inline-block;background:var(--p);color:#fff;padding:13px 30px;border-radius:50px;font-weight:700}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:22px;margin-top:26px}
.card{display:block;background:#fff;border:1px solid rgba(0,0,0,.1);border-radius:14px;overflow:hidden;transition:transform .2s,box-shadow .2s}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(0,0,0,.12)}
.card img{width:100%;height:170px;object-fit:cover}.card .in{padding:18px}
.card h2{font-family:var(--ff-d);color:var(--p);font-size:1.1rem;line-height:1.3;margin:6px 0 8px}
.card p{font-size:.9rem;opacity:.85}.card .mas{display:block;margin-top:12px;font-weight:700;color:var(--p);font-size:.85rem}
footer{background:var(--osc);color:#fff;text-align:center;padding:26px 20px;font-size:.88rem}footer a{text-decoration:underline}`;

function cabeza(titulo, desc, url, extra) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
${MARCA}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
${extra || ''}
<meta name="robots" content="index, follow">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${fuenteURL}" rel="stylesheet">
${gaHTML}
<style>${CSS}</style>
</head>`;
}

function barra(raiz) {
  const marca = cfg.logo ? `<img src="${raiz}img/${esc(cfg.logo)}" alt="${esc(cfg.nombre)}">` : `<span class="nom">${esc(cfg.nombre)}</span>`;
  return `<header class="top"><a href="${raiz}">${marca}</a><nav><a href="${raiz}">Inicio</a><a href="${raiz}blog/">Blog</a><a href="${raiz}#contacto">Contacto</a></nav></header>`;
}
function pie() {
  return `<footer>© ${new Date().getFullYear()} ${esc(cfg.nombre)} — Diseño web por <a href="https://jfserviciosweb.com" target="_blank" rel="noopener">JF Servicios Web</a></footer>`;
}

function paginaArticulo(p) {
  const url = `${URL_BASE}/blog/${p.slug}.html`;
  const img = p.imagen ? (/^https?:/.test(p.imagen) ? p.imagen : URL_BASE + '/' + p.imagen.replace(/^\//, '')) : '';
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: p.titulo, description: p.desc, datePublished: p.iso.slice(0, 10), dateModified: p.iso.slice(0, 10),
      author: { '@type': 'Organization', name: cfg.nombre }, publisher: { '@type': 'Organization', name: cfg.nombre },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url }, ...(img ? { image: img } : {}) },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: URL_BASE },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: URL_BASE + '/blog/' },
      { '@type': 'ListItem', position: 3, name: p.titulo, item: url } ] } ] };
  const extra = `<meta property="og:type" content="article">${img ? `\n<meta property="og:image" content="${esc(img)}">` : ''}
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`;
  const wa = cfg.whatsapp ? `<div class="cta"><p>¿Querés consultarnos algo? Escribinos:</p><a class="btn" target="_blank" rel="noopener" href="https://api.whatsapp.com/send?phone=${cfg.whatsapp}&text=${encodeURIComponent('Hola, leí tu artículo "' + p.titulo + '" y quiero consultar')}">💬 Escribinos por WhatsApp</a></div>` : '';
  return `${cabeza(p.titulo + ' | ' + cfg.nombre, p.desc, url, extra)}
<body>
${barra('../')}
<main class="wrap"><article>
<div class="migas"><a href="../">Inicio</a> › <a href="./">Blog</a> › ${esc(p.titulo)}</div>
<div class="fecha">${esc(legible(p.iso))}</div>
<h1>${esc(p.titulo)}</h1>
<div class="cuerpo">
${p.html}
</div>
${wa}
</article></main>
${pie()}
</body>
</html>
`;
}

function paginaIndice(posts) {
  const tarjetas = posts.map(p => `<a class="card" href="${p.slug}.html">${p.imagen ? `<img src="${esc(/^https?:/.test(p.imagen) ? p.imagen : '../' + p.imagen.replace(/^\//, ''))}" alt="" loading="lazy">` : ''}<div class="in"><div class="fecha">${esc(legible(p.iso))}</div><h2>${esc(p.titulo)}</h2><p>${esc(p.desc)}</p><span class="mas">Leer el artículo completo →</span></div></a>`).join('\n');
  return `${cabeza('Blog | ' + cfg.nombre, 'Novedades, consejos y artículos de ' + cfg.nombre, URL_BASE + '/blog/')}
<body>
${barra('../')}
<main class="wrap ancho">
<div class="migas"><a href="../">Inicio</a> › Blog</div>
<h1>Blog</h1>
<div class="grid">
${tarjetas}
</div>
</main>
${pie()}
</body>
</html>
`;
}

function main() {
  // 1) Borrar páginas auto-generadas anteriores (así un artículo eliminado desaparece)
  if (fs.existsSync('blog')) {
    fs.readdirSync('blog').filter(f => f.endsWith('.html')).forEach(f => {
      const ruta = path.join('blog', f);
      if (fs.readFileSync(ruta, 'utf8').includes(MARCA)) fs.unlinkSync(ruta);
    });
  }

  // 2) Leer artículos
  const posts = [];
  if (fs.existsSync(CARPETA_POSTS)) {
    for (const archivo of fs.readdirSync(CARPETA_POSTS).filter(f => f.endsWith('.md'))) {
      const { datos, cuerpo } = parsear(fs.readFileSync(path.join(CARPETA_POSTS, archivo), 'utf8'));
      if (datos.draft === true) continue;
      posts.push({
        slug: slugDe(archivo),
        titulo: String(datos.title || 'Artículo'),
        desc: String(datos.description || ''),
        iso: aISO(datos.date),
        imagen: datos.image ? String(datos.image) : '',
        html: marked.parse(cuerpo || '')
      });
    }
  }
  posts.sort((a, b) => b.iso.localeCompare(a.iso));

  // 3) Escribir páginas
  if (posts.length) {
    posts.forEach(p => fs.writeFileSync(path.join('blog', p.slug + '.html'), paginaArticulo(p), 'utf8'));
    fs.writeFileSync('blog/index.html', paginaIndice(posts), 'utf8');
  } else if (fs.existsSync('blog/index.html') && fs.readFileSync('blog/index.html', 'utf8').includes(MARCA)) {
    fs.unlinkSync('blog/index.html');
  }

  // 4) Enlace "Blog" en el menú y el pie del sitio (solo si hay artículos)
  if (fs.existsSync('index.html')) {
    let h = fs.readFileSync('index.html', 'utf8');
    const li = posts.length ? '<li><a href="blog/">Blog</a></li>' : '';
    const nuevo = h.replace(/<!-- BLOG-NAV-START -->[\s\S]*?<!-- BLOG-NAV-END -->/g, `<!-- BLOG-NAV-START -->${li}<!-- BLOG-NAV-END -->`);
    if (nuevo !== h) fs.writeFileSync('index.html', nuevo, 'utf8');
  }

  // 5) sitemap.xml
  if (fs.existsSync('sitemap.xml')) {
    let s = fs.readFileSync('sitemap.xml', 'utf8');
    s = s.replace(/\s*<url><loc>[^<]*\/blog\/[^<]*<\/loc>[\s\S]*?<\/url>/g, '');
    if (posts.length) {
      const urls = [{ loc: URL_BASE + '/blog/', iso: posts[0].iso }].concat(posts.map(p => ({ loc: `${URL_BASE}/blog/${p.slug}.html`, iso: p.iso })))
        .map(u => `\n  <url><loc>${u.loc}</loc><lastmod>${u.iso.slice(0, 10)}</lastmod><priority>0.6</priority></url>`).join('');
      s = s.replace('</urlset>', urls + '\n</urlset>');
    }
    fs.writeFileSync('sitemap.xml', s, 'utf8');
  }

  console.log(`Blog listo: ${posts.length} artículo(s).`);
}

main();
