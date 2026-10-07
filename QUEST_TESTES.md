# Roteiro de testes no Meta Quest

Abra **https://luctrevisan.github.io/mecmonitor/** no navegador do Quest (limpe o cache se a versão
parecer antiga), toque em **Entrar em VR** e siga os passos. Anote ✅ / ❌ e, se algo falhar, uma frase
sobre o que aconteceu. Isso basta para eu corrigir.

O que já é verificado automaticamente (Quest 3 emulado, `npm run test:xr`): entrada e saída, pose
inicial, andar, agachar, girar a cabeça, área de teleporte, alvos dos raios e reentrada. O roteiro
abaixo confirma o que o emulador **não** consegue reproduzir (sensores reais, sensação de escala,
estabilidade, mãos).

## Fase 6 — Tracking WebXR

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 6.1 | Entrar em VR em pé, no centro da sala real | Você aparece **~1,5 m em frente à bancada**, de frente para ela, com a bomba e o quadro inteiros à vista | |
| 6.2 | Olhar para o chão | Seus pés no piso do laboratório (nem flutuando, nem enterrado); a fita zebrada à frente | |
| 6.3 | Comparar com a bancada | Escala realista: a bancada tem ~1,85 m de altura (um pouco acima dos olhos) | |
| 6.4 | Dar 2–3 passos reais para a frente | Você se aproxima da bancada na mesma proporção, sem saltos | |
| 6.5 | Agachar | A visão desce suavemente; dá para olhar a bomba de baixo | |
| 6.6 | Girar a cabeça rápido para os lados | Sem tremor nem "arrasto" do cenário | |
| 6.7 | Painel "Sair da imersão" | Aparece ~85 cm à frente, um pouco abaixo dos olhos; ao virar o corpo, ele volta para a frente | |
| 6.8 | Apontar o controle para a bomba | O raio **não seleciona peças do modelo** | |
| 6.9 | Apontar o controle para o painel | O botão reage (hover) e o gatilho tira do VR | |
| 6.10 | Teleporte (empurrar o thumbstick para a frente e mirar no chão) | Só aceita destinos **fora da fita zebrada**; mirar sobre a bancada não teleporta | |
| 6.11 | Teleportar para trás da bancada (corredor junto à parede) | Funciona; você fica entre a bancada e a parede | |
| 6.12 | Sair e entrar no VR de novo | Volta para a mesma posição inicial (6.1), sem recarregar a página | |
| 6.13 | Ao sair do VR, olhar a tela 2D | A câmera do navegador volta ao enquadramento de antes | |

Observação: os sensores (VIB-01, T-01, I-01) ainda **não** respondem no VR. Isso entra nas Fases 7–9 (mãos, pinça, painéis).
