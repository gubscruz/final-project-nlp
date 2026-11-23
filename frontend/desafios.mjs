const epoch = Date.UTC(2026, 10, 23);
const dayLength = 86_400_000;
const calendar = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long" });
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export const desafios = [
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
];

export function hoje(agora = new Date()) {
  const partes = Object.fromEntries(clock.formatToParts(agora).map(({ type, value }) => [type, Number(value)]));
  const data = Date.UTC(partes.year, partes.month - 1, partes.day);
  const numero = Math.max(0, (data - epoch) / dayLength) + 1;
  const [inicio, fim, dica] = desafios[(numero - 1) % desafios.length];
  const segundos = 86_400 - partes.hour * 3_600 - partes.minute * 60 - partes.second;
  return {
    chave: new Date(data).toISOString().slice(0, 10),
    numero: String(numero).padStart(3, "0"), data: calendar.format(data),
    inicio, fim, dica,
    tempo: [Math.floor(segundos / 3_600), Math.floor(segundos / 60) % 60, segundos % 60]
      .map(parte => String(parte).padStart(2, "0")).join(":"),
  };
}
