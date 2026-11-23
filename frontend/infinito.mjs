import { LIMIAR } from "./jogo.mjs";

export function gerarCaminhos(termos, modelo) {
  const vizinhos = termos.map(() => []);
  for (let origem = 0; origem < termos.length; origem++) {
    for (let destino = origem + 1; destino < termos.length; destino++) {
      if (modelo.similaridade(termos[origem], termos[destino]) >= LIMIAR) {
        vizinhos[origem].push(destino);
        vizinhos[destino].push(origem);
      }
    }
  }

  const caminhos = [];
  for (let origem = 0; origem < termos.length; origem++) {
    const anteriores = termos.map(() => -1);
    const distancias = termos.map(() => -1);
    const fila = [origem];
    distancias[origem] = 0;

    for (let i = 0; i < fila.length; i++) {
      const atual = fila[i];
      const distancia = distancias[atual];
      // Caminhos curtos dão uma pista jogável. A partida permite outros caminhos de qualquer tamanho.
      if (distancia >= 3 && atual > origem) {
        const palavras = [];
        for (let vertice = atual; vertice !== -1; vertice = anteriores[vertice]) palavras.push(termos[vertice]);
        caminhos.push(palavras.reverse());
      }
      if (distancia === 4) continue;
      for (const vizinho of vizinhos[atual]) {
        if (distancias[vizinho] !== -1) continue;
        anteriores[vizinho] = atual;
        distancias[vizinho] = distancia + 1;
        fila.push(vizinho);
      }
    }
  }
  return caminhos;
}

export function sortearCaminho(caminhos, anterior = []) {
  if (!caminhos.length) throw new Error("Não foi encontrado um caminho para o modo Infinito.");
  const disponiveis = caminhos.filter(caminho => (
    !anterior.includes(caminho[0]) || !anterior.includes(caminho.at(-1))
  ));
  const caminho = disponiveis[Math.floor(Math.random() * disponiveis.length)] ?? caminhos[0];
  return Math.random() < 0.5 ? caminho : [...caminho].reverse();
}
