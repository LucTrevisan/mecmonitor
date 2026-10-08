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

Observação: a partir da Fase 8 os sensores respondem no VR (destaque e seleção). Os painéis de leitura
(valor, estado, histórico) dentro do óculos entram na Fase 9.

## Fase 7 — Hand tracking

Pouse os controles na mesa (o Quest passa para as mãos) e depois pegue-os de novo.

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 7.1 | Soltar os controles | Em 1–2 s aparecem **dois pontinhos claros** nas pontas do polegar e do indicador de cada mão; nenhuma "mão de videogame" | |
| 7.2 | Esconder uma mão atrás das costas | Os pontinhos dela somem; a outra mão continua normal | |
| 7.3 | Pegar os controles de novo | Os pontinhos somem e os raios dos controles voltam, sem recarregar | |

## Fase 8 — Apontar, pinçar e interação direta

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 8.1 | Com controles: mirar o raio em **VIB-01** (topo do mancal) | Aparece uma **esfera translúcida branca** em volta do sensor (destaque) | |
| 8.2 | Puxar o gatilho | A esfera fica **azul** (selecionado), a peça brilha e o controle **vibra** curto | |
| 8.3 | Mirar com o controle **esquerdo** e puxar o gatilho | Funciona de primeira (cada controle tem o próprio raio) | |
| 8.4 | Com as mãos: mão aberta apontando para o sensor | Raio fino e discreto saindo da mão; ao passar sobre o sensor, fica azul e a esfera branca aparece | |
| 8.5 | Fazer a **pinça** (polegar + indicador) | Seleciona **uma vez**; o cursor pisca. Segurar a pinça não seleciona de novo | |
| 8.6 | Mão aberta parada, sem pinçar, por 10 s | **Nada** é selecionado sozinho | |
| 8.7 | Aproximar a ponta do indicador do sensor (sem raio) | O raio some e o sensor fica destacado (interação direta) | |
| 8.8 | Encostar e pinçar no sensor | Seleciona (mesmo com o dedo se mexendo ao fechar a pinça) | |
| 8.9 | Passar a mão "atravessando" o painel ou o sensor sem pinçar | Nada é ativado | |
| 8.10 | Painel "Sair da imersão": olhar à **esquerda**, um pouco abaixo | O painel fica ao lado (não na frente da bancada) | |
| 8.11 | Apontar a mão para "Sair da imersão" e pinçar | Sai do VR | |
| 8.12 | Raio da mão tremendo? | O raio deve ficar estável com a mão parada e acompanhar sem atraso perceptível ao mover | |
