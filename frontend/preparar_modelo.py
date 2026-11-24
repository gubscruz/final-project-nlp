"""Exporta vetores normalizados de um idioma para uso direto no navegador."""

import json
import sys
from argparse import ArgumentParser
from pathlib import Path
from unicodedata import normalize

import numpy as np
from safetensors import safe_open


FRONTEND = Path(__file__).resolve().parent
BENCHMARK = FRONTEND.parent / "benchmark"
sys.path.insert(0, str(BENCHMARK))
from avaliar import carregar_gensim  # noqa: E402

# Modelo escolhido no benchmark de cada idioma.
MODELOS = {"pt": "fasttext-50d", "en": "glove-100d"}
TOTAL_FREQUENTES = 20_000


def palavras_do_benchmark(sufixo):
    base = json.loads((BENCHMARK / f"avaliacoes{sufixo}.json").read_text(encoding="utf-8"))
    confirmacao = json.loads((BENCHMARK / f"confirmacao{sufixo}.json").read_text(encoding="utf-8"))
    palavras = set()
    termos = set()
    for estudo in (*base.values(), confirmacao):
        for caso in estudo:
            termos.update(caso["caminho"])
            for primeira, segunda, _ in caso["controles"]:
                palavras.update((primeira, segunda))
    return palavras | termos, sorted(termos)


def palavra_valida(palavra):
    return len(palavra) >= 2 and palavra.isalpha() and palavra == normalize("NFC", palavra.lower())


def recortar_estatico(pasta, obrigatorias):
    linhas = {}
    with (pasta / "vocab.txt").open(encoding="utf-8") as vocabulario:
        for indice, texto in enumerate(vocabulario):
            palavra = texto.strip()
            if len(linhas) >= TOTAL_FREQUENTES and palavra not in obrigatorias:
                continue
            if palavra_valida(palavra):
                linhas.setdefault(palavra, indice)
    with safe_open(pasta / "embeddings.safetensors", framework="np") as arquivo:
        pesos = arquivo.get_slice("embeddings")
        vetores = np.stack([pesos[i:i + 1, :][0] for i in linhas.values()])
    return list(linhas), vetores


def recortar_gensim(pasta, obrigatorias):
    # O vocabulário do gensim já vem em ordem de frequência.
    import pickle
    from avaliar import _LeitorGensim

    arquivo_modelo = next(pasta.glob("*.model"))
    with arquivo_modelo.open("rb") as arquivo:
        objeto = _LeitorGensim(arquivo).load()
    chaves = objeto.__dict__.get("index_to_key") or objeto.__dict__.get("index2word")
    linhas = {}
    for indice, palavra in enumerate(chaves):
        if len(linhas) >= TOTAL_FREQUENTES and palavra not in obrigatorias:
            continue
        if palavra_valida(palavra):
            linhas.setdefault(palavra, indice)
    matriz = np.load(arquivo_modelo.with_suffix(".model.vectors.npy"), mmap_mode="r")
    vetores = np.stack([np.array(matriz[i], dtype=np.float32) for i in linhas.values()])
    return list(linhas), vetores


def main(idioma):
    sufixo = "" if idioma == "pt" else f"_{idioma}"
    nome = MODELOS[idioma]
    modelos = json.loads((BENCHMARK / f"modelos{sufixo}.json").read_text(encoding="utf-8"))
    modelo = next(modelo for modelo in modelos if modelo["id"] == nome)
    pasta = BENCHMARK / "downloads" / nome / modelo["revisao"]
    obrigatorias, termos = palavras_do_benchmark(sufixo)
    if modelo["tipo"] == "estatico":
        palavras, vetores = recortar_estatico(pasta, obrigatorias)
    else:
        palavras, vetores = recortar_gensim(pasta, obrigatorias)
    if faltantes := obrigatorias - set(palavras):
        raise ValueError(f"Palavras do benchmark sem vetor: {sorted(faltantes)}")
    normas = np.linalg.norm(vetores, axis=1, keepdims=True)
    if not np.all(np.isfinite(normas) & (normas > 0)):
        raise ValueError("O recorte contém vetores sem norma válida.")
    vetores = vetores / normas

    destino = FRONTEND / "data" / idioma
    destino.mkdir(parents=True, exist_ok=True)
    indice = {"dimensoes": int(vetores.shape[1]), "palavras": palavras, "termos": termos}
    (destino / "vocabulario.json").write_text(
        json.dumps(indice, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    vetores.astype("<f4", copy=False).tofile(destino / "vetores.f32")
    print(f"{len(palavras)} palavras de {nome} exportadas em {destino}")


if __name__ == "__main__":
    parser = ArgumentParser(description="Exporta o recorte de vetores de um idioma para o jogo.")
    parser.add_argument("--idioma", default="pt", choices=sorted(MODELOS), help="Idioma a exportar.")
    args = parser.parse_args()
    main(args.idioma)
