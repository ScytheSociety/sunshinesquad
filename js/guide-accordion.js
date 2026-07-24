/* Convierte los <h2> de una guía (cada uno = una misión/sección) en
   bloques colapsables, y genera un índice numerado que salta a cada uno.
   Uso: buildGuideAccordion(document.getElementById('guide-body')) */
function buildGuideAccordion(container) {
  if (!container) return;
  const h2s = Array.from(container.children).filter(el => el.tagName === 'H2');
  if (h2s.length < 2) return; // no vale la pena un índice para 0-1 secciones

  const toc = document.createElement('nav');
  toc.className = 'guide-toc';
  toc.innerHTML = '<div class="guide-toc-title">📋 Índice</div>';
  const tocList = document.createElement('ol');
  tocList.className = 'guide-toc-list';
  toc.appendChild(tocList);
  container.insertBefore(toc, h2s[0]);

  h2s.forEach((h2, idx) => {
    const num = idx + 1;
    const id = `mision-${num}`;

    const bodyNodes = [];
    let sib = h2.nextSibling;
    while (sib && !(sib.nodeType === 1 && sib.tagName === 'H2')) {
      const next = sib.nextSibling;
      bodyNodes.push(sib);
      sib = next;
    }

    const section = document.createElement('section');
    section.className = 'guide-section';
    section.id = id;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'guide-section-toggle';
    btn.innerHTML =
      `<span class="guide-section-arrow">▶</span>` +
      `<span class="guide-section-num">${num}.</span> ` +
      `<span class="guide-section-title">${h2.textContent}</span>`;
    btn.addEventListener('click', () => section.classList.toggle('open'));

    const body = document.createElement('div');
    body.className = 'guide-section-body';
    bodyNodes.forEach(n => body.appendChild(n));

    section.appendChild(btn);
    section.appendChild(body);
    h2.replaceWith(section);

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${id}`;
    a.textContent = h2.textContent;
    a.addEventListener('click', e => {
      e.preventDefault();
      section.classList.add('open');
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${id}`);
    });
    li.appendChild(a);
    tocList.appendChild(li);
  });

  // Si la URL trae un hash de misión, abrirla y saltar directo
  if (location.hash) {
    const target = container.querySelector(location.hash);
    if (target && target.classList.contains('guide-section')) {
      target.classList.add('open');
      setTimeout(() => target.scrollIntoView({ block: 'start' }), 50);
    }
  }
}
