document.addEventListener('DOMContentLoaded', () => {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<span class="lightbox-close">&times;</span><img src="" alt="">';
  document.body.appendChild(lb);

  const img   = lb.querySelector('img');
  const close = lb.querySelector('.lightbox-close');

  function openLb(src, alt) {
    img.src = src; img.alt = alt || '';
    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeLb() {
    lb.classList.remove('active');
    img.src = '';
    document.body.style.overflow = '';
  }

  document.addEventListener('click', e => {
    if (e.target.matches('.carousel-item img, .guide-img')) openLb(e.target.src, e.target.alt);
  });
  close.addEventListener('click', closeLb);
  lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLb(); });

  /* Modal de respuestas (trivia, etc.) */
  const am = document.createElement('div');
  am.className = 'answer-modal';
  am.innerHTML = `
    <div class="answer-modal-panel">
      <button class="answer-modal-close" aria-label="Cerrar">&times;</button>
      <h3 class="answer-modal-title"></h3>
      <ol class="answer-modal-list"></ol>
    </div>`;
  document.body.appendChild(am);
  function closeAm() { am.classList.remove('active'); }
  am.querySelector('.answer-modal-close').addEventListener('click', closeAm);
  am.addEventListener('click', e => { if (e.target === am) closeAm(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAm(); });

  window.showAnswers = function (el) {
    const title   = el.dataset.title || 'Respuestas';
    const answers = (el.dataset.answers || '').split('|').map(a => a.trim()).filter(Boolean);
    am.querySelector('.answer-modal-title').textContent = title;
    am.querySelector('.answer-modal-list').innerHTML = answers.map(a => `<li>${a}</li>`).join('');
    am.classList.add('active');
  };
});

/* Mantener compatibilidad con onclick="openLightbox()" en guías viejas */
window.openLightbox = src => document.dispatchEvent(
  Object.assign(new MouseEvent('click'), { target: Object.assign(document.createElement('img'), { src, className: 'guide-img' }) })
);

window.copyNavi = function (btn, command) {
  navigator.clipboard.writeText(command).then(() => {
    const t = btn.textContent;
    btn.textContent = 'Copiado';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = t; btn.classList.remove('copied'); }, 1200);
  });
};
