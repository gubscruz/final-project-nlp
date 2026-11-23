import { hoje } from "./desafios.mjs";
import { gerarCaminhos, sortearCaminho } from "./infinito.mjs";
import { criarModelo, criarPartida, jogar, maiorCaminho } from "./jogo.mjs";

const porId = id => document.getElementById(id);
const maiuscula = palavra => palavra[0].toLocaleUpperCase("pt-BR") + palavra.slice(1);
const quantidade = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;
const chaveDiario = "travessia.progresso.v1";
const chaveInfinito = "travessia.infinito.v1";
const formulario = porId("formulario");
const campo = porId("palpite");
const retorno = porId("retorno");
const dica = porId("dica");
const botaoDica = porId("alternar-dica");
const dicaRotulo = botaoDica.querySelector("span");
const listaTentativas = porId("lista-tentativas");
const listaConexoes = porId("lista-conexoes");
const botoesModo = [...document.querySelectorAll("[data-modo]")];
const novaPonte = porId("nova-ponte");
const cronometro = porId("cronometro");
const tabuleiro = porId("tabuleiro");
const travessia = tabuleiro.querySelector(".crossing");
const palavrasTabuleiro = [porId("palavra-inicio"), porId("palavra-fim")];

let modelo;
let desafio;
let partida;
let termos;
let caminhos;

function lerProgresso(chave) {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave));
    return salvo && typeof salvo === "object" && !Array.isArray(salvo) ? salvo : {};
  } catch {
    return {};
  }
}

const progressoDiario = lerProgresso(chaveDiario);
const progressoInfinito = lerProgresso(chaveInfinito);
let modo = progressoInfinito.modo === "diario" ? "diario" : "infinito";

function gravarProgresso(chave, dados) {
  try {
    localStorage.setItem(chave, JSON.stringify(dados));
  } catch {
    // Preserva o progresso da aba quando o navegador bloqueia o armazenamento.
  }
}

function salvarProgresso() {
  const palpites = partida.tentativas.map(({ palavra }) => palavra);
  if (modo === "infinito") {
    progressoInfinito.palpites = palpites;
    gravarProgresso(chaveInfinito, progressoInfinito);
  } else {
    progressoDiario[desafio.chave] = { palpites, concluida: Boolean(partida.ponte) };
    gravarProgresso(chaveDiario, progressoDiario);
  }
}

function avisar(mensagem = "", tom = "neutro") {
  retorno.textContent = mensagem;
  retorno.dataset.tone = tom;
}

function mostrarDica(aberta) {
  botaoDica.setAttribute("aria-expanded", String(aberta));
  dicaRotulo.textContent = aberta ? "Ocultar dica" : "Ver dica";
  dica.hidden = !aberta;
}

function medirPalavra(texto) {
  const caixa = texto.parentElement;
  const estiloCaixa = getComputedStyle(caixa);
  const espaco = caixa.clientWidth - parseFloat(estiloCaixa.paddingLeft) - parseFloat(estiloCaixa.paddingRight) - 1;
  const largura = texto.getBoundingClientRect().width;
  const tamanho = parseFloat(getComputedStyle(texto).fontSize);
  const ajuste = largura > espaco ? tamanho * espaco / largura : tamanho;
  return { texto, tamanho, ajuste };
}

function ajustarPalavrasTabuleiro() {
  travessia.classList.remove("crossing--stacked");
  for (const texto of palavrasTabuleiro) texto.style.removeProperty("font-size");

  let medidas = palavrasTabuleiro.map(medirPalavra);
  const minimo = parseFloat(getComputedStyle(document.documentElement).fontSize) * .9375;
  if (medidas.some(({ ajuste }) => ajuste < minimo)) {
    travessia.classList.add("crossing--stacked");
    medidas = palavrasTabuleiro.map(medirPalavra);
  }
  for (const { texto, tamanho, ajuste } of medidas) {
    if (ajuste < tamanho) texto.style.fontSize = `${Math.floor(ajuste * 100) / 100}px`;
  }
}

function mensagemDaTentativa({ palavra, tipo, conexoes }) {
  switch (tipo) {
    case "invalida": return "Uma palavra por vez, só com letras.";
    case "desconhecida": return `“${palavra}” ficou fora do nosso vocabulário. Confere a grafia ou tenta outra.`;
    case "repetida": return `“${palavra}” já foi. Tenta outra!`;
    case "distante": return `“${palavra}” passou longe dos dois lados.`;
    case "conectada": return `“${palavra}” encaixou com ${conexoes.map(vizinha => `“${vizinha}”`).join(" e ")}.`;
    case "ponte": return `“${palavra}” completou a ponte.`;
    default: return "";
  }
}

function renderizarCaminho() {
  const trilha = porId("caminho-atual");
  const lados = partida.lados.map(maiorCaminho);
  trilha.hidden = !partida.ponte && lados.every(lado => lado.length === 1);
  if (trilha.hidden) return;

  const palavras = partida.ponte ?? [...lados[0], null, ...[...lados[1]].reverse()];
  trilha.replaceChildren(...palavras.map((palavra, i) => {
    const passo = document.createElement("li");
    passo.textContent = palavra ? maiuscula(palavra) : "···";
    if (palavra === null) {
      passo.className = "gap";
      passo.setAttribute("aria-label", "Trecho em aberto");
    }
    if (i === 0) passo.className = "edge-start";
    if (i === palavras.length - 1) passo.className = "edge-end";
    return passo;
  }));
}

function atualizarListas() {
  for (const tentativa of partida.tentativas.slice(listaTentativas.children.length)) {
    const linha = document.createElement("li");
    linha.textContent = mensagemDaTentativa(tentativa);
    linha.classList.toggle("accepted", tentativa.tipo !== "distante");
    listaTentativas.append(linha);
    for (const vizinha of tentativa.conexoes) {
      const par = document.createElement("li");
      par.textContent = `${maiuscula(vizinha)} → ${maiuscula(tentativa.palavra)}`;
      listaConexoes.append(par);
    }
  }
  const total = listaConexoes.children.length;
  porId("conexoes").hidden = total === 0;
  porId("total-conexoes").textContent = quantidade(total, "conexão", "conexões");
}

function renderizarPartida() {
  const completa = Boolean(partida.ponte);
  const total = partida.tentativas.length;
  const palpites = quantidade(total, "palpite", "palpites");
  porId("total-tentativas").textContent = palpites;
  tabuleiro.classList.toggle("is-complete", completa);
  porId("historico").hidden = total === 0;
  formulario.hidden = completa && modo === "diario";
  porId("vitoria").hidden = !completa;
  botaoDica.hidden = completa;
  if (completa) {
    const placar = quantidade(partida.vitoriaEm, "palpite", "palpites");
    const convite = modo === "infinito" ? " Pode continuar ligando palavras." : "";
    porId("resumo-vitoria").textContent = `Você atravessou em ${placar}.${convite}`;
    mostrarDica(false);
  }
  renderizarCaminho();
  atualizarListas();
}

function restaurarPartida() {
  const palpites = modo === "infinito" ? progressoInfinito.palpites : progressoDiario[desafio.chave]?.palpites;
  if (!Array.isArray(palpites)) return;
  for (const palavra of palpites) {
    if (typeof palavra === "string") jogar(partida, palavra, modelo);
  }
}

function iniciarDesafio(novo) {
  desafio = novo;
  const infinito = modo === "infinito";
  partida = criarPartida(desafio, { continua: infinito });
  porId("numero-desafio").textContent = `${infinito ? "Rodada" : "Desafio"} #${desafio.numero}`;
  const data = porId("data-desafio");
  data.hidden = infinito;
  porId("separador-data").hidden = infinito;
  if (!infinito) {
    data.dateTime = desafio.chave;
    data.textContent = desafio.data;
  }
  palavrasTabuleiro[0].textContent = maiuscula(desafio.inicio);
  palavrasTabuleiro[1].textContent = maiuscula(desafio.fim);
  ajustarPalavrasTabuleiro();
  dica.textContent = desafio.dica;
  campo.value = "";
  listaTentativas.replaceChildren();
  listaConexoes.replaceChildren();
  porId("historico").open = false;
  porId("conexoes").open = true;
  mostrarDica(false);
  avisar();
  restaurarPartida();
  renderizarPartida();
}

function iniciarInfinito(nova = false) {
  let rodada = progressoInfinito.rodada;
  const salva = Array.isArray(rodada?.caminho) && rodada.caminho.length >= 4
    && rodada.caminho.every(palavra => typeof palavra === "string" && modelo.buscar(palavra) === palavra)
    && Number.isSafeInteger(rodada.numero) && rodada.numero > 0;
  if (nova || !salva) {
    caminhos ??= gerarCaminhos(termos, modelo);
    const caminho = sortearCaminho(caminhos, salva ? rodada.caminho : []);
    rodada = { numero: salva ? rodada.numero + 1 : 1, caminho };
    progressoInfinito.rodada = rodada;
    progressoInfinito.palpites = [];
  }
  const [inicio, proxima] = rodada.caminho;
  iniciarDesafio({
    numero: String(rodada.numero).padStart(3, "0"),
    inicio, fim: rodada.caminho.at(-1),
    dica: `Uma palavra que encaixa com “${inicio}” começa com ${maiuscula(proxima)[0]} e tem ${proxima.length} letras.`,
  });
  gravarProgresso(chaveInfinito, progressoInfinito);
}

function selecionarModo(novo) {
  modo = novo;
  progressoInfinito.modo = modo;
  const infinito = modo === "infinito";
  for (const botao of botoesModo) botao.setAttribute("aria-pressed", String(botao.dataset.modo === modo));
  novaPonte.hidden = !infinito;
  porId("rodape-diario").hidden = infinito;
  if (infinito) {
    iniciarInfinito();
  } else {
    const diario = hoje();
    cronometro.textContent = diario.tempo;
    iniciarDesafio(diario);
    gravarProgresso(chaveInfinito, progressoInfinito);
  }
}

function atualizarRelogio() {
  if (modo !== "diario" || !partida) return;
  const atual = hoje();
  if (desafio?.chave !== atual.chave) iniciarDesafio(atual);
  cronometro.textContent = atual.tempo;
}

function renderizarEstatisticas() {
  const dias = Object.values(progressoDiario).filter(dia => Array.isArray(dia?.palpites) && dia.palpites.length > 0);
  const vitorias = dias.filter(dia => dia.concluida).map(dia => dia.palpites.length);
  porId("jogadas").textContent = dias.length;
  porId("concluidas").textContent = vitorias.length;
  porId("melhor").textContent = vitorias.length ? Math.min(...vitorias) : "—";
}

async function compartilhar() {
  const sinais = partida.tentativas.slice(0, partida.vitoriaEm)
    .map(({ tipo }) => ({ ponte: "🟩", conectada: "🟦", distante: "⬛" })[tipo]).join("");
  const placar = quantidade(partida.vitoriaEm, "palpite", "palpites");
  const titulo = modo === "infinito" ? "Travessia Infinito" : "Travessia";
  const texto = `${titulo} #${desafio.numero} · ${placar}\n${sinais}\n${location.origin}${location.pathname}`;
  try {
    await navigator.clipboard.writeText(texto);
    avisar("Resultado copiado.", "positive");
  } catch {
    const campoResultado = porId("texto-resultado");
    campoResultado.value = texto;
    porId("resultado").showModal();
    campoResultado.select();
  }
}

async function baixarDados(caminho, formato) {
  const resposta = await fetch(new URL(caminho, import.meta.url));
  if (!resposta.ok) throw new Error(`Falha ao carregar ${caminho}`);
  return resposta[formato]();
}

async function preparar() {
  avisar("Preparando o tabuleiro…");
  try {
    const [vocabulario, binario] = await Promise.all([
      baixarDados("./data/vocabulario.json", "json"),
      baixarDados("./data/vetores.f32", "arrayBuffer"),
    ]);
    modelo = criarModelo(vocabulario.palavras, vocabulario.dimensoes, new Float32Array(binario));
    termos = vocabulario.termos;
    selecionarModo(modo);
    for (const controle of [...botoesModo, novaPonte, botaoDica, campo, porId("conectar")]) controle.disabled = false;
  } catch (erro) {
    avisar("O vocabulário está indisponível. Recarregue a página para jogar.");
    console.error(erro);
  }
}

formulario.addEventListener("submit", evento => {
  evento.preventDefault();
  if (!modelo) return;
  const totalAnterior = partida.tentativas.length;
  const tentativa = jogar(partida, campo.value, modelo);
  if (!tentativa) return;
  if (partida.tentativas.length > totalAnterior) {
    campo.value = "";
    salvarProgresso();
    renderizarPartida();
  }
  const conectou = tentativa.tipo === "conectada" || tentativa.tipo === "ponte";
  avisar(mensagemDaTentativa(tentativa), conectou ? "positive" : "neutro");
  if (partida.ponte && modo === "diario") {
    porId("vitoria").querySelector("h2").focus({ preventScroll: true });
  } else {
    campo.focus();
    campo.select();
  }
});

botaoDica.addEventListener("click", () => mostrarDica(dica.hidden));
novaPonte.addEventListener("click", () => {
  iniciarInfinito(true);
  campo.focus({ preventScroll: true });
});
for (const botao of botoesModo) {
  botao.addEventListener("click", () => {
    if (botao.dataset.modo !== modo) selecionarModo(botao.dataset.modo);
  });
}
porId("compartilhar").addEventListener("click", compartilhar);
for (const botao of document.querySelectorAll("[data-dialog]")) {
  botao.addEventListener("click", () => {
    if (botao.dataset.dialog === "estatisticas") renderizarEstatisticas();
    porId(botao.dataset.dialog).showModal();
  });
}

setInterval(atualizarRelogio, 1_000);
let larguraTabuleiro;
new ResizeObserver(([{ contentRect }]) => {
  if (larguraTabuleiro === contentRect.width) return;
  larguraTabuleiro = contentRect.width;
  ajustarPalavrasTabuleiro();
}).observe(tabuleiro);
document.fonts.ready.then(ajustarPalavrasTabuleiro);
preparar();
