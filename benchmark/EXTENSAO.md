# Novos testes de embeddings para o jogo

O **FastText 300D melhorou o Spearman de 0,694 para 0,753** em 145 pares inéditos. Para o jogo, **a recomendação continua sendo o FastText 50D com limiar de 0,5803**. Com a calibração que limita a aceitação de pares negativos, o 50D completou 18 das 24 pontes e o 300D completou 13. Ambos aceitaram 4 dos 55 pares negativos.

## Base e comparação

A primeira rodada obteve Spearman de 0,731 para o FastText 50D. Na nova base, o mesmo modelo obteve 0,694. São valores que indicam concordância entre a ordenação dos cossenos e as notas de referência. A comparação entre variantes usa a nova base para todos os modelos.

A [base nova](confirmacao.json) tem 169 palavras, 145 pares e 24 pontes. Nenhuma palavra aparece na base da primeira rodada. Os 72 pares de calibração da primeira rodada foram reutilizados para escolher os limiares. Foram testados mais três modelos do NILC e uma combinação com pesos iguais dos cossenos de FastText 50D e GloVe 50D. [FastText 100D](https://huggingface.co/nilc-nlp/fasttext-skip-gram-100d) · [FastText 300D](https://huggingface.co/nilc-nlp/fasttext-skip-gram-300d) · [GloVe 100D](https://huggingface.co/nilc-nlp/glove-100d)

| Modelo | Spearman ρ | ρ sem nota 0 | Limiar calibrado | Falsos positivos | Vitórias simuladas |
| --- | ---: | ---: | ---: | ---: | ---: |
| FastText 300D | **0,753** | **0,632** | 0,4537 | 2/55 | 10/24 |
| FastText 50D + GloVe 50D | 0,722 | 0,625 | 0,4432 | 5/55 | 20/24 |
| FastText 100D | 0,712 | 0,595 | 0,4566 | 13/55 | 19/24 |
| GloVe 100D | 0,710 | 0,609 | 0,3368 | 2/55 | 16/24 |
| **FastText 50D** | **0,694** | 0,580 | **0,5803** | **4/55** | **18/24** |
| GloVe 50D | 0,684 | 0,585 | 0,3091 | 8/55 | 22/24 |
| Word2Vec 300D | 0,637 | 0,576 | 0,1628 | 18/55 | 22/24 |
| Word2Vec 50D | 0,476 | 0,453 | 0,4348 | 13/55 | 16/24 |
| MiniLM multilíngue, ONNX 8 bits | 0,249 | 0,166 | 0,5869 | 19/55 | 10/24 |

A vantagem em Spearman do FastText 300D sobre o 50D foi de **+0,059**, com intervalo de bootstrap de 95% de **+0,014 a +0,113**. O cálculo reamostrou os 24 temas em conjunto para os dois modelos, em 2.000 repetições. A combinação de dois modelos teve ganho observado de +0,028, com intervalo de −0,022 a +0,080. Os intervalos descrevem a variação entre temas desta base, com as notas da curadoria tratadas como fixas.

## Limiar voltado ao jogo

A calibração original maximiza a média entre acerto nos positivos e acerto nos negativos. Testei também, de forma exploratória, o menor limiar que respeita um teto de falsos positivos na calibração. O teto de **11,2%** veio dos 11 falsos positivos em 98 negativos que o FastText 50D obteve no teste da primeira rodada. A taxa observada nas pontes novas pode diferir do teto aplicado na calibração.

| Modelo | Limiar com teto na calibração | Positivos aceitos no teste | Falsos positivos no teste | Vitórias simuladas |
| --- | ---: | ---: | ---: | ---: |
| **FastText 50D** | **0,5803** | **71/90** | **4/55** | **18/24** |
| FastText 300D | 0,4194 | 64/90 | 4/55 | 13/24 |
| FastText 50D + GloVe 50D | 0,5279 | 57/90 | 2/55 | 13/24 |
| GloVe 50D | 0,4634 | 49/90 | 3/55 | 11/24 |

Na calibração original, o GloVe 50D subiu para 22 vitórias e aceitou 8 negativos. Ele é uma opção para um jogo que priorize aceitar mais caminhos. A combinação chegou a 20 vitórias e 5 negativos, uma diferença de duas vitórias e um negativo a mais que o FastText 50D. Um dicionário de 20 mil palavras teria aproximadamente 4 MB de vetores `float32` com o 50D, 8 MB com a combinação e 24 MB com o 300D. Esses valores excluem palavras e metadados.

Uma ligação rejeitada pode impedir a vitória mesmo quando o modelo ordena bem os pares no geral. No FastText 300D, `arquibancada` → `ingresso` obteve 0,412, abaixo do limiar de 0,4194. Os palpites propostos para ligar `gramado` a `ingresso` ficaram sem uma solução nesse cenário.

Nas duas rodadas, um único avaliador atribuiu as notas. As vitórias simuladas usam os palpites das pontes de referência. A diferença de Spearman apoia a superioridade do FastText 300D na ordenação desta base. A taxa de vitória e os falsos positivos apoiam a escolha do 50D para a regra atual do jogo.

## Reprodução

Com o [ambiente da primeira rodada](README.md#reprodução) ativo, execute na raiz do repositório.

```powershell
python benchmark/baixar_modelos.py --extensao
python benchmark/avaliar.py --extensao
```

Os pesos adicionais ocupam cerca de 1,89 GB em disco. As revisões estão em [modelos_extensao.json](modelos_extensao.json). Os resultados completos estão em [resumo.json](resultados_extensao/resumo.json), [pares.csv](resultados_extensao/pares.csv) e [pontes.csv](resultados_extensao/pontes.csv).
