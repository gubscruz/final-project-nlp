// Idiomas disponíveis para as palavras do jogo. Cada um tem seu próprio recorte de vetores,
// o limiar calibrado no benchmark correspondente e os desafios diários.

export const idiomas = {
  pt: {
    rotulo: "Português",
    sigla: "PT",
    locale: "pt-BR",
    pasta: "./data/pt/",
    // FastText Skip-gram 50D do NILC, calibrado em benchmark/resultados/resumo.json.
    limiar: 0.5802609920501709,
    modelo: "FastText 50D do NILC",
    desafios: [
      ["verão", "casaco", "Pense na estação em que as temperaturas caem."],
      ["dentista", "dor", "Pense em uma parte do corpo que esse profissional examina."],
      ["noite", "pesadelo", "O que acontece quando fechamos os olhos para descansar?"],
      ["areia", "oásis", "Imagine uma paisagem árida com montes de areia."],
      ["trigo", "pão", "Pense no ingrediente que sobra depois que o grão é moído."],
      ["tinta", "reboco", "Que ferramenta deixa a cor na superfície?"],
      ["abelha", "doce", "Pense em algo que é produzido na colmeia."],
      ["aeroporto", "bagagem", "Pense no momento em que os passageiros entram no avião."],
      ["criança", "idoso", "Qual fase da vida costuma vir entre essas duas?"],
      ["cavalo", "sela", "Pense no acessório usado para guiar o animal."],
      ["teclado", "senha", "Pense no aparelho em que você costuma digitar."],
      ["medo", "amizade", "O que ajuda a enfrentar uma situação assustadora?"],
      ["geleira", "aquecimento", "Pense na mudança que ocorre quando a água congelada derrete."],
      ["laranja", "azedo", "Pense na categoria de alimentos à qual a laranja pertence."],
      ["badminton", "quadra", "Que equipamento é usado para rebater a peteca?"],
      ["relâmpago", "granizo", "Imagine uma mudança brusca e intensa no tempo."],
      ["sol", "termômetro", "Pense no que sentimos na pele quando estamos ao sol."],
      ["tomate", "forno", "Pense no que pode cobrir uma pizza antes de assar."],
      ["cachorro", "felino", "Encontre uma categoria que englobe as duas palavras."],
      ["sabão", "toalha", "Pense nas bolhas que aparecem quando você esfrega o sabão."],
      ["pipa", "praia", "O que ajuda uma pipa a subir e costuma soprar no litoral?"],
      ["balé", "plateia", "Onde os bailarinos se apresentam?"],
      ["quarto", "cidade", "Pense em um lugar que pode ter vários quartos."],
      ["arquiteto", "andaime", "Comece pelo que um arquiteto desenha antes de uma obra."],
    ],
  },
  en: {
    rotulo: "English",
    sigla: "EN",
    locale: "en-US",
    pasta: "./data/en/",
    // GloVe 100D (Wikipedia + Gigaword), calibrado em benchmark/resultados_en/resumo.json.
    limiar: 0.3130374401807785,
    modelo: "GloVe 100D (Wikipedia + Gigaword)",
    desafios: [
      ["summer", "coat", "Pense na estação em que as temperaturas caem."],
      ["dentist", "pain", "Pense em uma parte do corpo que esse profissional examina."],
      ["night", "nightmare", "O que acontece quando fechamos os olhos para descansar?"],
      ["sand", "oasis", "Imagine uma paisagem árida com montes de areia."],
      ["wheat", "bread", "Pense no ingrediente que sobra depois que o grão é moído."],
      ["paint", "plaster", "Que ferramenta deixa a cor na superfície?"],
      ["bee", "sweet", "Pense em algo que é produzido na colmeia."],
      ["airport", "luggage", "Pense no momento em que os passageiros entram no avião."],
      ["child", "elderly", "Qual fase da vida costuma vir entre essas duas?"],
      ["horse", "saddle", "Pense no acessório usado para guiar o animal."],
      ["keyboard", "password", "Pense no aparelho em que você costuma digitar."],
      ["fear", "friendship", "O que ajuda a enfrentar uma situação assustadora?"],
      ["glacier", "warming", "Pense na mudança que ocorre quando a água congelada derrete."],
      ["orange", "sour", "Pense na categoria de alimentos à qual a laranja pertence."],
      ["badminton", "court", "Que equipamento é usado para rebater a peteca?"],
      ["lightning", "hail", "Imagine uma mudança brusca e intensa no tempo."],
      ["sun", "thermometer", "Pense no que sentimos na pele quando estamos ao sol."],
      ["tomato", "oven", "Pense no que pode cobrir uma pizza antes de assar."],
      ["dog", "feline", "Encontre uma categoria que englobe as duas palavras."],
      ["soap", "towel", "Pense nas bolhas que aparecem quando você esfrega o sabão."],
      ["kite", "beach", "O que ajuda uma pipa a subir e costuma soprar no litoral?"],
      ["ballet", "audience", "Onde os bailarinos se apresentam?"],
      ["bedroom", "city", "Pense em um lugar que pode ter vários quartos."],
      ["architect", "scaffold", "Comece pelo que um arquiteto desenha antes de uma obra."],
    ],
  },
};

export const idiomaPadrao = "pt";

export function idiomaValido(codigo) {
  return Object.hasOwn(idiomas, codigo) ? codigo : idiomaPadrao;
}
