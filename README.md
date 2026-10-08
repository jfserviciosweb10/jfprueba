# Prueba Dominio JF — Checklist post-entrega

## Datos del cliente
- **Dominio:** jfprueba.com
- **Ciudad:** el trebol, santa fe
- **WhatsApp:** 5493442569002
- **Email:** yoemifus@gmail.com
- **Formspree ID:** movnpobb
- **Generado:** 2026-10-08


## 📋 Decap CMS — colecciones pendientes de construir
Elegidas al generar este cliente (sugeridas por rubro + editadas a mano):
- **staff**

⚠️ Todavía NO están conectadas al `admin/config.yml` ni tienen sección en el
sitio — el pipeline (YAML + marcas HTML + script de reconstrucción) solo está
construido hoy para "productos" (Tienda Digital). Construir cada una siguiendo
el mismo patrón antes de activarla para este cliente.

## 🔑 Cómo entrar al Panel de Contenidos (para pasarle al cliente)
1. Abrir https://[usuario].github.io/jfprueba-com/admin/ desde una **ventana normal** del navegador (NO incógnito).
2. Tocar "Iniciar sesión con GitHub". Se abre una ventanita: si el navegador la bloquea, permitir ventanas emergentes para github.io y volver a intentar.
3. El cliente tiene que haber aceptado la invitación como colaborador del repositorio.

## ✅ Checklist antes de publicar
- [ ] Avisar al cliente: entrar al Panel desde ventana normal y permitir emergentes de github.io
- [ ] Reemplazar img/whatsapp-flotante.webp con el ícono real
- [ ] Confirmar email Formspree del cliente (revisar SPAM)
- [ ] Verificar Schema en search.google.com/test/rich-results
- [ ] Probar formulario enviando mensaje real
- [ ] Probar botón WA flotante en mobile
- [ ] Correr Lighthouse — Performance ≥85, SEO ≥90, Accessibility ≥90
- [ ] Subir a GitHub Pages
- [ ] Configurar dominio en Cloudflare
- [ ] Verificar SSL activo (https://)
- [ ] (Si tiene video) Activar "Permitir embeber" en YouTube Studio

## 🚀 Publicación
```
git init
git add .
git commit -m "Sitio Prueba Dominio JF — JF Servicios Web"
git branch -M main
git remote add origin https://github.com/[usuario]/jfprueba-com.git
git push -u origin main
```
