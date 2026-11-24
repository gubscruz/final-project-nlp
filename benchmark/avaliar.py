import csv
import json
import pickle
from argparse import ArgumentParser
from collections import Counter
from itertools import combinations, pairwise
from unicodedata import normalize

import numpy as np
from safetensors import safe_open

from baixar_modelos import DIRETORIO, carregar_modelos, pasta_modelo


LIMIAR_NOTEBOOK = 0.40
TETO_FALSOS_POSITIVOS = 11 / 98  # Taxa obtida pelo FastText 50D no teste da primeira rodada em português.
# Modelo de referência do bootstrap e primeiro membro da combinação, por idioma.
REFERENCIA = {"pt": "fasttext-50d", "en": "glove-50d"}
COMBINACAO = {"pt": ("fasttext-50d", "glove-50d"), "en": ("glove-50d", "fasttext-300d")}


def sufixo(idioma):
    return "" if idioma == "pt" else f"_{idioma}"


def carregar_base(extensao=False, idioma="pt"):
    base = json.loads((DIRETORIO / f"avaliacoes{sufixo(idioma)}.json").read_text(encoding="utf-8"))
    if extensao:
        base["confirmacao"] = json.loads((DIRETORIO / f"confirmacao{sufixo(idioma)}.json").read_text(encoding="utf-8"))
    pares, palavras_por_divisao, vistos = [], {}, set()
    for divisao, pontes in base.items():
        palavras = set()
        for ponte in pontes:
            tema, caminho = ponte["tema"], ponte["caminho"]
            if len(caminho) < 3 or len(set(caminho)) != len(caminho):
                raise ValueError(f"Caminho inválido em {tema}: {caminho}")
            arestas = [(a, b, nota) for (a, b), nota in zip(pairwise(caminho), ponte["notas"], strict=True)]
            if any(nota < 2 for _, _, nota in arestas):
                raise ValueError(f"Ligação inválida no caminho de {tema}")
            for origem, grupo in (("ponte", arestas), ("extra", ponte["controles"])):
                for a, b, nota in grupo:
                    par = tuple(sorted((a, b)))
                    if nota not in range(4) or a == b or par in vistos:
                        raise ValueError(f"Nota inválida ou par repetido em {tema}: {a}, {b}, {nota}")
                    if any(not w.isalpha() or w != normalize("NFC", w.lower()) for w in (a, b)):
                        raise ValueError(f"Use palavras isoladas em minúsculas e NFC: {a}, {b}")
                    vistos.add(par)
                    palavras.update((a, b))
                    pares.append((divisao, tema, origem, a, b, nota))
        palavras_por_divisao[divisao] = palavras
    for primeira, segunda in combinations(palavras_por_divisao, 2):
        repetidas = palavras_por_divisao[primeira] & palavras_por_divisao[segunda]
        if repetidas:
            raise ValueError(f"Palavras repetidas entre {primeira} e {segunda}: {sorted(repetidas)}")
    if extensao:
        base.pop("teste")
        palavras_por_divisao.pop("teste")
        pares = [par for par in pares if par[0] != "teste"]
    return base, pares, sorted(set.union(*palavras_por_divisao.values()))


def carregar_estatico(pasta, palavras):
    # Seleciona as linhas da base sem materializar a matriz inteira em RAM.
    indices = {}
    with (pasta / "vocab.txt").open(encoding="utf-8") as vocabulario:
        for indice, linha in enumerate(vocabulario):
            palavra = linha.strip()
            if palavra in palavras:
                indices[palavra] = indice
    with safe_open(pasta / "embeddings.safetensors", framework="np") as arquivo:
        embeddings = arquivo.get_slice("embeddings")
        dimensoes = embeddings.get_shape()[1]
        vetores = {palavra: embeddings[i:i + 1, :][0] for palavra, i in indices.items()}
    return vetores, dimensoes


class _Generico:
    """Substitui as classes do gensim ao desserializar, já que só o vocabulário interessa."""

    def __init__(self, *args, **kwargs):
        pass

    def __setstate__(self, estado):
        self.__dict__.update(estado if isinstance(estado, dict) else {"estado": estado})


class _LeitorGensim(pickle.Unpickler):
    def find_class(self, modulo, nome):
        if modulo.startswith("gensim") or modulo == "numpy.core.multiarray" and nome == "_reconstruct":
            return super().find_class(modulo, nome) if modulo.startswith("numpy") else _Generico
        return super().find_class(modulo, nome)


def carregar_gensim(pasta, palavras):
    # Lê o vocabulário do .model (pickle do gensim) sem depender do gensim; os vetores ficam no .npy.
    arquivo_modelo = next(pasta.glob("*.model"))
    with arquivo_modelo.open("rb") as arquivo:
        objeto = _LeitorGensim(arquivo).load()
    chaves = objeto.__dict__.get("index_to_key") or objeto.__dict__.get("index2word")
    indices = {palavra: indice for indice, palavra in enumerate(chaves) if palavra in palavras}
    matriz = np.load(arquivo_modelo.with_suffix(".model.vectors.npy"), mmap_mode="r")
    vetores = {palavra: np.array(matriz[indice], dtype=np.float32) for palavra, indice in indices.items()}
    return vetores, matriz.shape[1]


def codificar_minilm(pasta, palavras):
    import onnxruntime as ort
    from tokenizers import Tokenizer

    tokenizador = Tokenizer.from_file(str(pasta / "tokenizer.json"))
    tokenizador.enable_truncation(max_length=128)
    opcoes = ort.SessionOptions()
    opcoes.intra_op_num_threads = 2
    sessao = ort.InferenceSession(
        str(pasta / "onnx/model_quint8_avx2.onnx"), opcoes, providers=["CPUExecutionProvider"]
    )
    nomes_entradas = [entrada.name for entrada in sessao.get_inputs()]
    vetores = {}
    for palavra in palavras:
        tokens = tokenizador.encode(palavra)
        entradas = {
            "input_ids": np.array([tokens.ids], dtype=np.int64),
            "attention_mask": np.array([tokens.attention_mask], dtype=np.int64),
            "token_type_ids": np.array([tokens.type_ids], dtype=np.int64),
        }
        estados, = sessao.run(["last_hidden_state"], {nome: entradas[nome] for nome in nomes_entradas})
        # A entrada é uma única palavra, sem tokens de preenchimento.
        vetores[palavra] = estados[0].mean(axis=0)
    return vetores, sessao.get_outputs()[0].shape[-1]


def calcular_cossenos(modelo, palavras):
    pasta = pasta_modelo(modelo)
    if modelo["tipo"] == "estatico":
        vetores, dimensoes = carregar_estatico(pasta, set(palavras))
    elif modelo["tipo"] == "gensim":
        vetores, dimensoes = carregar_gensim(pasta, set(palavras))
    else:
        vetores, dimensoes = codificar_minilm(pasta, palavras)
    matriz = np.full((len(palavras), dimensoes), np.nan, dtype=np.float32)
    for indice, palavra in enumerate(palavras):
        if palavra in vetores:
            vetor = vetores[palavra]
            norma = np.linalg.norm(vetor)
            if norma > 0 and np.isfinite(norma):
                matriz[indice] = vetor / norma
    cossenos = np.clip(matriz @ matriz.T, -1, 1)
    tamanho = sum((pasta / arquivo).stat().st_size for arquivo in modelo["arquivos"])
    return cossenos, dimensoes, tamanho


def postos(valores):
    """Postos a partir de 1, atribuindo a média dos postos em caso de empate."""
    _, inversa, contagens = np.unique(valores, return_inverse=True, return_counts=True)
    postos_medios = np.cumsum(contagens) - (contagens - 1) / 2
    return postos_medios[inversa]


def spearman(notas, escores):
    return float(np.corrcoef(postos(notas), postos(escores))[0, 1])


def intervalos_delta_spearman(pares, selecao, notas, escores_pares, referencia):
    por_tema = {}
    for indice in np.flatnonzero(selecao):
        tema = pares[indice][1]
        por_tema.setdefault(tema, []).append(indice)
    grupos = list(por_tema.values())
    sorteios = np.random.default_rng(20261118).integers(len(grupos), size=(2000, len(grupos)))
    amostras = [np.concatenate([grupos[indice] for indice in sorteio]) for sorteio in sorteios]

    def correlacoes(escores):
        return np.array([spearman(notas[amostra], escores[amostra]) for amostra in amostras])

    base = correlacoes(escores_pares[referencia])
    return {
        nome: np.quantile(correlacoes(escores) - base, [0.025, 0.975]).tolist()
        for nome, escores in escores_pares.items()
        if nome != referencia
    }


def pontos_de_corte(escores):
    unicos = np.unique(escores)
    return np.r_[
        np.nextafter(unicos[0], -np.inf),
        (unicos[:-1] + unicos[1:]) / 2,
        np.nextafter(unicos[-1], np.inf),
    ]


def calibrar(notas, escores):
    positivos = notas >= 2
    total_pos = int(positivos.sum())
    total_neg = len(positivos) - total_pos

    def criterio(limiar):
        aceita = escores >= limiar
        vp = int(np.count_nonzero(positivos & aceita))
        vn = int(np.count_nonzero(~positivos & ~aceita))
        # Maximiza a acurácia balanceada e, no empate, a especificidade.
        return vp * total_neg + vn * total_pos, vn, limiar

    return float(max(pontos_de_corte(escores), key=criterio))


def calibrar_com_teto(notas, escores):
    negativos = escores[notas < 2]
    for corte in pontos_de_corte(escores):
        if np.count_nonzero(negativos >= corte) / len(negativos) <= TETO_FALSOS_POSITIVOS:
            return float(corte)


def metricas_pares(notas, escores, limiar):
    aceitos = escores >= limiar
    positivos = notas >= 2
    vp = int(np.count_nonzero(positivos & aceitos))
    fp = int(np.count_nonzero(~positivos & aceitos))
    fn = int(positivos.sum()) - vp
    vn = int((~positivos).sum()) - fp
    return {
        "vp": vp, "fp": fp, "fn": fn, "vn": vn,
        "precisao": vp / (vp + fp) if vp + fp else None,
        "revocacao": vp / (vp + fn),
        "taxa_falsos_positivos": fp / (fp + vn),
        "f1": 2 * vp / (2 * vp + fp + fn),
    }


def simular_jogo(caminho, similaridade, limiar):
    """Reproduz o jogo com os palpites internos na ordem do caminho de referência."""
    inicio, fim = caminho[0], caminho[-1]
    if not all(np.isfinite(similaridade(p, p)) for p in (inicio, fim)):
        return []
    lados = [[(inicio,)], [(fim,)]]
    for palpite in caminho[1:-1]:
        if not np.isfinite(similaridade(palpite, palpite)):
            continue
        melhor = [max(lado, key=lambda ramo: similaridade(palpite, ramo[-1])) for lado in lados]
        pontuacoes = [similaridade(palpite, ramo[-1]) for ramo in melhor]
        if min(pontuacoes) >= limiar:
            return [*melhor[0], palpite, *reversed(melhor[1])]
        lado = int(pontuacoes[1] > pontuacoes[0])
        if pontuacoes[lado] >= limiar:
            lados[lado].append((*melhor[lado], palpite))
    return []


def avaliar_pontes(base, similaridade, limiar, modelo, cenario):
    linhas = []
    for divisao, pontes in base.items():
        for ponte in pontes:
            caminho = ponte["caminho"]
            escores = [similaridade(a, b) for a, b in pairwise(caminho)]
            obtida = simular_jogo(caminho, similaridade, limiar)
            linhas.append({
                "modelo": modelo, "divisao": divisao, "cenario": cenario,
                "tema": ponte["tema"], "referencia": " → ".join(caminho),
                "cossenos_referencia": " | ".join(f"{s:.6f}" if np.isfinite(s) else "OOV" for s in escores),
                "referencia_valida": all(s >= limiar for s in escores),
                "caminho_no_jogo": " → ".join(obtida), "venceu": bool(obtida),
            })
    teste = [linha for linha in linhas if linha["divisao"] != "calibracao"]
    return linhas, {
        "pontes_referencia_validas": sum(linha["referencia_valida"] for linha in teste),
        "vitorias_simuladas": sum(linha["venceu"] for linha in teste),
        "vitorias_com_outro_caminho": sum(
            linha["venceu"] and linha["referencia"] != linha["caminho_no_jogo"] for linha in teste
        ),
    }


def escrever_csv(destino, linhas):
    with destino.open("w", encoding="utf-8-sig", newline="") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=list(linhas[0]))
        escritor.writeheader()
        escritor.writerows(linhas)


def main(extensao=False, idioma="pt"):
    base, pares, palavras = carregar_base(extensao, idioma)
    referencia = REFERENCIA[idioma]
    divisao_teste = "confirmacao" if extensao else "teste"
    indice = {palavra: i for i, palavra in enumerate(palavras)}
    indices_a = [indice[a] for _, _, _, a, _, _ in pares]
    indices_b = [indice[b] for _, _, _, _, b, _ in pares]
    notas = np.array([nota for *_, nota in pares])
    calibracao = np.array([divisao == "calibracao" for divisao, *_ in pares])
    teste = ~calibracao
    resultados = {}
    for modelo in carregar_modelos(extensao, idioma):
        nome = modelo["id"]
        print(f"Calculando cossenos para {nome}", flush=True)
        resultados[nome] = calcular_cossenos(modelo, palavras)
    if extensao:
        primeiro, segundo = COMBINACAO[idioma]
        matriz_a, dim_a, bytes_a = resultados[primeiro]
        matriz_b, dim_b, bytes_b = resultados[segundo]
        resultados[f"{primeiro}-e-{segundo}"] = ((matriz_a + matriz_b) / 2, dim_a + dim_b, bytes_a + bytes_b)

    escores_pares = {nome: matriz[indices_a, indices_b] for nome, (matriz, *_) in resultados.items()}
    comuns = np.logical_and.reduce([np.isfinite(escores) for escores in escores_pares.values()])
    pares_teste = teste & comuns
    pares_teste_sem_zeros = pares_teste & (notas > 0)
    pares_calibracao = calibracao & comuns
    intervalos = intervalos_delta_spearman(pares, pares_teste, notas, escores_pares, referencia) if extensao else {}
    resumo = {
        "base": {
            "palavras": len(palavras),
            "pontes_calibracao": len(base["calibracao"]), "pontes_teste": len(base[divisao_teste]),
            "pares_calibracao": int(calibracao.sum()), "pares_teste": int(teste.sum()),
            "pares_comuns_calibracao": int(pares_calibracao.sum()), "pares_comuns_teste": int(pares_teste.sum()),
            "notas_teste_pares_comuns": dict(sorted(Counter(notas[pares_teste].tolist()).items())),
        },
        "modelos": {},
    }
    if extensao:
        resumo["base"]["teto_falsos_positivos_calibracao"] = TETO_FALSOS_POSITIVOS
    linhas_pares, linhas_pontes = [], []
    for nome, (matriz, dimensoes, tamanho) in resultados.items():
        escores = escores_pares[nome].astype(np.float64)
        limiar = calibrar(notas[pares_calibracao], escores[pares_calibracao])
        cenarios = {"notebook": LIMIAR_NOTEBOOK, "calibrado": limiar}
        if extensao:
            cenarios["teto_falsos_positivos"] = calibrar_com_teto(notas[pares_calibracao], escores[pares_calibracao])
        resultados_modelo = {
            "dimensoes": dimensoes, "bytes_arquivos": tamanho,
            "palavras_com_vetor": int(np.isfinite(np.diag(matriz)).sum()),
            "pares_teste_com_vetor": int(np.count_nonzero(teste & np.isfinite(escores))),
            "spearman_teste": spearman(notas[pares_teste], escores[pares_teste]),
            "spearman_teste_sem_nota_zero": spearman(notas[pares_teste_sem_zeros], escores[pares_teste_sem_zeros]),
        }
        if nome in intervalos:
            resultados_modelo[f"intervalo_bootstrap_95_delta_spearman_vs_{referencia.replace('-', '_')}"] = intervalos[nome]

        def similaridade(a, b):
            return float(matriz[indice[a], indice[b]])

        for cenario, corte in cenarios.items():
            linhas, resultado_pontes = avaliar_pontes(base, similaridade, corte, nome, cenario)
            linhas_pontes.extend(linhas)
            resultados_modelo[cenario] = {
                "limiar": corte, **metricas_pares(notas[pares_teste], escores[pares_teste], corte), **resultado_pontes,
            }
        for (divisao, tema, origem, a, b, nota), escore, comum in zip(pares, escores, comuns, strict=True):
            linhas_pares.append({
                "modelo": nome, "divisao": divisao, "tema": tema, "origem": origem,
                "palavra_a": a, "palavra_b": b, "nota": nota,
                "cosseno": f"{escore:.8f}" if np.isfinite(escore) else "",
                "par_comum": bool(comum),
                **{f"aceito_{cenario}": bool(escore >= corte) for cenario, corte in cenarios.items()},
            })
        resumo["modelos"][nome] = resultados_modelo

    destino = DIRETORIO / (("resultados_extensao" if extensao else "resultados") + sufixo(idioma))
    destino.mkdir(exist_ok=True)
    (destino / "resumo.json").write_text(
        json.dumps(resumo, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    escrever_csv(destino / "pares.csv", linhas_pares)
    escrever_csv(destino / "pontes.csv", linhas_pontes)
    print(f"Resultados salvos em {destino}")


if __name__ == "__main__":
    parser = ArgumentParser(description="Compara embeddings para o jogo de palavras.")
    parser.add_argument("--extensao", action="store_true", help="Avalia todos os candidatos nas pontes novas.")
    parser.add_argument("--idioma", default="pt", choices=["pt", "en"], help="Base e modelos a avaliar.")
    args = parser.parse_args()
    main(args.extensao, args.idioma)
