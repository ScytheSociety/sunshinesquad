/* Carousel — uso:
   <div class="carousel-wrap carousel-images" data-step="5">
     <button class="carousel-btn prev">&#8592;</button>
     <div class="carousel-track" id="track-1">
       <div class="carousel-item">...</div>
       ...
     </div>
     <button class="carousel-btn next">&#8594;</button>
   </div>
*/
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.carousel-wrap').forEach(wrap => {
    const track   = wrap.querySelector('.carousel-track');
    const btnPrev = wrap.querySelector('.carousel-btn.prev');
    const btnNext = wrap.querySelector('.carousel-btn.next');
    if (!track) return;

    let pos = 0;

    function getStep() {
      const items = track.querySelectorAll('.carousel-item');
      if (!items.length) return 1;
      const itemW  = items[0].offsetWidth;
      const gap    = parseInt(getComputedStyle(track).gap) || 12;
      const wrapW  = track.parentElement.offsetWidth;
      return Math.max(1, Math.floor((wrapW + gap) / (itemW + gap)));
    }

    function totalItems() { return track.querySelectorAll('.carousel-item').length; }

    function update() {
      const step  = getStep();
      const total = totalItems();
      const maxPos = Math.max(0, total - step);
      pos = Math.min(pos, maxPos);

      const items = track.querySelectorAll('.carousel-item');
      if (!items.length) return;
      const itemW = items[0].offsetWidth;
      const gap   = parseInt(getComputedStyle(track).gap) || 12;
      track.style.transform = `translateX(-${pos * (itemW + gap)}px)`;

      if (btnPrev) btnPrev.disabled = pos === 0;
      if (btnNext) btnNext.disabled = pos >= maxPos;
    }

    if (btnPrev) btnPrev.addEventListener('click', () => { pos = Math.max(0, pos - 1); update(); });
    if (btnNext) btnNext.addEventListener('click', () => {
      const step  = getStep();
      const total = totalItems();
      pos = Math.min(pos + 1, Math.max(0, total - step));
      update();
    });

    /* Touch / swipe */
    let touchX = 0;
    track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', e => {
      const diff = touchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) btnNext && btnNext.click();
        else          btnPrev && btnPrev.click();
      }
    });

    window.addEventListener('resize', () => { pos = 0; update(); });
    update();
  });
});
