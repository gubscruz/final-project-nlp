import { hoje } from "./desafios.mjs";
import { idiomaValido, idiomas } from "./idiomas.mjs";
import { gerarCaminhos, sortearCaminho } from "./infinito.mjs";
import { criarGrafo } from "./grafo.mjs";
import { criarModelo, criarPartida, jogar, maiorCaminho } from "./jogo.mjs";

const porId = id => document.getElementById(id);
const quantidade = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;
const chaveIdioma = "travessia.idioma.v1";
const formulario = porId("formulario");
const campo = porId("palpite");
const retorno = porId("retorno");
const dica = porId("dica");
const botaoDica = porId("alternar-dica");
const dicaRotulo = botaoDica.querySelector("span");
const botoesModo = [...document.querySelectorAll("[data-modo]")];
const botoesIdioma = [...document.querySelectorAll("[data-idioma]")];
const novaPonte = porId("nova-ponte");
const cronometro = porId("cronometro");
const tabuleiro = porId("tabuleiro");

let modelo;
let grafo;
let desafio;
let partida;
let termos;
let caminhos;
let idioma;
let chaveDiario;
let chaveInfinito;
let progressoDiario;
let progressoInfinito;
let modo;
const modelosCarregados = new Map();

function lerProgresso(chave) {
  try {
    const salvo = JSON.parse(localStorage.getItem(chave));
    return salvo && typeof salvo === "object" && !Array.isArray(salvo) ? salvo : {};
  } catch {
    return {};
  }
}

function lerIdioma() {
  try {
    return idiomaValido(localStorage.getItem(chaveIdioma));
  } catch {
    return idiomaValido();
  }
}

const maiuscula = palavra => palavra[0].toLocaleUpperCase(idiomas[idioma].locale) + palavra.slice(1);

// O progresso de cada idioma fica em chaves separadas; o português mantém as chaves originais.
function carregarProgresso(codigo) {
  idioma = codigo;
  const sufixo = codigo === "pt" ? "" : `.${codigo}`;
  chaveDiario = `travessia.progresso.v1${sufixo}`;
  chaveInfinito = `travessia.infinito.v1${sufixo}`;
  progressoDiario = lerProgresso(chaveDiario);
  progressoInfinito = lerProgresso(chaveInfinito);
  modo = progressoInfinito.modo === "diario" ? "diario" : "infinito";
  caminhos = undefined;
  for (const botao of botoesIdioma) botao.setAttribute("aria-pressed", String(botao.dataset.idioma === codigo));
  document.documentElement.dataset.idioma = codigo;
}

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

function descreverConexoes() {
  if (partida.ponte) return `Ponte completa: ${partida.ponte.map(maiuscula).join(" → ")}.`;
  const [saida, chegada] = partida.lados.map(maiorCaminho);
  if (saida.length === 1 && chegada.length === 1) return "Mapa das conexões vazio.";
  return `Lado da saída: ${saida.map(maiuscula).join(" → ")}. Lado da chegada: ${chegada.map(maiuscula).reverse().join(" → ")}.`;
}

function renderizarPartida() {
  const completa = Boolean(partida.ponte);
  const total = partida.tentativas.length;
  const palpites = quantidade(total, "palpite", "palpites");
  porId("total-tentativas").textContent = palpites;
  tabuleiro.classList.toggle("is-complete", completa);
  formulario.hidden = completa && modo === "diario";
  porId("vitoria").hidden = !completa;
  botaoDica.hidden = completa;
  if (completa) {
    const placar = quantidade(partida.vitoriaEm, "palpite", "palpites");
    const convite = modo === "infinito" ? " Pode continuar ligando palavras." : "";
    porId("resumo-vitoria").textContent = `Você atravessou em ${placar}.${convite}`;
    mostrarDica(false);
  }
  grafo.sincronizar(partida, descreverConexoes());
}

function restaurarPartida() {
  const palpites = modo === "infinito" ? progressoInfinito.palpites : progressoDiario[desafio.chave]?.palpites;
  if (!Array.isArray(palpites)) return;
  for (const palavra of palpites) {
    if (typeof palavra === "string") jogar(partida, palavra, modelo, idiomas[idioma].locale);
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
  dica.textContent = desafio.dica;
  campo.value = "";
  grafo.reiniciar();
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
    const diario = hoje(idioma);
    cronometro.textContent = diario.tempo;
    iniciarDesafio(diario);
    gravarProgresso(chaveInfinito, progressoInfinito);
  }
}

function atualizarRelogio() {
  if (modo !== "diario" || !partida) return;
  const atual = hoje(idioma);
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

async function carregarModelo(codigo) {
  if (!modelosCarregados.has(codigo)) {
    const { pasta, limiar } = idiomas[codigo];
    const [vocabulario, binario] = await Promise.all([
      baixarDados(`${pasta}vocabulario.json`, "json"),
      baixarDados(`${pasta}vetores.f32`, "arrayBuffer"),
    ]);
    modelosCarregados.set(codigo, {
      modelo: criarModelo(vocabulario.palavras, vocabulario.dimensoes, new Float32Array(binario), limiar),
      termos: vocabulario.termos,
    });
  }
  return modelosCarregados.get(codigo);
}

function habilitarControles(ativos) {
  for (const controle of [...botoesModo, ...botoesIdioma, novaPonte, botaoDica, campo, porId("conectar")]) {
    controle.disabled = !ativos;
  }
}

async function preparar(codigo = lerIdioma()) {
  habilitarControles(false);
  avisar("Preparando o tabuleiro…");
  try {
    ({ modelo, termos } = await carregarModelo(codigo));
    carregarProgresso(codigo);
    grafo ??= criarGrafo(porId("grafo"), {
      similaridade: (a, b) => modelo.similaridade(a, b), limiar: () => modelo.limiar, maiuscula,
    });
    selecionarModo(modo);
    habilitarControles(true);
    try {
      localStorage.setItem(chaveIdioma, codigo);
    } catch {
      // Sem armazenamento, o idioma vale só para esta aba.
    }
  } catch (erro) {
    avisar("O vocabulário está indisponível. Recarregue a página para jogar.");
    console.error(erro);
  }
}

formulario.addEventListener("submit", evento => {
  evento.preventDefault();
  if (!modelo) return;
  const totalAnterior = partida.tentativas.length;
  const tentativa = jogar(partida, campo.value, modelo, idiomas[idioma].locale);
  if (!tentativa) return;
  if (partida.tentativas.length > totalAnterior) {
    campo.value = "";
    salvarProgresso();
    renderizarPartida();
    if (tentativa.tipo === "distante") grafo.rejeitar(tentativa.palavra);
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
for (const botao of botoesIdioma) {
  botao.addEventListener("click", () => {
    if (botao.dataset.idioma !== idioma) preparar(botao.dataset.idioma);
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
preparar();
