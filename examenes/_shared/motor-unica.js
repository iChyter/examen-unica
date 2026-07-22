/* motor-unica.js
 * Componente compartido para los simulacros UNICA (Area C: Ingenieria).
 *
 * API expuesta como window.exUnica. Requiere en cada HTML:
 *   1. Tailwind (CDN) y la misma config de color "unica-*".
 *   2. Estructura de ids ya presente en los HTML originales:
 *      - #questions-container        (donde se pinta cada pregunta)
 *      - #question-grid              (navegador lateral 5 columnas)
 *      - #results-modal, #solucionario-container, #solucionario-list
 *      - stat-answered, stat-flagged, stat-blank
 *      - res-score-100, res-score-20, res-condition-text, res-buenas, res-malas, res-vacias
 *      - career-select
 *   3. Una variable global `questionsDB` con el mismo formato que qs_phase1.json del examen 4.
 *
 * Uso:
 *   <script src="../_shared/motor-unica.js"></script>
 *   <script> window.exUnica.bind({ storageKey: 'unica_exam_2026_3', title: 'Examen 3' }); </script>
 *
 * Side effects: añade el modal de feedback IA y la columna "Raras" al sidebar,
 * sobreescribe updateCardStyle / updateStats para reflejar el set rareQuestions,
 * y expone window.toggleRare().
 */

(function () {
  const ICONS = {
    doubt:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path d="M12 2 1.5 21h21L12 2Zm0 6.5L18.5 19h-13L12 8.5Zm-.75 3.25v3.5h1.5v-3.5h-1.5Zm0 4.5v1.5h1.5v-1.5h-1.5Z"/></svg>',
    rare:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.75 5.5a.75.75 0 0 0-1.5 0v6.25c0 .41.34.75.75.75h4.25a.75.75 0 0 0 0-1.5h-3.5V7.5Z"/></svg>'
  };

  const state = {
    cfg: null,
    rare: new Set(),
    flagged: new Set(),
    answers: {},
    lastFeedbackHTML: ''
  };

  function storageKey(suffix, cfg) {
    return (cfg.storageKey || 'unica_exam') + (suffix || '');
  }

  function loadFromStorage(cfg) {
    try {
      const raw = localStorage.getItem(storageKey('', cfg));
      if (raw) {
        const data = JSON.parse(raw);
        state.answers = data.answers || {};
        state.flagged = new Set(data.flagged || []);
        state.rare = new Set(data.rare || []);
      }
      const rareKey = cfg.rareStorageKey || (cfg.storageKey + '_rare');
      const rareRaw = localStorage.getItem(rareKey);
      if (rareRaw) {
        const a = JSON.parse(rareRaw);
        if (Array.isArray(a)) state.rare = new Set(a);
      }
      for (const id in state.answers) {
        const r = document.querySelector(`input[name="q_${id}"][value="${state.answers[id]}"]`);
        if (r) r.checked = true;
      }
      if (window.flaggedQuestions && state.flagged.size) {
        for (const id of state.flagged) window.flaggedQuestions.add(parseInt(id, 10));
      }
    } catch {}
  }

  function saveToStorage(cfg) {
    const rareKey = cfg.rareStorageKey || (cfg.storageKey + '_rare');
    try {
      localStorage.setItem(rareKey, JSON.stringify([...state.rare]));
    } catch {}
  }

  /* Sobrescribe el helper de marcado de duda existente (si existe) y registra rare. */
  function flagBtnClass(active) {
    return active
      ? 'w-8 h-8 rounded-lg border border-amber-400 bg-amber-400 text-amber-900 flex items-center justify-center transition-all shadow-sm'
      : 'w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600 flex items-center justify-center transition-all';
  }
  function rareBtnClass(active) {
    return active
      ? 'w-8 h-8 rounded-lg border border-rose-500 bg-rose-500 text-white flex items-center justify-center transition-all shadow-sm'
      : 'w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 flex items-center justify-center transition-all';
  }

  function ensureRareBadge(qId, isRare) {
    const head = document.querySelector(`#q-card-${qId} > div.flex`);
    if (!head) return;
    let badge = document.getElementById(`q-rare-badge-${qId}`);
    if (isRare) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = `q-rare-badge-${qId}`;
        badge.className = 'ml-2 bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-200';
        badge.textContent = '⚠ RARA';
        const leftSide = head.querySelector(':scope > div');
        if (leftSide) leftSide.appendChild(badge);
      }
    } else if (badge) {
      badge.remove();
    }
  }

  function applyCardStyle(qId, cfg) {
    const card = document.getElementById(`q-card-${qId}`);
    const flagBtn = document.getElementById(`flag-btn-${qId}`);
    const rareBtn = document.getElementById(`rare-btn-${qId}`);
    if (!card) return;
    const isAnswered = !!state.answers[qId];
    const isFlagged = state.flagged.has(qId);
    const isRare = state.rare.has(qId);

    if (flagBtn) flagBtn.className = flagBtnClass(isFlagged);
    if (rareBtn) rareBtn.className = rareBtnClass(isRare);
    ensureRareBadge(qId, isRare);

    if (isFlagged) {
      card.className = 'bg-amber-50/30 rounded-2xl p-5 sm:p-6 shadow-sm border-2 border-amber-400 relative transition-all';
    } else if (isRare) {
      card.className = 'bg-rose-50/30 rounded-2xl p-5 sm:p-6 shadow-sm border-2 border-rose-400 relative transition-all';
    } else if (isAnswered) {
      card.className = 'bg-white rounded-2xl p-5 sm:p-6 shadow-sm border-2 border-unica-600 relative transition-all';
    } else {
      card.className = 'bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 transition-all hover:border-slate-300 relative';
    }

    const grid = document.getElementById(`grid-btn-${qId}`);
    if (grid) {
      grid.className = isFlagged
        ? 'h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all bg-amber-400 text-slate-950 shadow-sm border border-amber-500'
        : isRare
        ? 'h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all bg-rose-500 text-white shadow-sm border border-rose-600'
        : isAnswered
        ? 'h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all bg-unica-600 text-white shadow-sm border border-unica-700'
        : 'h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200';
    }
  }

  function updateStats() {
    const answered = Object.keys(state.answers).length;
    const setText = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    setText('stat-answered', answered);
    setText('stat-flagged', state.flagged.size);
    setText('stat-blank', 100 - answered);
    setText('stat-rare', state.rare.size);
    setText('answered-count-bottom', answered);
  }

  /* Hooks de pregunta: reescribimos onclick "toggleFlag" si el HTML original ya lo trae,
   * y montamos un listener delegado para interceptar todos los clicks a buttons .toggle-rare.
   *
   * Si el HTML tiene `window.flaggedQuestions` y `window.toggleFlag`, sincronizamos ambos sets.
   * Si no, los construimos nosotros. */
  function hookCardActions(cfg) {
    if (window.flaggedQuestions && window.toggleFlag) {
      const orig = window.toggleFlag;
      window.toggleFlag = function (qId) {
        orig(qId);
        if (window.flaggedQuestions.has(qId)) state.flagged.add(qId); else state.flagged.delete(qId);
        updateStats();
        applyCardStyle(qId, cfg);
      };
    }

    document.addEventListener('click', function (e) {
      const rareBtn = e.target.closest('.toggle-rare');
      if (rareBtn) {
        const qId = parseInt(rareBtn.dataset.qid, 10);
        if (state.rare.has(qId)) state.rare.delete(qId); else state.rare.add(qId);
        saveToStorage(cfg);
        updateStats();
        applyCardStyle(qId, cfg);
      }
      const fbBtn = e.target.closest('[data-feedback-open]');
      if (fbBtn) openFeedbackPreview(cfg);
      const fbCopy = e.target.closest('[data-feedback-copy]');
      if (fbCopy) copyFeedbackHTML();
      const fbDl = e.target.closest('[data-feedback-download]');
      if (fbDl) downloadCurrentFeedback(cfg);
      const fbClose = e.target.closest('[data-feedback-close]');
      if (fbClose) document.getElementById('feedback-modal').classList.add('hidden');
    });
  }

  /* Reemplaza los botones de duda/rara en cada card renderizado. Si no existe toggleFlag
   * (HTML sin hooks), instalamos también window.toggleFlag para que onclick lo use. */
  function upgradeCardButtons(cfg) {
    const cards = document.querySelectorAll('[id^="q-card-"]');
    cards.forEach(card => {
      const qId = parseInt(card.id.replace('q-card-', ''), 10);
      const head = card.querySelector('div.flex.items-center.justify-between');
      if (!head) return;
      if (document.getElementById(`rare-btn-${qId}`)) return; // ya inyectado
      const btns = document.createElement('div');
      btns.className = 'flex items-center gap-2';
      btns.innerHTML =
        `<button type="button" class="toggle-rare" data-qid="${qId}" id="rare-btn-${qId}" title="Marcar como pregunta rara — enunciado confuso, mal OCR, gráfico faltante o símbolos raros" aria-label="Pregunta rara" class="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 flex items-center justify-center transition-all">${ICONS.rare}</button>`;
      head.appendChild(btns);
    });
    // actualizar estados visuales tras el upgrade
    cards.forEach(card => {
      const qId = parseInt(card.id.replace('q-card-', ''), 10);
      applyCardStyle(qId, cfg);
    });
  }

  function upgradeSidebar(cfg) {
    const statBox = document.getElementById('stat-flagged')?.parentElement?.parentElement;
    if (!statBox) return;
    if (document.getElementById('stat-rare')) return;
    statBox.classList.remove('grid-cols-3');
    statBox.classList.add('grid-cols-4');
    const rareTile = document.createElement('div');
    rareTile.className = 'p-2 bg-rose-50 rounded-xl border border-rose-200';
    rareTile.innerHTML =
      `<div id="stat-rare" class="text-base font-extrabold text-rose-700">0</div><div class="text-[10px] text-rose-600 font-semibold">Raras</div>`;
    const blankTile = statBox.querySelector('#stat-blank').parentElement;
    statBox.insertBefore(rareTile, blankTile);
  }

  /* ===== FEEDBACK HTML (sin dependencias) ===== */

  function escTxt(s) {
    return String(s == null ? '' : s)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, '');
  }
  function escHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function downloadBlob(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildFeedbackHTML(cfg) {
    if (!window.questionsDB) return '<p>No hay preguntas cargadas.</p>';
    const total = questionsDB.length;
    let buenas = 0, malas = 0, blancas = 0;
    for (const q of questionsDB) {
      const v = state.answers[q.id];
      if (!v) blancas++;
      else if (v === q.correct) buenas++;
      else malas++;
    }
    const score = document.getElementById('res-score-100')?.textContent || '0';
    const nota  = document.getElementById('res-score-20')?.textContent  || '0';
    const cond  = document.getElementById('res-condition-text')?.textContent  || '';
    const career = (document.getElementById('career-select')?.value) || '(sin seleccionar)';
    const fecha = new Date().toLocaleString('es-PE');

    const secStats = {}, catStats = {};
    for (const q of questionsDB) {
      const v = state.answers[q.id];
      const ok = v === q.correct, blank = !v;
      secStats[q.sec] = secStats[q.sec] || { title: q.secTitle, b: 0, m: 0, w: 0, total: 0 };
      secStats[q.sec].total++;
      if (blank) secStats[q.sec].w++; else if (ok) secStats[q.sec].b++; else secStats[q.sec].m++;

      const catKey = q.sec + '||' + q.cat;
      catStats[catKey] = catStats[catKey] || { secTitle: q.secTitle, cat: q.cat, b: 0, m: 0, w: 0, total: 0, errors: [], blanks: [] };
      catStats[catKey].total++;
      if (blank) { catStats[catKey].w++; catStats[catKey].blanks.push(q.id); }
      else if (ok) catStats[catKey].b++;
      else { catStats[catKey].m++; catStats[catKey].errors.push(q.id); }
    }
    const catOrder = Object.values(catStats).sort((a, b) => {
      const ea = a.m / a.total, eb = b.m / b.total;
      if (eb !== ea) return eb - ea;
      return (b.w / b.total) - (a.w / a.total);
    });
    const lost = questionsDB.filter(q => state.answers[q.id] && state.answers[q.id] !== q.correct);
    const untouched = questionsDB.filter(q => !state.answers[q.id]);

    const secRows = Object.values(secStats).map(s => {
      const acc = (s.b / s.total) * 100;
      return `<tr><td>${escHTML(s.title)}</td><td class="num">${s.total}</td><td class="num ok">${s.b}</td><td class="num bad">${s.m}</td><td class="num mute">${s.w}</td><td class="num">${acc.toFixed(1)}%</td></tr>`;
    }).join('');
    const catRows = catOrder.map(c => {
      const errPct = (c.m / c.total) * 100, blanksPct = (c.w / c.total) * 100;
      const cls = (c.m / c.total) > 0.3 ? 'class="hot"' : (c.m / c.total) > 0.1 ? '' : 'class="cold"';
      return `<tr ${cls}><td>${escHTML(c.cat)}</td><td>${escHTML(c.secTitle)}</td><td class="num">${c.total}</td><td class="num ok">${c.b}</td><td class="num bad">${c.m}</td><td class="num mute">${c.w}</td><td class="num">${errPct.toFixed(1)}% err · ${blanksPct.toFixed(1)}% blanco</td></tr>`;
    }).join('');
    const lostItems = lost.length ? lost.map(q => {
      const v = state.answers[q.id];
      return `<li><strong>P${q.id}</strong> <span class="tag">${escHTML(q.cat)}</span> <span class="tag sec">${escHTML(q.secTitle)}</span> — respondiste <strong class="bad">${v}</strong>, clave <strong class="ok">${q.correct}</strong>. <em>${escHTML(escTxt(q.text)).slice(0, 220)}…</em></li>`;
    }).join('') : '<li><em>No tuviste errores.</em></li>';
    const blankItems = untouched.length ? untouched.map(q =>
      `<li><strong>P${q.id}</strong> <span class="tag">${escHTML(q.cat)}</span> <span class="tag sec">${escHTML(q.secTitle)}</span> — en blanco. <em>${escHTML(escTxt(q.text)).slice(0, 220)}…</em></li>`
    ).join('') : '<li><em>Respondiste todas.</em></li>';
    const rareOrdered = [...state.rare].sort((a, b) => a - b);
    const rareItems = rareOrdered.length ? rareOrdered.map(id => {
      const q = questionsDB.find(q => q.id === id);
      if (!q) return '';
      const v = state.answers[id];
      return `<li><strong>P${id}</strong> <span class="tag sec">${escHTML(q.secTitle)}</span> <span class="tag">${escHTML(q.cat)}</span> — ${v ? `respondiste <strong>${v}</strong>, clave <strong class="ok">${q.correct}</strong>.` : '<span class="mute">en blanco.</span>'} <em>${escHTML(escTxt(q.text)).slice(0, 220)}…</em></li>`;
    }).join('') : '<li><em>No marcaste ninguna pregunta como rara.</em></li>';
    const studyItems = catOrder.slice(0, 12).map(c => {
      const pct = ((c.m + c.w) / c.total) * 100;
      return `<li><strong>${escHTML(c.cat)}</strong> <span class="tag sec">${escHTML(c.secTitle)}</span> — fallaste ${c.m}/${c.total}, blanco ${c.w}/${c.total} (≈${pct.toFixed(0)}% a reforzar).</li>`;
    }).join('');
    const respRows = Array.from({ length: total }, (_, i) => i + 1).map(i => {
      const v = state.answers[i];
      const q = questionsDB.find(q => q.id === i);
      const cls = !v ? 'class="mute"' : (v === q.correct ? 'class="ok"' : 'class="bad"');
      const sym = !v ? '⬜' : (v === q.correct ? '✅' : '❌');
      return `<tr ${cls}><td class="num">${i}</td><td>${v || '—'}</td><td>${q.correct}</td><td>${sym}</td><td>${escHTML(q.cat)}</td></tr>`;
    }).join('');
    const qBlocks = questionsDB.map(q => {
      const v = state.answers[q.id];
      const status = !v ? 'blank' : (v === q.correct ? 'ok' : 'bad');
      const statusIcon = !v ? '⬜' : (v === q.correct ? '✅' : '❌');
      const opts = q.options.map((o, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const isCorrect = letter === q.correct;
        const isPicked = letter === v && !isCorrect;
        return `<li class="${isCorrect ? 'correct' : ''} ${isPicked ? 'picked' : ''}"><span class="letter">${letter}</span> ${escHTML(o)}${isCorrect ? ' <span class="ok-mark">✓ clave</span>' : ''}</li>`;
      }).join('');
      return `<article class="q ${status}" id="q-${q.id}">
        <header>
          <span class="qid">P${q.id}</span>
          <span class="tag">${escHTML(q.cat)}</span>
          <span class="tag sec">${escHTML(q.secTitle)}</span>
          ${state.rare.has(q.id) ? '<span class="tag rare-tag">⚠ RARA</span>' : ''}
          <span class="status">${statusIcon}</span>
        </header>
        <p class="enunciado">${escHTML(escTxt(q.text))}</p>
        <ol class="alternativas">${opts}</ol>
        <footer><span>Tu respuesta: <strong class="${status === 'ok' ? 'ok' : (status === 'bad' ? 'bad' : 'mute')}">${v || '— (en blanco)'}</strong></span><span>Clave oficial: <strong class="ok">${q.correct}</strong></span></footer>
      </article>`;
    }).join('');

    const css = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font: 14px/1.55 system-ui, -apple-system, "Segoe UI", Inter, sans-serif; color: #0f172a; background: #f1f5f9; margin: 0; padding: 24px; }
    main { max-width: 1080px; margin: 0 auto; }
    h1 { font-size: 26px; margin: 0 0 8px; letter-spacing: -.02em; }
    h2 { font-size: 18px; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; }
    h3 { font-size: 15px; margin: 18px 0 6px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 20px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); gap: 10px; margin: 14px 0; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
    .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }
    .card .value { font-size: 22px; font-weight: 800; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(15,23,42,.06); }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #475569; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    tr.hot td { background: #fef2f2; } tr.cold td { background: #f0fdf4; }
    .ok { color: #047857; } .bad { color: #b91c1c; } .mute { color: #94a3b8; }
    ul.fb-list { padding-left: 18px; } ul.fb-list li { margin: 6px 0; }
    .tag { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #eff6ff; color: #1d4ed8; margin-left: 4px; }
    .tag.sec { background: #f1f5f9; color: #334155; }
    .tag.rare-tag { background: #fee2e2; color: #b91c1c; }
    .ia-prompt { background: #fff7ed; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 0 12px 12px 0; margin-top: 8px; font-size: 13px; }
    .q { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin: 16px 0; }
    .q.ok { border-left: 4px solid #10b981; } .q.bad { border-left: 4px solid #ef4444; } .q.blank { border-left: 4px solid #cbd5e1; }
    .q header { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
    .qid { font-weight: 800; background: #0f172a; color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 12px; }
    .q .status { margin-left: auto; font-size: 18px; }
    .enunciado { margin: 6px 0 10px; }
    ol.alternativas { list-style: none; padding: 0; margin: 0; display: grid; gap: 4px; }
    ol.alternativas li { padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-size: 13px; }
    ol.alternativas li.correct { background: #ecfdf5; border-color: #10b981; }
    ol.alternativas li.picked { background: #fef2f2; border-color: #ef4444; }
    ol.alternativas .letter { font-weight: 700; color: #475569; margin-right: 6px; font-family: ui-monospace, monospace; }
    .ok-mark { font-size: 11px; color: #047857; font-weight: 700; }
    .q footer { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #475569; border-top: 1px dashed #e2e8f0; padding-top: 8px; }
    `;

    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Feedback ${escHTML(cfg.title || 'Examen UNICA')}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head>
<body><main>
<h1>Feedback ${escHTML(cfg.title || 'Examen Real UNICA')}</h1>
<div class="meta">Generado el ${escHTML(fecha)} · Carrera objetivo: <strong>${escHTML(career)}</strong></div>

<div class="summary">
  <div class="card"><div class="label">Puntaje crudo</div><div class="value">${escHTML(score)} / 100</div></div>
  <div class="card"><div class="label">Nota vigesimal</div><div class="value">${escHTML(nota)} / 20</div></div>
  <div class="card"><div class="label">Veredicto</div><div class="value">${escHTML(cond)}</div></div>
  <div class="card"><div class="label">Buenas / Malas / Blanco</div><div class="value"><span class="ok">${buenas}</span> · <span class="bad">${malas}</span> · <span class="mute">${blancas}</span></div></div>
</div>

<div class="ia-prompt"><strong>Fórmula UNICA</strong>: Puntaje = B + M/3·(−1) + V/16. Cada error resta lo mismo que ~5 vacías te aportan; si no descartas 3 opciones, deja en blanco.</div>

<h2>1) Rendimiento por bloque</h2>
<table><thead><tr><th>Bloque</th><th class="num">Total</th><th class="num">✅</th><th class="num">❌</th><th class="num">⬜</th><th class="num">Aciertos</th></tr></thead><tbody>${secRows}</tbody></table>

<h2>2) Rendimiento por tema (ordenado por % de error)</h2>
<table><thead><tr><th>Tema</th><th>Sección</th><th class="num">Total</th><th class="num">✅</th><th class="num">❌</th><th class="num">⬜</th><th class="num">% (err · blanco)</th></tr></thead><tbody>${catRows}</tbody></table>

<h2>3) ¿Dónde te equivocaste? (${lost.length} fallos)</h2>
<ul class="fb-list">${lostItems}</ul>

<h2>4) ¿Dónde ni siquiera respondiste? (${untouched.length} en blanco)</h2>
<ul class="fb-list">${blankItems}</ul>

<h2>5) Plan de estudio sugerido (priorizado)</h2>
<ul class="fb-list">${studyItems}</ul>

<h2>6) Mis respuestas vs clave (resumen)</h2>
<table><thead><tr><th class="num">#</th><th>Mi respuesta</th><th>Clave</th><th>Resultado</th><th>Tema</th></tr></thead><tbody>${respRows}</tbody></table>

<h2>7) Examen completo (texto · alternativas · clave)</h2>
${qBlocks}

<h2>8) Preguntas marcadas como "raras" (${rareOrdered.length})</h2>
<ul class="fb-list">${rareItems}</ul>

<div class="ia-prompt">
  <strong>Indicaciones para la IA</strong><br>
  Eres mi tutor del examen UNICA. Con este HTML:
  <ol>
    <li><strong>Diagnostica mis brechas</strong> (sección 3 y 4): por qué fallé / dejé en blanco cada pregunta y qué concepto me faltaba.</li>
    <li><strong>Plan de estudio semanal</strong> (sección 2 y 5): cronograma de 2 semanas.</li>
    <li><strong>Microlecciones</strong>: por cada tema con ≥ 30% de error, un ejemplo resuelto paso a paso estilo PRE-UNICA.</li>
    <li><strong>Estrategia de examen</strong>: validación del filtro semáforo (B +1 / M −0.333 / V +0.0625) y estimación si convierto mis malas en blanco.</li>
    <li><strong>Carrera objetivo</strong>: <strong>${escHTML(career)}</strong>.</li>
    <li><strong>Preguntas raras</strong> (sección 8): reescribe cada una con notación correcta, propone el gráfico faltante, devuelve JSON <code>{id, fix_md, missing_figure, alternatives_fixed}</code>.</li>
  </ol>
  Responde en español, con foco en acción concreta.
</div>
</main></body></html>`;
  }

  function downloadCurrentFeedback(cfg) {
    if (!state.lastFeedbackHTML) return;
    const fname = (cfg.storageKey || 'feedback').replace(/[^a-z0-9_-]/gi, '_') + '.html';
    downloadBlob(fname, state.lastFeedbackHTML, 'text/html;charset=utf-8');
  }

  function copyFeedbackHTML() {
    if (!state.lastFeedbackHTML) return;
    const btn = document.getElementById('feedback-copy-btn');
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = state.lastFeedbackHTML; ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } finally { ta.remove(); }
    };
    const ok = () => {
      if (btn) {
        const t = btn.querySelector('span');
        const prev = t.textContent;
        t.textContent = '¡Copiado!';
        setTimeout(() => t.textContent = prev, 1500);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(state.lastFeedbackHTML).then(ok, () => { fallback(); ok(); });
    } else { fallback(); ok(); }
  }

  function ensureFeedbackModal() {
    if (document.getElementById('feedback-modal')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
<div id="feedback-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4 overflow-y-auto">
  <div class="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 p-6 sm:p-8 my-8 relative">
    <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 sticky top-0 bg-white z-10">
      <div>
        <h2 class="text-xl font-bold text-slate-900">Feedback para IA</h2>
        <p class="text-xs text-slate-500">HTML completo del examen. Cópialo y pégalo en tu IA favorita.</p>
      </div>
      <div class="flex gap-2">
        <button data-feedback-copy id="feedback-copy-btn" class="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-colors">
          <span>Copiar</span>
        </button>
        <button data-feedback-download class="bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-colors">
          <span>Descargar .html</span>
        </button>
        <button data-feedback-close class="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
    </div>
    <div id="feedback-preview" class="bg-slate-50 border border-slate-200 rounded-2xl p-2 text-slate-800"></div>
  </div>
</div>`;
    document.body.appendChild(wrap.firstElementChild);
  }

  function openFeedbackPreview(cfg) {
    state.lastFeedbackHTML = buildFeedbackHTML(cfg);
    const box = document.getElementById('feedback-preview');
    if (!box) return;
    box.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:70vh;border:0;border-radius:12px;background:#fff;';
    iframe.setAttribute('sandbox', 'allow-same-origin');
    box.appendChild(iframe);
    const idoc = iframe.contentDocument || iframe.contentWindow.document;
    idoc.open(); idoc.write(state.lastFeedbackHTML); idoc.close();
    document.getElementById('feedback-modal').classList.remove('hidden');
  }

  function addFeedbackButtonToResultsModal(cfg) {
    const results = document.getElementById('results-modal');
    if (!results) return;
    const bar = results.querySelector('.flex.gap-2');
    if (!bar || document.getElementById('open-feedback-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'open-feedback-btn';
    btn.className = 'bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition-colors';
    btn.innerHTML = '<span>Feedback para IA (.html)</span>';
    btn.onclick = () => openFeedbackPreview(cfg);
    bar.insertBefore(btn, bar.firstChild);
  }

  function applyAll(cfg) {
    for (const id in state.answers) {
      const r = document.querySelector(`input[name="q_${id}"][value="${state.answers[id]}"]`);
      if (r && !r.checked) r.checked = true;
    }
    upgradeCardButtons(cfg);
    upgradeSidebar(cfg);
    updateStats();
    addFeedbackButtonToResultsModal(cfg);
  }

  function bind(cfg) {
    state.cfg = cfg;
    ensureFeedbackModal();
    loadFromStorage(cfg);
    hookCardActions(cfg);

    const start = () => applyAll(cfg);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }

    window.toggleRare = function (qId) {
      if (state.rare.has(qId)) state.rare.delete(qId); else state.rare.add(qId);
      saveToStorage(cfg);
      updateStats();
      applyCardStyle(qId, cfg);
    };
  }

  window.exUnica = { bind };
})();
