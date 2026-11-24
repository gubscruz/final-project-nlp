import json
import time
from argparse import ArgumentParser
from concurrent.futures import ThreadPoolExecutor
from http.client import HTTPException
from pathlib import Path
from urllib.request import Request, urlopen


DIRETORIO = Path(__file__).resolve().parent
MODELOS = json.loads((DIRETORIO / "modelos.json").read_text(encoding="utf-8"))
CACHE = DIRETORIO / "downloads"
TENTATIVAS = 8
ESPERA = 15


def carregar_modelos(extensao, idioma="pt"):
    if idioma != "pt":
        return json.loads((DIRETORIO / f"modelos_{idioma}.json").read_text(encoding="utf-8"))
    if not extensao:
        return MODELOS
    extras = json.loads((DIRETORIO / "modelos_extensao.json").read_text(encoding="utf-8"))
    return [*MODELOS, *extras]


def pasta_modelo(modelo):
    return CACHE / modelo["id"] / modelo["revisao"]


def baixar_arquivo(url, destino):
    parcial = destino.with_suffix(destino.suffix + ".part")
    for tentativa in range(1, TENTATIVAS + 1):
        existente = parcial.stat().st_size if parcial.is_file() else 0
        pedido = Request(url, headers={"Range": f"bytes={existente}-"} if existente else {})
        try:
            with urlopen(pedido, timeout=90) as resposta, parcial.open("ab" if existente else "wb") as saida:
                if resposta.status == 200 and existente:
                    saida.seek(0)
                    saida.truncate()
                    existente = 0
                elif resposta.status not in (200, 206):
                    raise OSError(f"Resposta HTTP {resposta.status} ao baixar {url}")
                while bloco := resposta.read(1024 * 1024):
                    saida.write(bloco)
                tamanho = resposta.headers.get("Content-Length")
                if tamanho is not None and saida.tell() != existente + int(tamanho):
                    raise OSError(f"Download incompleto: {url}")
            parcial.replace(destino)
            return
        except (OSError, HTTPException) as erro:
            if tentativa == TENTATIVAS:
                raise
            print(f"Tentativa {tentativa} falhou ({erro}); retomando em {ESPERA}s", flush=True)
            time.sleep(ESPERA)


def baixar(modelo):
    for arquivo in modelo["arquivos"]:
        destino = pasta_modelo(modelo) / arquivo
        if destino.is_file():
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        url = (
            f"https://huggingface.co/{modelo['repositorio']}/resolve/"
            f"{modelo['revisao']}/{arquivo}?download=true"
        )
        print(f"Baixando {modelo['id']}/{arquivo}", flush=True)
        baixar_arquivo(url, destino)
        print(f"Disponível {modelo['id']}/{arquivo}", flush=True)


if __name__ == "__main__":
    parser = ArgumentParser(description="Baixa as revisões dos modelos usados no benchmark.")
    parser.add_argument("--extensao", action="store_true", help="Inclui as variantes da rodada adicional.")
    parser.add_argument("--idioma", default="pt", choices=["pt", "en"], help="Conjunto de modelos a baixar.")
    args = parser.parse_args()
    with ThreadPoolExecutor(max_workers=3) as executor:
        tarefas = [executor.submit(baixar, modelo) for modelo in carregar_modelos(args.extensao, args.idioma)]
        for tarefa in tarefas:
            tarefa.result()
