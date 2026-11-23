"""Exporta vetores FastText normalizados para uso direto no navegador."""

import json
from pathlib import Path
from unicodedata import normalize

import numpy as np
from safetensors import safe_open


FRONTEND = Path(__file__).resolve().parent
BENCHMARK = FRONTEND.parent / "benchmark"
MODELO = "fasttext-50d"
TOTAL_FREQUENTES = 20_000


def palavras_do_benchmark():
    base = json.loads((BENCHMARK / "avaliacoes.json").read_text(encoding="utf-8"))
    confirmacao = json.loads((BENCHMARK / "confirmacao.json").read_text(encoding="utf-8"))
    palavras = set()
    termos = set()
    for estudo in (*base.values(), confirmacao):
        for caso in estudo:
            termos.update(caso["caminho"])
            for primeira, segunda, _ in caso["controles"]:
                palavras.update((primeira, segunda))
    return palavras | termos, sorted(termos)


def main():
    modelos = json.loads((BENCHMARK / "modelos.json").read_text(encoding="utf-8"))
    modelo = next(modelo for modelo in modelos if modelo["id"] == MODELO)
    pasta = BENCHMARK / "downloads" / MODELO / modelo["revisao"]
    obrigatorias, termos = palavras_do_benchmark()
    linhas = {}
    with (pasta / "vocab.txt").open(encoding="utf-8") as vocabulario:
        for indice, texto in enumerate(vocabulario):
            palavra = texto.strip()
            if len(linhas) >= TOTAL_FREQUENTES and palavra not in obrigatorias:
                continue
            if len(palavra) >= 2 and palavra.isalpha() and palavra == normalize("NFC", palavra.lower()):
                linhas.setdefault(palavra, indice)
    if faltantes := obrigatorias - linhas.keys():
        raise ValueError(f"Palavras do benchmark sem vetor: {sorted(faltantes)}")

    with safe_open(pasta / "embeddings.safetensors", framework="np") as arquivo:
        pesos = arquivo.get_slice("embeddings")
        vetores = np.stack([pesos[i:i + 1, :][0] for i in linhas.values()])
    normas = np.linalg.norm(vetores, axis=1, keepdims=True)
    if not np.all(np.isfinite(normas) & (normas > 0)):
        raise ValueError("O recorte contém vetores sem norma válida.")
    vetores /= normas

    destino = FRONTEND / "data"
    destino.mkdir(exist_ok=True)
    indice = {"dimensoes": vetores.shape[1], "palavras": list(linhas), "termos": termos}
    (destino / "vocabulario.json").write_text(
        json.dumps(indice, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    vetores.astype("<f4", copy=False).tofile(destino / "vetores.f32")
    print(f"{len(linhas)} palavras exportadas em {destino}")


if __name__ == "__main__":
    main()
