import json
from argparse import ArgumentParser
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen


DIRETORIO = Path(__file__).resolve().parent
MODELOS = json.loads((DIRETORIO / "modelos.json").read_text(encoding="utf-8"))
CACHE = DIRETORIO / "downloads"


def carregar_modelos(extensao):
    if not extensao:
        return MODELOS
    extras = json.loads((DIRETORIO / "modelos_extensao.json").read_text(encoding="utf-8"))
    return [*MODELOS, *extras]


def pasta_modelo(modelo):
    return CACHE / modelo["id"] / modelo["revisao"]


def baixar(modelo):
    for arquivo in modelo["arquivos"]:
        destino = pasta_modelo(modelo) / arquivo
        if destino.is_file():
            continue
        destino.parent.mkdir(parents=True, exist_ok=True)
        parcial = destino.with_suffix(destino.suffix + ".part")
        url = (
            f"https://huggingface.co/{modelo['repositorio']}/resolve/"
            f"{modelo['revisao']}/{arquivo}?download=true"
        )
        print(f"Baixando {modelo['id']}/{arquivo}", flush=True)
        with urlopen(url, timeout=90) as resposta, parcial.open("wb") as saida:
            if resposta.status != 200:
                raise OSError(f"Resposta HTTP {resposta.status} ao baixar {url}")
            while bloco := resposta.read(1024 * 1024):
                saida.write(bloco)
            tamanho = resposta.headers.get("Content-Length")
            if tamanho is not None and saida.tell() != int(tamanho):
                raise OSError(f"Download incompleto: {url}")
        parcial.replace(destino)
        print(f"Disponível {modelo['id']}/{arquivo}", flush=True)


if __name__ == "__main__":
    parser = ArgumentParser(description="Baixa as revisões dos modelos usados no benchmark.")
    parser.add_argument("--extensao", action="store_true", help="Inclui as variantes da rodada adicional.")
    args = parser.parse_args()
    with ThreadPoolExecutor(max_workers=3) as executor:
        tarefas = [executor.submit(baixar, modelo) for modelo in carregar_modelos(args.extensao)]
        for tarefa in tarefas:
            tarefa.result()
