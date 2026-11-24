// Grafo das conexões: cada palavra aceita vira um nó pendurado em quem ela encaixou.
// Simulação simples de molas, gravidade e repulsão, desenhada em SVG, sem dependências.

const SVG = "http://www.w3.org/2000/svg";
const GRAVIDADE = 0.14;
const AMORTECIMENTO = 0.86;
const MOLA = 0.04;
const COMPRIMENTO = 92;
const FOLGA = 22;
const REPULSAO = 6;
const CENTRO = 0.0008;
const MARGEM = 14;
const TOPO = 46;
const ALTURA_MINIMA = 230;
const ALTURA_MAXIMA = 600;
const FONTE_NO = '650 13px "DM Sans", system-ui, sans-serif';
const FONTE_ANCORA = '700 14px "DM Sans", system-ui, sans-serif';
const reduzido = matchMedia("(prefers-reduced-motion: reduce)");

function elemento(nome, atributos = {}) {
  const no = document.createElementNS(SVG, nome);
  for (const [chave, valor] of Object.entries(atributos)) no.setAttribute(chave, valor);
  return no;
}

function aleatorio(amplitude) {
  return (Math.random() - 0.5) * 2 * amplitude;
}

export function criarGrafo(svg, { similaridade, limiar, maiuscula }) {
  const camadaArestas = elemento("g", { class: "graph-edges" });
  const camadaNos = elemento("g", { class: "graph-nodes" });
  const camadaFantasmas = elemento("g", { class: "graph-ghosts" });
  const vazio = elemento("text", { class: "graph-empty", "text-anchor": "middle" });
  vazio.textContent = "As palavras que encaixarem vão pendurar aqui.";
  svg.append(camadaArestas, camadaNos, camadaFantasmas, vazio);

  const medidor = document.createElement("canvas").getContext("2d");
  const nos = new Map();
  const arestas = new Map();
  const fantasmas = [];
  let largura = 600;
  const altura = ALTURA_MAXIMA;
  let ponte = null;
  let quadro = null;
  let arrastando = null;

  function medir(texto, fonte) {
    medidor.font = fonte;
    return Math.ceil(medidor.measureText(texto).width) + 26;
  }

  function posicaoAncora(no, lado) {
    no.x = lado === "start" ? MARGEM + no.w / 2 : largura - MARGEM - no.w / 2;
    no.y = TOPO;
  }

  function criarNo(palavra, papel, origem) {
    const ancora = papel !== "word";
    const rotulo = maiuscula(palavra);
    const no = {
      palavra, papel, ancora, fixo: ancora,
      w: medir(rotulo, ancora ? FONTE_ANCORA : FONTE_NO), h: ancora ? 36 : 30,
      x: 0, y: 0, vx: 0, vy: 0, profundidade: 0,
    };
    if (ancora) {
      posicaoAncora(no, papel);
    } else {
      no.x = origem.x + aleatorio(26);
      no.y = origem.y + 44;
      no.profundidade = origem.profundidade + 1;
    }
    no.g = elemento("g", { class: `graph-node is-${papel}`, "data-no": palavra });
    no.g.append(
      elemento("rect", { rx: no.h / 2, ry: no.h / 2, width: no.w, height: no.h }),
      elemento("text", { x: no.w / 2, y: no.h / 2 + 1, "text-anchor": "middle", "dominant-baseline": "central" }),
    );
    no.g.lastChild.textContent = rotulo;
    if (ancora) {
      const etiqueta = elemento("text", { class: `graph-bank is-${papel}`, x: no.w / 2, y: -10, "text-anchor": "middle" });
      etiqueta.textContent = papel === "start" ? "Saída" : "Chegada";
      no.g.append(etiqueta);
    }
    camadaNos.append(no.g);
    nos.set(palavra, no);
    return no;
  }

  function criarAresta(a, b) {
    const chave = [a.palavra, b.palavra].sort().join("|");
    if (arestas.has(chave)) return;
    const cosseno = similaridade(a.palavra, b.palavra);
    const corte = limiar();
    const forca = Math.min(1, Math.max(0, (cosseno - corte) / (1 - corte)));
    const linha = elemento("line", { class: "graph-edge", "stroke-width": (1.4 + forca * 2.8).toFixed(2) });
    const titulo = elemento("title");
    titulo.textContent = `${maiuscula(a.palavra)} ↔ ${maiuscula(b.palavra)} · similaridade ${cosseno.toFixed(2).replace(".", ",")}`;
    linha.append(titulo);
    camadaArestas.append(linha);
    arestas.set(chave, { a, b, linha });
  }

  function passo() {
    const lista = [...nos.values()];
    for (const no of lista) {
      if (no.fixo) continue;
      no.vy += GRAVIDADE;
      no.vx += (largura / 2 - no.x) * CENTRO;
    }
    for (const { a, b } of arestas.values()) {
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const distancia = Math.hypot(dx, dy) || 1;
      const forca = MOLA * (distancia - COMPRIMENTO);
      dx /= distancia;
      dy /= distancia;
      if (!a.fixo) { a.vx += forca * dx; a.vy += forca * dy; }
      if (!b.fixo) { b.vx -= forca * dx; b.vy -= forca * dy; }
    }
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i];
        const b = lista[j];
        const alcanceX = (a.w + b.w) / 2 + FOLGA;
        const alcanceY = (a.h + b.h) / 2 + FOLGA;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        if (Math.abs(dx) >= alcanceX || Math.abs(dy) >= alcanceY) continue;
        if (dx === 0 && dy === 0) { dx = aleatorio(1) || 0.5; dy = 1; }
        const proximidade = Math.hypot(dx / alcanceX, dy / alcanceY);
        if (proximidade >= 1) continue;
        const empurrao = (1 - proximidade) * REPULSAO;
        const norma = Math.hypot(dx, dy) || 1;
        const fx = dx / norma * empurrao;
        const fy = dy / norma * empurrao;
        if (!a.fixo) { a.vx -= fx; a.vy -= fy; }
        if (!b.fixo) { b.vx += fx; b.vy += fy; }
      }
    }
    let energia = 0;
    for (const no of lista) {
      if (no.fixo) continue;
      no.vx *= AMORTECIMENTO;
      no.vy *= AMORTECIMENTO;
      no.x += no.vx;
      no.y += no.vy;
      const minX = MARGEM + no.w / 2;
      const maxX = largura - MARGEM - no.w / 2;
      const minY = TOPO + no.h;
      const maxY = altura - MARGEM - no.h / 2;
      if (no.x < minX) { no.x = minX; no.vx = 0; }
      if (no.x > maxX) { no.x = maxX; no.vx = 0; }
      if (no.y < minY) { no.y = minY; no.vy = 0; }
      if (no.y > maxY) { no.y = maxY; no.vy *= -0.2; }
      energia += no.vx * no.vx + no.vy * no.vy;
    }
    return energia;
  }

  function animarFantasmas() {
    for (let i = fantasmas.length - 1; i >= 0; i--) {
      const fantasma = fantasmas[i];
      fantasma.vy += GRAVIDADE * 1.3;
      fantasma.x += fantasma.vx;
      fantasma.y += fantasma.vy;
      fantasma.alpha -= 0.02;
      if (fantasma.alpha <= 0 || fantasma.y > altura + 40) {
        fantasma.g.remove();
        fantasmas.splice(i, 1);
        continue;
      }
      fantasma.g.setAttribute("opacity", fantasma.alpha.toFixed(2));
      fantasma.g.setAttribute("transform", `translate(${fantasma.x - fantasma.w / 2} ${fantasma.y - 15}) rotate(${(1 - fantasma.alpha) * 14})`);
    }
  }

  function desenhar() {
    for (const no of nos.values()) {
      no.g.setAttribute("transform", `translate(${(no.x - no.w / 2).toFixed(1)} ${(no.y - no.h / 2).toFixed(1)})`);
    }
    for (const { a, b, linha } of arestas.values()) {
      linha.setAttribute("x1", a.x.toFixed(1));
      linha.setAttribute("y1", a.y.toFixed(1));
      linha.setAttribute("x2", b.x.toFixed(1));
      linha.setAttribute("y2", b.y.toFixed(1));
    }
  }

  let quadros = 0;

  function animar() {
    const energia = passo();
    animarFantasmas();
    desenhar();
    if (++quadros % 12 === 0) ajustarAltura();
    const ativo = energia > 0.03 || fantasmas.length || arrastando;
    quadro = ativo ? requestAnimationFrame(animar) : null;
    if (!ativo) ajustarAltura();
  }

  function acordar() {
    if (reduzido.matches) {
      assentar(240);
      desenhar();
      ajustarAltura();
      return;
    }
    quadro ??= requestAnimationFrame(animar);
  }

  function assentar(passos) {
    for (let i = 0; i < passos; i++) passo();
  }

  // A altura visível acompanha onde as palavras estão; a física usa um piso mais folgado.
  function ajustarAltura() {
    const fundo = Math.max(0, ...[...nos.values()].filter(no => !no.ancora).map(no => no.y + no.h / 2));
    const visivel = nos.size > 2 ? Math.min(ALTURA_MAXIMA, Math.max(ALTURA_MINIMA, fundo + 34)) : ALTURA_MINIMA;
    svg.style.height = `${visivel}px`;
    vazio.setAttribute("x", largura / 2);
    vazio.setAttribute("y", ALTURA_MINIMA / 2 + 18);
  }

  function marcarPonte() {
    const caminho = new Set(ponte ?? []);
    const pares = new Set();
    if (ponte) for (let i = 1; i < ponte.length; i++) pares.add([ponte[i - 1], ponte[i]].sort().join("|"));
    for (const no of nos.values()) no.g.classList.toggle("on-path", caminho.has(no.palavra));
    for (const [chave, { linha }] of arestas) linha.classList.toggle("on-path", pares.has(chave));
    svg.classList.toggle("is-complete", Boolean(ponte));
  }

  function reiniciar() {
    camadaArestas.replaceChildren();
    camadaNos.replaceChildren();
    camadaFantasmas.replaceChildren();
    nos.clear();
    arestas.clear();
    fantasmas.length = 0;
    ponte = null;
    arrastando = null;
  }

  function sincronizar(partida, rotulo) {
    const [inicio, fim] = partida.lados.map(lado => lado[0].palavra);
    if (!nos.has(inicio) || !nos.has(fim) || nos.get(inicio).papel !== "start") reiniciar();
    nos.get(inicio) ?? criarNo(inicio, "start");
    nos.get(fim) ?? criarNo(fim, "end");
    let novos = 0;
    for (const { palavra, conexoes } of partida.tentativas) {
      if (!conexoes.length) continue;
      let no = nos.get(palavra);
      if (!no) {
        const vizinhos = conexoes.map(vizinha => nos.get(vizinha)).filter(Boolean);
        const origem = vizinhos.reduce((perto, atual) => atual.profundidade < perto.profundidade ? atual : perto, vizinhos[0]);
        no = criarNo(palavra, "word", origem);
        novos++;
      }
      for (const vizinha of conexoes) {
        const outro = nos.get(vizinha);
        if (outro) criarAresta(outro, no);
      }
    }
    ponte = partida.ponte;
    marcarPonte();
    ajustarAltura();
    vazio.classList.toggle("is-hidden", nos.size > 2);
    svg.setAttribute("aria-label", rotulo);
    if (novos > 1) assentar(220);
    desenhar();
    acordar();
  }

  function rejeitar(palavra) {
    if (reduzido.matches) return;
    const w = medir(maiuscula(palavra), FONTE_NO);
    const g = elemento("g", { class: "graph-node is-ghost" });
    g.append(elemento("rect", { rx: 15, ry: 15, width: w, height: 30 }), elemento("text", { x: w / 2, y: 16, "text-anchor": "middle", "dominant-baseline": "central" }));
    g.lastChild.textContent = maiuscula(palavra);
    camadaFantasmas.append(g);
    fantasmas.push({ g, w, x: largura / 2 + aleatorio(50), y: TOPO - 10, vx: aleatorio(1.2), vy: -1.6, alpha: 1 });
    acordar();
  }

  function redimensionar(novaLargura) {
    if (!novaLargura || Math.abs(novaLargura - largura) < 1) return;
    largura = novaLargura;
    for (const no of nos.values()) if (no.ancora) posicaoAncora(no, no.papel);
    vazio.setAttribute("x", largura / 2);
    desenhar();
    acordar();
  }

  new ResizeObserver(([{ contentRect }]) => redimensionar(contentRect.width)).observe(svg);

  function coordenadas(evento) {
    const caixa = svg.getBoundingClientRect();
    return { x: evento.clientX - caixa.left, y: evento.clientY - caixa.top };
  }

  svg.addEventListener("pointerdown", evento => {
    const alvo = evento.target.closest("[data-no]");
    const no = alvo && nos.get(alvo.dataset.no);
    if (!no || no.ancora) return;
    evento.preventDefault();
    arrastando = no;
    no.fixo = true;
    no.g.classList.add("is-dragging");
    svg.setPointerCapture(evento.pointerId);
    acordar();
  });
  svg.addEventListener("pointermove", evento => {
    if (!arrastando) return;
    const { x, y } = coordenadas(evento);
    arrastando.x = Math.min(largura - MARGEM, Math.max(MARGEM, x));
    arrastando.y = Math.min(altura - MARGEM, Math.max(TOPO, y));
    arrastando.vx = arrastando.vy = 0;
    if (reduzido.matches) desenhar();
  });
  const soltar = () => {
    if (!arrastando) return;
    arrastando.fixo = false;
    arrastando.g.classList.remove("is-dragging");
    arrastando = null;
    acordar();
  };
  svg.addEventListener("pointerup", soltar);
  svg.addEventListener("pointercancel", soltar);

  return { sincronizar, rejeitar, reiniciar };
}
