# Benchmark em inglês

Repetição do [benchmark em português](README.md) com uma base anotada em inglês e modelos de embeddings em inglês. Para o jogo em inglês, a escolha é o **GloVe 100D (Wikipedia 2014 + Gigaword 5)** com limiar de cosseno de **0,3130**. Ele teve o menor número de falsos positivos entre os seis modelos com limiares calibrados, **12 de 98 pares**, Spearman de **ρ = 0,781** e **31 vitórias em 36** desafios simulados. O recorte de 20 mil palavras ocupa **8,0 MB** de vetores `float32`.

O **GloVe 300D** ordena melhor (ρ = 0,813), mas seu limiar calibrado é baixo (0,17), aceita mais negativos (16 de 98) e o recorte ocuparia 24 MB. O **FastText 300D** foi o melhor na rodada de confirmação, com vantagem estatisticamente sustentada sobre o GloVe 50D, e pesa o mesmo que o GloVe 300D no navegador.

## Base

Os arquivos [avaliacoes_en.json](avaliacoes_en.json) e [confirmacao_en.json](confirmacao_en.json) são traduções das bases em português, tema a tema, com as mesmas notas sempre que a relação se mantém em inglês. Os pares de controle ortográficos foram substituídos por armadilhas equivalentes em inglês (`grana`/`grama` virou `cash`/`clash`; `semente`/`cimento` virou `seed`/`seek`). Os casos que dependem de polissemia do português foram reanotados: `banco`/`assento` (3) virou `bank`/`riverbank` (3); `coral`/`recife` (3) virou `choir`/`chorus` (3). A base foi traduzida e reanotada por um único anotador, assim como a base original.

| Base | Palavras | Pares | Pontes | Notas no teste (0 / 1 / 2 / 3) |
| --- | ---: | ---: | ---: | --- |
| Calibração | 72 pares | 72 | 12 | — |
| Teste | 335 no total | 218 | 36 | 37 / 61 / 33 / 87 |
| Confirmação | 252 no total | 145 | 24 | 23 / 32 / 21 / 69 |

A distribuição de notas ficou praticamente igual à do português (37 / 61 / 34 / 86 e 24 / 31 / 20 / 70). O vocabulário de cada divisão é disjunto, e o script valida isso. Todos os modelos tinham vetor para as 504 palavras.

## Modelos

Revisões fixas em [modelos_en.json](modelos_en.json). Os modelos estáticos vêm do `gensim-data`, republicado na coleção `fse` do Hugging Face. O `avaliar.py` lê o vocabulário do `.model` sem depender do gensim.

| Id | Modelo | Treino | Arquivos |
| --- | --- | --- | ---: |
| `glove-50d`, `glove-100d`, `glove-300d` | GloVe | Wikipedia 2014 + Gigaword 5, 6 bilhões de tokens, 400 mil palavras | 101, 181 e 501 MB |
| `fasttext-300d` | FastText com subpalavras | Wikipedia 2017 + UMBC + statmt.org news, 16 bilhões de tokens, 1 milhão de palavras | 1,25 GB |
| `word2vec-300d` | Word2Vec | Google News, 100 bilhões de tokens, 3 milhões de termos | 3,78 GB |
| `minilm-multilingue-int8` | MiniLM multilíngue, ONNX 8 bits | O mesmo da rodada em português | 128 MB |

A metodologia é a do benchmark original: Spearman entre notas e cossenos, limiar por modelo escolhido só na calibração pela acurácia balanceada, comparação com o limiar 0,40 do notebook e simulação do jogo com os palpites da ponte de referência.

## Resultados no teste

| Modelo | Spearman ρ | ρ sem nota 0 | Limiar calibrado | F1 | Falsos positivos | Pontes de referência válidas | Vitórias simuladas |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GloVe 300D | **0,813** | **0,760** | 0,1703 | **0,894** | 16/98 | 28/36 | 34/36 |
| FastText 300D | 0,808 | 0,723 | 0,4143 | 0,860 | 14/98 | 21/36 | 28/36 |
| Word2Vec 300D | 0,782 | 0,727 | 0,1828 | 0,848 | 13/98 | 20/36 | 24/36 |
| **GloVe 100D** | 0,781 | 0,706 | **0,3130** | 0,857 | **12/98** | 21/36 | 31/36 |
| GloVe 50D | 0,756 | 0,667 | 0,2707 | 0,854 | 29/98 | 30/36 | **36/36** |
| MiniLM multilíngue, ONNX 8 bits | 0,711 | 0,621 | 0,3325 | 0,832 | 26/98 | 26/36 | 28/36 |

Com o limiar calibrado, o GloVe 100D aceitou 99 dos 120 positivos, com precisão de 89,2%. O limiar **0,40** do notebook é inadequado para os modelos de 300D de cosseno baixo: o GloVe 300D aceitou só 53 dos 120 positivos e permitiu 6 vitórias; o Word2Vec, 54 positivos e 6 vitórias. Para o FastText 300D, 0,40 fica perto do limiar calibrado e permitiu 30 vitórias com 18 falsos positivos.

| Caso com GloVe 100D | Cosseno | Resultado com 0,3130 |
| --- | ---: | --- |
| `child` → `adult` | 0,688 | Aceito |
| `love` → `marriage` | 0,568 | Aceito |
| `cash` → `clash` | 0,105 | Rejeitado, como esperado para nota 1 |
| `kite` → `wind` | 0,312 | Rejeitado por 0,001, embora tenha nota 3 |
| `lighthouse` → `light` | 0,285 | Rejeitado, embora tenha nota 3 |
| `bank` → `riverbank` | 0,055 | Rejeitado, embora tenha nota 3 |
| `rail` → `trail` | 0,528 | Aceito, embora tenha nota 1 |
| `spray` → `chlorine` | 0,486 | Aceito, embora tenha nota 0 |

Ao contrário do FastText em português, que aceitou `grana` → `grama` por causa dos n-gramas de caracteres, o GloVe não cai nas armadilhas ortográficas: `cash`/`clash`, `bank`/`blank` e `money`/`beetle` ficaram todos abaixo de 0,17. Em compensação, ele perde ligações entre palavras raras ou compostas, como `riverbank` e `lighthouse`.

O GloVe 100D perdeu 5 das 36 pontes. Em `writer` → `book` → `library` → `silence`, a ligação `library` → `silence` recebeu 0,151, o mesmo ponto de falha do português (`biblioteca` → `silêncio`, 0,354). Em `smoke` → `fire` → `firefighter` → `siren`, `firefighter` → `siren` ficou em 0,097. Das 31 vitórias, 25 vieram de atalhos, como `dog` → `animal` → `feline` e `bee` → `honey` → `sweet`.

## Confirmação em 24 pontes inéditas

Mesmo protocolo da [extensão em português](EXTENSAO.md): limiares reutilizados da calibração, bootstrap por tema com 2.000 reamostragens para a diferença de Spearman em relação ao GloVe 50D, uma combinação com pesos iguais dos cossenos de GloVe 50D e FastText 300D, e a regra do teto de falsos positivos de 11,2% na calibração.

| Modelo | Spearman ρ | ρ sem nota 0 | Limiar calibrado | Falsos positivos | Vitórias simuladas | IC 95% de Δρ vs. GloVe 50D |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| FastText 300D | **0,790** | **0,668** | 0,4143 | 6/55 | **22/24** | **+0,039 a +0,153** |
| GloVe 50D + FastText 300D | 0,751 | 0,615 | 0,3937 | **4/55** | 20/24 | +0,033 a +0,081 |
| Word2Vec 300D | 0,735 | 0,636 | 0,1828 | 9/55 | **22/24** | −0,016 a +0,101 |
| GloVe 300D | 0,731 | 0,620 | 0,1703 | 7/55 | **22/24** | −0,001 a +0,077 |
| **GloVe 100D** | 0,706 | 0,571 | **0,3130** | **4/55** | 18/24 | −0,017 a +0,046 |
| GloVe 50D | 0,693 | 0,541 | 0,2707 | 11/55 | 21/24 | — |
| MiniLM multilíngue, ONNX 8 bits | 0,678 | 0,558 | 0,3325 | 17/55 | 21/24 | −0,110 a +0,075 |

O FastText 300D foi o único cujo intervalo exclui zero com folga. A vantagem do GloVe 300D sobre o 50D ficou no limite (−0,001). O GloVe 100D manteve a taxa de falsos positivos mais baixa (4 de 55), mas perdeu 6 pontes: em `horse` → `rein` → `horseman` → `saddle`, `rein` → `horseman` recebeu cosseno negativo; em `flute` → `blow` → `air` → `oxidation`, `air` → `oxidation` ficou em 0,074.

| Modelo | Limiar com teto na calibração | Positivos aceitos | Falsos positivos | Vitórias simuladas |
| --- | ---: | ---: | ---: | ---: |
| GloVe 100D | 0,2599 | 76/90 | 8/55 | 21/24 |
| GloVe 50D | 0,3185 | 78/90 | 7/55 | 19/24 |
| GloVe 300D | 0,1703 | 79/90 | 7/55 | 22/24 |
| FastText 300D | 0,4143 | 77/90 | 6/55 | 22/24 |
| GloVe 50D + FastText 300D | 0,3641 | 82/90 | 6/55 | 21/24 |

Para o GloVe 100D, o teto de falsos positivos sugere um limiar mais baixo (0,26) que o calibrado (0,31). O jogo usa o calibrado, por consistência com o português; baixar para 0,26 daria 3 vitórias a mais na confirmação ao custo de 4 negativos a mais.

## Comparação com o português

| | Português | Inglês |
| --- | --- | --- |
| Melhor ρ no teste | FastText 50D, 0,731 | GloVe 300D, 0,813 |
| Melhor ρ na confirmação | FastText 300D, 0,753 | FastText 300D, 0,790 |
| Modelo do jogo | FastText 50D, limiar 0,5803 | GloVe 100D, limiar 0,3130 |
| Falsos positivos do modelo do jogo | 11/98 e 4/55 | 12/98 e 4/55 |
| Vitórias do modelo do jogo | 20/36 e 18/24 | 31/36 e 18/24 |
| MiniLM | 0,348 | 0,711 |
| Vetores exportados | 4,0 MB, 50D | 8,0 MB, 100D |

Todos os modelos em inglês tiveram ρ maior que os equivalentes em português. Os corpora em inglês são maiores (6 a 100 bilhões de tokens, contra cerca de 1,4 bilhão do NILC) e a base em inglês é uma tradução, então a comparação entre idiomas é indicativa, não controlada. O salto do MiniLM, de 0,348 para 0,711, é esperado: o modelo multilíngue foi destilado de um professor treinado em inglês.

## Limitações

- A base em inglês é uma tradução reanotada por um único anotador, sem revisão independente. Alguns controles mudaram de nota ao perder a polissemia do português.
- O teto de 11,2% de falsos positivos veio do FastText 50D em português e foi aplicado sem ajuste.
- O vocabulário do GloVe é todo em minúsculas, e o Word2Vec do Google News diferencia maiúsculas; o benchmark só consulta formas em minúsculas.
- Os limiares em inglês são bem mais baixos que em português (0,17 a 0,41). Cada espaço vetorial tem sua escala de cossenos, e os limiares não são comparáveis entre idiomas.

## Reprodução

```powershell
python -m pip install -r benchmark/requirements.txt
python benchmark/baixar_modelos.py --idioma en
python benchmark/avaliar.py --idioma en
python benchmark/avaliar.py --idioma en --extensao
python frontend/preparar_modelo.py --idioma en
```

O download ocupa cerca de 5,9 GB e retoma arquivos parciais. Os resultados ficam em [resultados_en/](resultados_en/resumo.json) e [resultados_extensao_en/](resultados_extensao_en/resumo.json), com o mesmo formato dos resultados em português.

GloVe: Pennington, Socher e Manning, [*GloVe: Global Vectors for Word Representation*](https://aclanthology.org/D14-1162/), licença PDDL 1.0. FastText: Mikolov et al., [*Advances in Pre-Training Distributed Word Representations*](https://arxiv.org/abs/1712.09405), licença CC BY-SA 3.0. Word2Vec: Mikolov et al., [*Distributed Representations of Words and Phrases*](https://arxiv.org/abs/1310.4546). [Coleção fse no Hugging Face](https://huggingface.co/fse).
