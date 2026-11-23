export const LIMIAR = 0.5802609920501709;

export function criarModelo(palavras, dimensoes, vetores) {
  if (!dimensoes || vetores.length !== palavras.length * dimensoes) {
    throw new Error("O vocabulário e os vetores precisam estar alinhados.");
  }
  const indice = new Map(palavras.map((palavra, i) => [palavra, i * dimensoes]));
  const semAcento = palavra => palavra.normalize("NFD").replace(/\p{M}/gu, "");
  const apelidos = new Map();
  for (const palavra of palavras) {
    const alias = semAcento(palavra);
    if (alias !== palavra) apelidos.set(alias, apelidos.has(alias) ? null : palavra);
  }
  return {
    buscar: palavra => indice.has(palavra) ? palavra : apelidos.get(palavra),
    similaridade(a, b) {
      const posicaoA = indice.get(a);
      const posicaoB = indice.get(b);
      let cosseno = 0;
      for (let i = 0; i < dimensoes; i++) {
        cosseno += vetores[posicaoA + i] * vetores[posicaoB + i];
      }
      return cosseno;
    },
  };
}

export function criarPartida({ inicio, fim }, { continua = false } = {}) {
  return {
    lados: [inicio, fim].map(palavra => [{ palavra, anterior: null, profundidade: 0 }]),
    tentativas: [],
    usadas: new Set([inicio, fim]),
    ponte: null,
    vitoriaEm: null,
    continua,
  };
}

function maisProximo(lado, palavra, modelo) {
  let no = lado[0];
  let cosseno = modelo.similaridade(palavra, no.palavra);
  for (let i = 1; i < lado.length; i++) {
    const candidato = lado[i];
    const similaridade = modelo.similaridade(palavra, candidato.palavra);
    if (similaridade > cosseno) {
      no = candidato;
      cosseno = similaridade;
    }
  }
  return { no, cosseno };
}

function caminhoAte(no) {
  const palavras = [];
  for (let atual = no; atual; atual = atual.anterior) palavras.push(atual.palavra);
  return palavras.reverse();
}

export function jogar(partida, entrada, modelo) {
  if (partida.ponte && !partida.continua) return null;
  const palpite = entrada.trim().toLocaleLowerCase("pt-BR").normalize("NFC");
  if (!/^\p{L}+$/u.test(palpite)) return { tipo: "invalida" };
  const palavra = modelo.buscar(palpite);
  if (!palavra) return { tipo: "desconhecida", palavra: palpite };
  if (partida.usadas.has(palavra)) return { tipo: "repetida", palavra };

  const conexoes = new Set();
  const proximos = partida.lados.map(lado => maisProximo(lado, palavra, modelo));
  const ligacaoValida = proximos.map(({ cosseno }) => cosseno >= LIMIAR);
  const venceu = !partida.ponte && ligacaoValida.every(Boolean);
  if (venceu) {
    partida.ponte = [...caminhoAte(proximos[0].no), palavra, ...caminhoAte(proximos[1].no).reverse()];
    partida.vitoriaEm = partida.tentativas.length + 1;
  }
  for (const [indice, { no }] of proximos.entries()) {
    if (!ligacaoValida[indice]) continue;
    conexoes.add(no.palavra);
    if (!venceu || partida.continua) {
      partida.lados[indice].push({ palavra, anterior: no, profundidade: no.profundidade + 1 });
    }
  }
  const tipo = venceu ? "ponte" : conexoes.size ? "conectada" : "distante";
  const tentativa = { tipo, palavra, conexoes: [...conexoes] };
  partida.usadas.add(palavra);
  partida.tentativas.push(tentativa);
  return tentativa;
}

export function maiorCaminho(lado) {
  const ponta = lado.reduce((maior, no) => no.profundidade > maior.profundidade ? no : maior);
  return caminhoAte(ponta);
}
