# Comparação de embeddings para o jogo de palavras

A [rodada adicional](EXTENSAO.md) testou versões maiores, uma combinação de modelos e uma regra de calibração com teto de falsos positivos em 24 pontes inéditas. O [benchmark em inglês](INGLES.md) repete o protocolo com uma base traduzida e modelos GloVe, FastText, Word2Vec e MiniLM em inglês.

Para o protótipo diário, a escolha é o **FastText Skip-gram 50D do NILC**, com limiar inicial de cosseno de **0,5803**. O FastText obteve o maior Spearman na base, **ρ = 0,731**, e o menor percentual de falsos positivos entre os cinco modelos com limiares calibrados, **11 de 98 pares**. Ele teve 20 vitórias em 36 desafios simulados. Para usar esse limiar, cada desafio diário precisa ter uma sequência de palpites que vença na simulação.

O **GloVe 50D** ficou próximo no Spearman, com 0,709, e teve mais vitórias com o limiar calibrado, 31 de 36, ao aceitar 26 de 98 pares abaixo da nota mínima. Para o jogo diário, a escolha dá prioridade à ordenação semântica e a rejeitar ligações fracas. A curadoria do desafio permite lidar com a menor taxa de vitória do FastText.

## Base

O arquivo [avaliacoes.json](avaliacoes.json) reúne **337 palavras distintas, 290 pares anotados e 48 pontes de referência** em português. A calibração usa 12 pontes e 72 pares. O teste usa 36 pontes e 218 pares, com vocabulário disjunto do usado na calibração. A base inclui relações de categoria, oposição, associação temática e sequência, além de pares com grafias parecidas e relações fracas. Alguns pares anotados fora das pontes são positivos, como `cachorro` e `cão` e `banco` e `assento`.

| Nota | Relação usada na avaliação | Pares no teste |
| ---: | --- | ---: |
| 0 | Sem associação plausível, como `dinheiro` e `besouro` | 37 |
| 1 | Associação fraca ou principalmente ortográfica, como `grana` e `grama` | 61 |
| 2 | Associação indireta, mas plausível para uma jogada, como `divórcio` e `pensão` | 34 |
| 3 | Associação direta ou convencional, como `criança` e `adulto` | 86 |

## Como os modelos foram avaliados

O **Spearman** mede a correlação entre os postos das notas de referência e os postos dos cossenos, usando a média dos postos para empates. Quanto maior o ρ, mais a ordenação do modelo concorda com a anotação. Todos os modelos produziram vetores para as 337 palavras, então a comparação usa os mesmos 218 pares de teste. Também foi calculado o ρ ao excluir a nota 0, para verificar a ordenação entre os 181 pares restantes.

Para a regra do jogo, o benchmark considera notas 2 e 3 como conexões válidas. Compara o limiar **0,40** do [notebook original](../experiments.ipynb) com um limiar por modelo escolhido somente na calibração. O limiar calibrado maximiza a média entre a taxa de aceitação dos positivos e a taxa de rejeição dos negativos. Em caso de empate, favorece a rejeição dos negativos. F1 combina precisão e revocação das conexões válidas.

A simulação começa com as duas palavras das pontas e usa as palavras internas da referência como palpites, na ordem apresentada. Como no notebook, cada palpite tenta se ligar à palavra mais próxima de cada lado e vence se alcançar os dois lados. Uma **ponte de referência válida** tem todos os seus cossenos adjacentes acima ou iguais ao limiar. Uma **vitória simulada** também pode ocorrer por um atalho com os mesmos palpites.

## Resultados no teste

| Modelo | Spearman ρ | ρ sem nota 0 | Limiar calibrado | F1 | Falsos positivos | Pontes de referência válidas | Vitórias simuladas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **FastText Skip-gram 50D** | **0,731** | **0,603** | **0,5803** | 0,776 | **11/98** | 11/36 | 20/36 |
| GloVe 50D | 0,709 | 0,570 | 0,3091 | **0,837** | 26/98 | 24/36 | 31/36 |
| Word2Vec Skip-gram 300D | 0,677 | 0,588 | 0,1628 | 0,819 | 30/98 | 24/36 | **33/36** |
| Word2Vec Skip-gram 50D | 0,519 | 0,407 | 0,4348 | 0,679 | 22/98 | 9/36 | 17/36 |
| MiniLM multilíngue, ONNX 8 bits | 0,348 | 0,268 | 0,5869 | 0,561 | 34/98 | 8/36 | 12/36 |

O limiar de **0,40** aceitou 51 dos 98 negativos com o FastText e 13 com o GloVe. No Word2Vec 300D do notebook, o mesmo limiar aceitou apenas 33 dos 120 positivos e permitiu 2 vitórias. Com o limiar calibrado, o FastText aceitou 83 dos 120 positivos, com precisão de 88,3%. O GloVe aceitou 105, com precisão de 80,2%.

| Caso com FastText | Cosseno | Resultado com 0,5803 |
| --- | ---: | --- |
| `criança` → `adulto` | 0,757 | Aceito |
| `adulto` → `idoso` | 0,663 | Aceito e completa a ponte |
| `divórcio` → `pensão` | 0,576 | Rejeitado, embora a relação tenha nota 2 |
| `grana` → `grama` | 0,607 | Aceito, embora a relação tenha nota 1 |

Em `amor` → `dinheiro`, o FastText encontrou o atalho `amor` → `casamento` → `dinheiro`. Em `escritor` → `livro` → `biblioteca` → `silêncio`, a ligação `biblioteca` → `silêncio` recebeu 0,354 e os palpites da referência ficaram sem uma solução na simulação.

## Uso no jogo

O arquivo de vetores e o vocabulário completos do FastText 50D somam **195,1 MB**, ante **1.124,7 MB** do Word2Vec 300D. O FastText permite pré-calcular vetores normalizados de um dicionário validado. Um recorte hipotético de 20 mil palavras ocupa **4,0 MB** de vetores `float32`, antes de incluir as palavras e metadados. A edição testada fornece vetores estáticos para as palavras do vocabulário. Ela não disponibiliza os pesos de subpalavras necessários para calcular vetores fora dele.

O limiar é inicial e depende desta base. As notas são de uma única curadoria, sem revisão independente, e a simulação usa sequências conhecidas, sem partidas com jogadores. O tamanho dos arquivos foi medido em disco. O benchmark não mediu latência no navegador. O MiniLM foi avaliado com entrada de uma palavra isolada, média dos tokens válidos e a variante ONNX de 8 bits para AVX2.

## Reprodução

O benchmark foi executado com Python 3.13 em CPU x64 com AVX2. Em um ambiente virtual com Python 3.13, execute os comandos abaixo a partir da raiz do repositório.

```powershell
python -m pip install -r benchmark/requirements.txt
python benchmark/baixar_modelos.py
python benchmark/avaliar.py
```

O download usa revisões fixas em [modelos.json](modelos.json) e armazena cerca de 1,84 GB em `benchmark/downloads/`. Os resultados estão em [resumo.json](resultados/resumo.json), [pares.csv](resultados/pares.csv) e [pontes.csv](resultados/pontes.csv), com métricas, cossenos, caminhos e decisões para os dois limiares.

Os modelos estáticos são do NILC, com licença CC BY 4.0. O MiniLM multilíngue é distribuído sob Apache 2.0. [Coleção NILC-Embeddings](https://huggingface.co/collections/nilc-nlp/nilc-embeddings) · [Hartmann et al., *Portuguese Word Embeddings*](https://arxiv.org/abs/1708.06025) · [Ficha do MiniLM](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2)
