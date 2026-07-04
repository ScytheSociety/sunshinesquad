// ===================================================================
// LIGHTBOX.JS
// -------------------------------------------------------------------
// Que hace: agrega al final de la pagina el HTML del modal (lightbox)
// que se usa para ampliar imagenes, y expone 3 funciones globales
// para usar directamente en el HTML con onclick="...":
//
//   openLightbox(src)      -> abre el modal con la imagen ampliada
//   closeLightbox()        -> cierra el modal
//   copyNavi(boton, texto) -> copia "texto" al portapapeles y
//                             muestra "Copiado" un instante en el boton
//
// No hace falta escribir el <div class="lightbox"> en cada pagina:
// este script lo agrega solo. Solo se necesita incluir este script
// en las paginas donde haya imagenes ".guide-img" o botones ".navi-btn".
// ===================================================================

(function () {
  const lightboxHTML = `
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
      <span class="lightbox-close" onclick="closeLightbox()">&times;</span>
      <img id="lightbox-img" src="" alt="">
    </div>
  `;

  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('beforeend', lightboxHTML);
  });

  window.openLightbox = function (src) {
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('active');
  };

  window.closeLightbox = function () {
    document.getElementById('lightbox').classList.remove('active');
  };

  window.copyNavi = function (btn, command) {
    navigator.clipboard.writeText(command).then(() => {
      const original = btn.textContent;
      btn.textContent = 'Copiado';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1200);
    });
  };
})();