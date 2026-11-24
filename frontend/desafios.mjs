import { idiomas } from "./idiomas.mjs";

const epoch = Date.UTC(2026, 10, 23);
const dayLength = 86_400_000;
const calendar = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long" });
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function hoje(idioma, agora = new Date()) {
  const desafios = idiomas[idioma].desafios;
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
