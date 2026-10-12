# CHANGELOG — MecMonitor

## ux-f3b-paineis — 2026-10-12 (refactoring UX mobile, Fase 3: painéis retráteis)

Pedido do usuário com foto de um celular real (site publicado, fonte do sistema ampliada): "os menus e
telas não permitem a visualização da bomba". Com um sensor aberto, o dashboard e o painel do sensor
cobriam quase toda a bancada.

Só apresentação. Um script de interface (`src/ui/retractable.js`) alterna uma classe e o
`aria-expanded` e lembra a escolha neste navegador. Nenhuma lógica, telemetria, cena, câmera, WebXR ou
o GLB foi alterado. **Desktop e tablet inalterados:** os botões não aparecem.

### Adicionado (celular em retrato ≤ 640 px e paisagem baixa)
- **"Indicadores ▴/▾"** no card de saúde: recolhe os quatro cartões de KPI, e o dashboard fica só com a
  linha de saúde (92 % · NORMAL).
  - Os quatro valores continuam nos rótulos 3D sobre o modelo.
  - Em telas curtas (retrato, altura ≤ 760 px) o dashboard começa recolhido na primeira visita; nas
    demais, começa expandido.
- **Com um sensor aberto, os KPIs viram mini cartões**: tag, valor e ícone de estado (unidade e estado
  continuam para leitores de tela). Tocar num cartão troca de sensor, como antes.
- **Painel do sensor abre recolhido**: tag, nome, valor, estado, **Histórico** e **Localizar**.
  - **"Detalhes"** mostra tendência, localização, gráfico, limites, telemetria e dados do sensor.
  - Em paisagem, o painel recolhido encolhe para o conteúdo, dentro da coluna.

### Medido (cena 3D visível)
| Tela | Antes | Agora |
|---|---|---|
| 384×640, fonte 1,1× (o celular da foto) | 24 % · ~15 % com sensor | **51 %** · **45 %** com sensor |
| 320×568 | 29 % · 21 % com sensor | **54 %** · **44 %** |
| 390×844 | 48 % · 37 % com sensor | 48 % (64 % recolhido) · **60 %** |
| 568×320 paisagem | 46 % · 20 % com sensor | 51 % (66 % recolhido) · **36 %** |

### Testes
- `test:ux`:
  - "Indicadores" alterna os KPIs com `aria-expanded` coerente;
  - com sensor aberto: mini cartões (≤ 64 px) e painel recolhido com leitura e ações;
  - "Detalhes" abre o restante;
  - desktop e tablet sem botões.
- `test:smoke`: tempo de navegação de 30 → 120 s. Com a máquina ocupada (100 % de CPU), carregar a
  página levou 47 s; o teste não muda.
- `test:smoke`: a página de dados reais esperava só a 1ª amostra do ESP32 e lia `twin.hotspots` antes
  do modelo 3D carregar. Era uma condição de corrida do teste, exposta pela máquina lenta; agora ele
  espera também o modelo.
- Resultados: `test:ux` **109/109** · `test:smoke` mobile **98/98** e tablet **98/98**.
- Quando o envio foi pedido, o smoke desktop (depois da correção do teste) e o `test:ux` com os limites
  mais rígidos ainda rodavam.
- O desktop não tem os botões novos: o `test:ux` confirma, com a cena 3D em 68 / 73 / 85 %.

## ux-f3-layout — 2026-10-12 (refactoring UX mobile, Fase 3: layout mobile)

Só apresentação: CSS e dois `<span>` sem efeito no texto. Nenhuma lógica, telemetria, cena, câmera,
WebXR ou o GLB foi alterado. Desktop (≥ 1121 px) idêntico: cena 3D visível 68 / 73 / 85 %, igual à
medição anterior.

### Alterado
- **Cabeçalho no celular em retrato (P4, P3):** duas linhas em vez de três ou quatro.
  - **Linha 1:** logo + equipamento (quebra a linha em vez de cortar; "P-01" nunca se separa) e
    "Última atualização" + horário no canto.
  - **Linha 2:** chips de estado, origem e ESP32 numa linha só, mesmo em 320 px.
  - O nome "MECMONITOR" fica só para leitores de tela (continua sendo o título da página).
  - Altura: **122 → 84–85 px**.
- **Dock no celular** (P16): já na Fase 14, 108–144 px.
- **Tablet em retrato (P14, P16):**
  - dock em duas linhas: modos e as seis ações, com "VR"/"RA" (os nomes acessíveis não mudam);
  - com um sensor aberto, o card "Saúde" do dashboard dá lugar à bancada (o chip do cabeçalho
    mantém o estado);
  - dock **223 → 112 px**; cena 3D **57 → 67 %**, e **30 → 41 %** com o sensor aberto.
- **KPIs em telas baixas e ≤ 359 px:** "VIBRAÇÃO · VIB-01" não é mais cortado. A tag vai inteira
  para a linha de baixo quando não cabe. Em 568×320 a coluna do dashboard já rolava e continua
  rolando.

### Medido (cena 3D visível, inicial / com sensor)
| Tela | Antes do refactoring | Fase 3 |
|---|---|---|
| 320×568 | 21 % | 29 / 21 % |
| 360×800 | 40–46 % | 53 / 36 % |
| 390×844 | 40–46 % | 50–53 / 37 % |
| 430×932 | 40–46 % | 55 / 39 % |
| 768×1024 | 64 / 35 % | 67 / 41 % |

### Testes
- `test:ux` ganhou verificações da Fase 3:
  - nome do equipamento inteiro;
  - horário visível e sem sobreposição;
  - limites de altura do cabeçalho e do dock e fração mínima da cena 3D por tela (inicial e com
    sensor).
- `test:ux` 84/84 · `test:smoke` 98/98 em desktop, tablet e mobile · `test:unit` 53/53.
- `test:xr` não foi refeito: nenhum código XR nem regra de desktop mudou. A sessão XR do teste usa a
  janela desktop.

## xr-f14-ra — 2026-10-12 (Fase 14: realidade aumentada)

Pedido fora do plano de 13 fases ("faltou um botão pra realidade aumentada"). É a única exceção da
regra "não alterar WebXR" do refactoring de UX. O VR continua igual, e o teste de regressão do VR
roda depois de uma sessão de RA.

### Adicionado
- **Botão "Entrar em RA"** ao lado de "Entrar em VR" (grupo Imersão do dock), com nome acessível
  "Entrar em RA (realidade aumentada)".
  - Habilitado onde `immersive-ar` é suportado: Meta Quest 3 (passthrough) e Chrome no Android com
    ARCore.
  - Sem suporte, fica desabilitado com o motivo na dica. No iPhone/iPad o motivo é "o Safari não tem
    WebXR".
  - Num celular com RA e sem VR, a sessão XR é preparada do mesmo jeito.
- **`src/xr/ar.js`**: a bancada em **tamanho real** no ambiente de verdade.
  - A oficina virtual (paredes, piso, móveis, luminárias, faixa zebrada) some e o fundo fica
    transparente. A bancada, as placas P-01/M-01, as placas de identificação e o quadro elétrico
    ficam.
  - O teleporte é desligado: anda-se na sala real. O Babylon o religa na próxima sessão.
  - **Posicionamento:**
    - um anel e o **contorno da bancada** (com seta para a frente) seguem o chão real por hit-test;
    - sem resultados, o anel fica no chão a 1,5 m à frente;
    - gatilho, pinça ou toque posiciona a bancada de frente para o usuário, **deslocando o espaço de
      referência XR**, como a pose inicial do VR. O GLB não é movido nem escalado.
  - O clique só posiciona se **começou** no modo de posicionamento e **não acionou** um botão do painel
    ou um sensor. Assim o próprio "Reposicionar" ou uma seleção nunca movem a bancada.
  - Ao posicionar, o painel do headset (e o de treinamento, se aberto) vem para a frente do usuário.
  - No painel do headset, "Recentrar" vira **"Reposicionar"**.
  - **Celular (DOM overlay):** barra embaixo com a instrução, **Reposicionar** e **Sair da RA**
    (≥ 44 px, áreas seguras). Toques na barra não chegam à sessão; toques na imagem da câmera
    posicionam.
  - Sensores, RAIO-X, TÉRMICO, treinamento e cartão do sensor funcionam como no VR.
- **`src/xr/arPlacement.js`**: a matemática do posicionamento, pura e com testes de unidade.
- `QUEST_TESTES.md` **Fase 14** (Quest 3, Android e iPhone) e `BACKLOG.md` IDEA-009 (âncoras, planos,
  estimativa de luz, maquete em escala).

### Alterado
- `src/xr.js`:
  - `enterAR()` e `mode` (`immersive-vr` / `immersive-ar`);
  - `onImmersiveChange(fn)` passa também o modo;
  - VR: mesma chamada de antes.
- `src/xr/vrPanel.js`: `setRecenterLabel(texto)`.
- `src/main.js › wireVR`: verifica VR e RA em paralelo, cria o modo RA e liga a barra do celular.
- **Dock no celular em retrato** (antecipa o dock da Fase 3 de UX, P16): o botão novo criava uma 4ª
  linha.
  - O dock tinha 283 px em 390×844 e o sensor enquadrado no treinamento ficava sob ele (o teste de
    fumaça móvel falhou).
  - Agora são duas linhas:
    - os modos;
    - Dados · Câmera · Imersão lado a lado, com os dois botões de cada grupo empilhados e "VR"/"RA"
      visíveis. O nome acessível continua "Entrar em VR/RA", pois "Entrar em" é só ocultado
      visualmente.
  - Em ≤ 380 px: uma linha de seis ícones de 44 px.
  - Os nomes dos grupos continuam para leitores de tela.
  - Altura do dock: **283 → 144 px** em 390×844 e **217 → 108 px** em 320×568. Cena 3D visível: 32 →
    48 % e 13 → 23 %.
- Paisagem ≤ 640 px: espaçamento menor no dock para os dez controles caberem sem quebrar "Raio-X".

### Corrigido (achado ao testar)
- O IWER (emulador) dispara `select` **antes** de `selectstart` ao apertar e só `selectend` ao soltar.
  A especificação prevê `select` + `selectend` ao soltar. O posicionamento passou a decidir no
  `selectend`, em qualquer ordem, e um clique cancelado (sem `select`) não posiciona.

### Testado
- **`test:xr` 70/70** (56 anteriores + 14 novos de RA, Quest 3 emulado):
  - entrada em `immersive-ar`;
  - oficina oculta (50/50) e bancada visível (8/8);
  - fundo transparente e teleporte desligado;
  - retículo a 1,50 m no chão;
  - gatilho posiciona: mesma distância (1,50 → 1,50 m) e altura, yaw 0,0°, GLB parado;
  - "Reposicionar" e um botão do painel não posicionam;
  - segundo posicionamento;
  - saída restaura tudo (58/58);
  - **VR depois da RA idêntico** (pose inicial a 0,000 m, teleporte ligado).
- O hit-test real não é testável no emulador: o IWER recusa sem o módulo de ambiente sintético. Isso
  aparece como INFO, não como erro do app.
- `test:unit` 53/53 (+2 da matemática do posicionamento) · `test:smoke` 98/98 em desktop, tablet e
  mobile · `test:ux` 68/68 · `test:perf` dentro do orçamento.
- **Não testado em aparelho real** (Quest 3 / Android): roteiro em `QUEST_TESTES.md` Fase 14.

## ux-f2-estrutura — 2026-10-11 (refactoring UX mobile, Fases 1 e 2: auditoria e estrutura CSS)

Só a camada de apresentação (CSS, uma meta tag, testes). Nenhuma lógica, telemetria, cena, câmera,
WebXR ou o GLB foi alterado.

### Adicionado
- **`AUDITORIA_UX.md`**: medições em 11 tamanhos × 4 estados, os 18 problemas com gravidade, heurística
  de Nielsen e situação, e o plano das 7 fases.
- **`npm run test:ux`** (`scripts/ux-check.mjs`): layout nas 8 resoluções pedidas + 3 celulares em
  paisagem.
  - **Falha** se houver: rolagem horizontal, texto < 11 px, botão sem nome acessível, painel de
    treinamento inutilizável, "SEM DADOS" cortado, falta de `viewport-fit=cover` ou KPIs do desktop
    fora de uma linha.
  - **Informa** a fração visível da cena 3D e os alvos < 44 px; essas medidas viram verificações nas
    fases seguintes.

### Alterado (o que foi corrigido)
- **Contraste (WCAG 1.4.3):** painéis com 84 % de opacidade (antes 66 %). Tokens: texto secundário
  `#97a3b2`, crítico `#fb8b8b`, desligado `#97a1af`. Todos ≥ 4,5:1 mesmo com a parede clara da oficina
  atrás.
- **Telas de toque sem desfoque de fundo** (`backdrop-filter`): ele redesenhava a cena 3D borrada sob
  cada painel a cada quadro. A superfície passa a 90 % de opacidade.
- **Áreas seguras:** `viewport-fit=cover` e todas as posições fixas somam `env(safe-area-inset-*)`
  (zero no desktop, então nada muda lá).
- **Tipografia:** nenhum texto abaixo de **11 px** (antes 9 px no celular). No desktop, o espaçamento
  entre letras foi ajustado e o dashboard passou de 304 para 316 px, para que os cards mantenham o
  mesmo desenho, com tendência e estado na mesma linha.
- **KPIs no celular:**
  - em ≤ 359 px, grade 2×2 com nomes completos;
  - de 360 a 640 px, quatro colunas, e um estado longo quebra a linha em vez de ser cortado;
  - **"SEM DADOS" sempre inteiro**;
  - em telas baixas, a tag vai na linha do nome ("TEMP. · T-01").
- **Celulares em paisagem (altura ≤ 500 px):**
  - cabeçalho e dock em uma linha cada, com ícones e rótulos curtos;
  - dashboard numa coluna à esquerda; painel do sensor e treinamento numa coluna à direita, com o
    dock sempre utilizável;
  - histórico em tela cheia.

  Cena 3D visível: **9 % → 46 %** (568×320), **30 % → 57 %** (844×390), **33 % → 63 %** (932×430).
- **Painel de treinamento:** a gaveta nunca fica abaixo de min(58 dvh, 340 px) e pode ser recolhida com
  ▾. Em paisagem vira coluna.
- Botões só com ícone (≤ 380 px e paisagem ≤ 640 px) **mantêm o nome acessível** (rótulo visualmente
  oculto, não removido).
- Desktop ≤ 1440 px: a legenda térmica fica acima do dock e não cobre mais o botão "Normal".

### Corrigido (achados ao validar)
- **Botões do painel de treinamento achatados a 20 px.** A área rolável, uma coluna flex, encolhia os
  itens antes de rolar (bug da Fase 11). Agora os itens mantêm o tamanho e a área rola
  (`.tr-scroll > * { flex-shrink: 0 }`).
- **Regra antiga de ≤ 380 px escondia os rótulos dos botões de qualquer painel**, como "Histórico" e
  "Localizar" no painel do sensor. As regras de botão só com ícone agora valem só para o dock
  (`#dock .btn`).

### Testado
- `test:ux` 68/68 (11 resoluções) · `test:smoke` 97/97 em desktop, tablet e mobile · `test:xr` 56/56
  (WebXR intacto) · `test:unit` 51/51.

## xr-f13-quest — 2026-10-11 (Fase 13: testes Meta Quest e relatório de QA)

### Adicionado
- **`QA_REPORT.md`**:
  - resumo das baterias e ambientes;
  - os 19 testes XR obrigatórios do item 33, cada um ligado à verificação automática e ao passo no
    Quest real;
  - o fluxo do item 36;
  - o checklist de regressão do roteiro original, com a evidência de cada item;
  - desempenho, o que só o Quest real confirma, pendências e uma ficha para o teste no headset.
- `scripts/live-check.mjs` (`npm run test:live`) testa o **site publicado** no GitHub Pages:
  - HTTPS (contexto seguro, exigido pelo WebXR);
  - GLB + decodificador Draco, ambiente e logo carregados;
  - nenhuma requisição falhando e console sem erros;
  - telemetria rotulada e HUD `?perf=1`.

  Resultado: 7/7.
- Teste XR (2 verificações novas):
  - **T-01 pelo controle esquerdo e I-01 pelo direito** no headset; antes só VIB-01 era selecionado
    no VR;
  - **RAIO-X dentro da sessão** pelo menu VR, com NORMAL restaurando.
- `QUEST_TESTES.md`, seção 13, com os casos que o emulador não reproduz:
  - um controle numa mão e a mão livre na outra;
  - perda e retorno de tracking com mãos reais;
  - duas mãos ao mesmo tempo;
  - o fluxo completo do item 36 sem ajuda;
  - o ESP32 real.
- `BACKLOG.md`, IDEA-008: lista de **eventos recentes**. É o único item do roteiro original ainda não
  implementado e está declarado no QA_REPORT.

### Corrigido
- `QUEST_TESTES.md` 6.7 ainda descrevia o painel VR "à frente". Desde a Fase 8 ele fica à esquerda da
  visão.

### Testado
- `test:unit` 51/51 · `test:smoke` 97/97 em desktop, tablet e mobile (Chrome 154) e **97/97 no Edge 154**
  · `test:xr` 56/56 (Quest 3 emulado) · `test:perf` dentro do orçamento · `test:live` 7/7.

## xr-f12-desempenho — 2026-10-11 (Fase 12: desempenho no Quest)

### Medido antes de alterar (`npm run test:perf`, novo)
- Por quadro (um ponto de vista): ~175 draw calls, **~937 mil triângulos**, 297 malhas ativas,
  **246 malhas pickáveis**, 113 materiais, 28 texturas (~58 MB estimados), sem sombras e sem
  pós-processamento. No headset cada olho é um ponto de vista (sem multiview, o trabalho dobra).
- **99,7 % dos triângulos são do GLB** (a oficina inteira soma 2,5 mil). As famílias mais pesadas
  são detalhes de CAD:
  - volantes `Manopla` (154 mil);
  - válvulas de esfera (121 mil);
  - prisioneiros com rosca (93 mil);
  - partes dos registros (~190 mil).

  Ver ISSUE-004.

### Alterado (sem tocar a geometria do GLB)
- **Modelo estático:**
  - as partes do GLB recebem `metadata.glb`, deixam de ser pickáveis e têm os materiais congelados;
  - as matrizes de mundo do modelo e dos sensores montados nele são congeladas;
  - a seleção continua usando só os volumes dos sensores, e a oclusão dos rótulos usa a marca `glb`;
  - os helpers de console (`ajustarRotacaoGraus`, `twin.moveHotspot`) descongelam e congelam de novo.
- **No headset:**
  - a camada de rótulos 2D (invisível no VR), seus raycasts de oclusão e o passe da HighlightLayer
    (a seleção já aparece pela esfera e pelo cartão) ficam desligados;
  - tudo volta ao sair.
- **Foveação fixa** no Quest: nível 0,5 por padrão, aplicado só onde o navegador suporta; `?foveation=0…1`
  ajusta sem rebuild.
- **HUD de desempenho** (`?perf=1`): FPS, CPU por quadro, draw calls e triângulos na página e numa
  linha do painel VR, para medir no Quest real (o emulador renderiza por software).

### Resultado (medido)
- Malhas pickáveis: **246 → 5**.
- CPU das matrizes do modelo por quadro e por olho: **0,39–0,84 ms → 0,05–0,07 ms** (≈ 7–12× menos;
  microbenchmark no desktop; no Quest a CPU é várias vezes mais lenta).
- NORMAL **idêntico pixel a pixel** depois de RAIO-X, TÉRMICO e SENSORES com os materiais congelados
  (0 de 540 mil pixels; virou teste).
- Triângulos e draw calls inalterados. Reduzi-los exige simplificar malhas do GLB, o que **depende de
  autorização** (ISSUE-004).

### Testado
- `test:unit` 51/51 · `test:smoke` 97/97 em desktop, tablet e mobile · `test:xr` 54/54 (Quest 3 emulado)
  · `test:perf` dentro do orçamento.

## xr-f11-treinamento — 2026-10-11 (Fase 11: modo treinamento)

### Adicionado
- **MODO TREINAMENTO** no desktop/celular (botão "Treinamento" no dock) e no headset (botão TREINAMENTO
  do painel VR, que abre um painel **à direita** da visão; o painel principal fica à esquerda).
  Desktop e VR usam o mesmo motor.
- Fluxo em 7 etapas, cada uma liberando a próxima só quando concluída:
  1. **INSPEÇÃO**: checklist de 3 itens;
  2. **LOCALIZAÇÃO DOS SENSORES**: T-01, VIB-01 e I-01 precisam ser selecionados **na bancada**
     (mouse/toque no sensor, raio do controle ou pinça). O clique no KPI não conta, porque enquadraria
     o sensor;
  3. **LEITURA DOS DADOS**: registra os valores mostrados no dashboard;
  4. **IDENTIFICAÇÃO DE ANOMALIA**;
  5. **DIAGNÓSTICO** ("indício compatível com");
  6. **AÇÃO RECOMENDADA**;
  7. **FEEDBACK**: pontuação, tempo, cenário revelado, o que foi observado, indício compatível,
     possíveis causas, ação recomendada e o aviso "análise didática baseada em regras; não substitui a
     avaliação de um especialista".
- **O aluno não recebe a resposta antes do fim.**
  - Os cenários têm nomes neutros (A–D, ou "cenário aleatório") e os chamados não revelam a falha.
  - Diagnóstico e ação usam as mesmas opções em todos os cenários.
  - O nome do cenário, a análise e o gabarito só existem no estado do treinamento a partir do
    FEEDBACK (teste unitário).
- Cenários independentes (`src/config/training.js`). A anomalia se desenvolve em ~45 s, atravessando
  os limites reais dos KPIs:
  - **A** operação normal;
  - **B** temperatura elevada (T-01 52 → 71 °C);
  - **C** vibração elevada (VIB-01 2,2 → 5,2 mm/s);
  - **D** sobrecorrente (I-01 3,6 → 4,9 A).
- **Dados do cenário sempre como simulação.**
  - `telemetry/trainingProvider.js` é do tipo "simulation": aparece como ◐ SIMULAÇÃO, nunca como
    DADOS REAIS.
  - O header ganha o selo **◆ TREINAMENTO**.
  - Ao entrar e ao sair, o histórico de 24 h e as tendências são zerados
    (`historyStore.clear()`, `dashboard.reset()`): dados do cenário nunca se misturam com outros.
  - Ao sair, volta a fonte configurada (simulação ou ESP32).
- Painéis:
  - `ui/trainingPanel.js` (HTML). No desktop ocupa a coluna direita, e o painel do sensor vai para o
    lado dele;
  - em telas ≤ 1120 px vira uma gaveta acima do dock, que **recolhe sozinha na LOCALIZAÇÃO** para
    deixar a bancada visível e pode ser recolhida ou expandida a qualquer momento;
  - `xr/trainingPanel3d.js` (Babylon GUI) usa os alvos fixos `vrt:s0…s5`, `vrt:back`, `vrt:exit` e
    `vrt:next`, os mesmos para controle e mão.
- `training/trainingEngine.js`: motor puro, sem DOM nem Babylon.
- `QUEST_TESTES.md`: passos da Fase 11. `BACKLOG.md`: IDEA-006 (relatório do aluno) e IDEA-007 (mais
  cenários).
- Testes:
  - 6 unitários: ordem e bloqueio das etapas, localização só na etapa certa, nada revelado antes do
    FEEDBACK nos 4 cenários, pontuação/voltar/repetir/sair, perfis e anomalias que realmente cruzam
    os limites, `historyStore.clear()`;
  - 7 no smoke: fluxo completo do cenário B com cliques reais, inclusive "clique no KPI não conta" e
    leitura com T-01 já em ALERTA;
  - 2 no Quest emulado: painel à direita e pinça que inicia o cenário A e marca a inspeção.

### Corrigido
- O enquadramento de um sensor (`twin.focus`) agora também evita o painel de treinamento e a legenda
  térmica, e o sensor nunca fica atrás deles.
- Achado nesta fase (celular): o rodapé fixo do painel cobria os últimos itens e o toque caía no
  rodapé. Agora o conteúdo rola numa área própria e os botões ficam abaixo dela.

### Testado
- `test:unit` 50/50 · `test:smoke` 94/94 em desktop, tablet e mobile · `test:xr` 52/52 (Quest 3 emulado).

## xr-f10-modos — 2026-10-10 (Fase 10: modos de visualização)

### Adicionado
- Modos **NORMAL · SENSORES · RAIO-X · TÉRMICO** no dock e no menu VR. É a mesma ação nos dois:
  trocar em um atualiza o outro. TREINAMENTO segue "em breve" (Fase 11).
- `src/twin/viewModes.js`: gerenciador dos modos.
  - O GLB nunca é alterado. Cada troca de material fica registrada e **NORMAL restaura exatamente**
    o material anterior de cada peça, inclusive o verde. As cores por vértice do modo térmico são
    removidas.
  - **SENSORES:**
    - um cartão 3D acima de cada sensor, com tag, valor, estado (ícone + texto + cor) e modelo, e um
      anel na cor do estado;
    - aparece no desktop e no headset;
    - os cartões selecionam o sensor por mouse, raio do controle ou pinça (mesmo id do volume de
      interação);
    - os rótulos 2D saem para não duplicar.
  - **RAIO-X**, com transparência seletiva:
    - ficam translúcidas só as carcaças em volta das peças girantes (voluta, tampa, caixa do mancal,
      tampas, proteção do acoplamento) e os parafusos sobre elas;
    - **rotor, eixo, mancais, acoplamento e motor** continuam sólidos e com nome;
    - base, tubos e o resto ficam como estão.
  - **TÉRMICO**, ligado ao **T-01**:
    - só a região monitorada (caixa do mancal e tampas) recebe cor;
    - é mais quente junto ao sensor e decai suavemente com a distância, nunca acima da leitura;
    - responde de forma **gradual**: o valor mostrado acompanha a leitura em ~1 s e a cor é contínua,
      sem degraus;
    - escala **BAIXA (≤ 40) · NORMAL (≤ 60) · ELEVADA (≤ 75) · CRÍTICA**, a partir dos limites do KPI
      de temperatura (nunca diverge do dashboard);
    - o resto do equipamento fica **cinza = não medido**;
    - em SEM DADOS a região fica cinza; a última cor nunca permanece.
- `src/ui/thermalLegend.js`: legenda do modo térmico no desktop e no celular.
  - Mostra o valor do T-01, o nível (texto + amostra de cor), a escala com faixas e marcador e a
    origem (◐ SIMULAÇÃO / ● DADOS REAIS).
  - Avisa: "estimativa visual a partir de um único termopar; não é termografia".
  - No headset, a mesma legenda aparece num cartão 3D acima da bancada.
- `src/twin/modeCards.js`: cartões 3D dos modos (canvas, sempre virados para o usuário, por cima da
  cena, com linha guia).
- `src/twin/thermalScale.js` (funções puras) e `src/config/viewModes.js` (peças do RAIO-X, região e
  escala do térmico, altura dos cartões).
- `QUEST_TESTES.md`: passos da Fase 10. `BACKLOG.md`: IDEA-004 (mais termopares) e IDEA-005 (fluxo
  animado).
- Testes:
  - 3 unitários (escala, cor contínua, decaimento);
  - 12 no smoke: cada modo, restauração exata, cartão que seleciona, menu VR, dock na tela; com dados
    reais via WebSocket, 80 °C → CRÍTICA, 30 °C → BAIXA e queda → cinza/SEM DADOS;
  - 2 no Quest emulado: pinça em TÉRMICO com legenda no headset e NORMAL pelo menu VR.

### Corrigido
- **Dock cortado em tablets (≤ 960 px).** Os botões passavam das bordas da tela ("SUALIZAÇÃO",
  "Raio-X" quebrado, "Entrar em VR" cortado). Agora a Visualização ocupa uma linha e os demais grupos
  quebram abaixo, como no celular. Novo smoke: "Dock: todos os botões inteiros na tela".
- `sensorBodies.isCollider` ignora malhas ocultas: um cartão escondido nunca é selecionado.
- Achado durante a fase: os cartões nasceram como *billboards* do Babylon, cuja matriz de mundo só é
  atualizada na renderização. A seleção por mouse, raio ou mão os via na origem e o clique caía em
  outro cartão. Agora o próprio cartão gira para o usuário a cada quadro, como o painel do sensor em
  VR, e a seleção é exata (teste "clicar no cartão seleciona o sensor").
- O smoke test mostra o progresso de cada verificação (como o teste XR). Uma execução ficou presa
  enquanto a máquina hibernava; agora fica visível onde parou.

### Testado
- `test:unit` 44/44 · `test:smoke` 87/87 em desktop, tablet e mobile · `test:xr` 50/50 (Quest 3 emulado).

## xr-f9.1-bancada-real — 2026-10-10 (pedido do usuário: identificação e painel elétrico iguais aos da foto da bancada real)

### Alterado
- A placa no topo do pórtico da bancada (`senai_placa.stp-1`, do próprio GLB, intocado) ficou como na
  foto da bancada real da escola: **duas placas lado a lado**, com o pórtico aparecendo entre elas:
  - à esquerda, **IMBIL®** em vermelho, letras retas e pesadas, e "Soluções em Bombeamento";
  - à direita, a caixa preta **FIESP / SESI / SENAI / IRS**, com filetes brancos, e o **logo oficial
    do SENAI**.
- Saiu a placa anterior ("SENAI · CURSO DE MANUTENÇÃO MECÂNICA / Bancada didática…"). Escola e curso
  continuam na placa da parede de fundo.
- O **painel elétrico** (gabinete `CEMAR-1` do GLB, intocado) ficou como o da foto. Peças sobrepostas
  à porta:
  - etiqueta de patrimônio e plaqueta **ALIMENTAÇÃO 3~220VAC**;
  - manopla preta com chave, sobre a fechadura do próprio gabinete;
  - botão azul **RELÉ DE SEGURANÇA LIGADO** e sinaleiro branco **PAINEL ENERGIZADO**;
  - botão amarelo **REARME RELÉ SEGURANÇA**, chave seletora **DESLIGA / LIGA – COMANDO** e cogumelo
    vermelho **EMERGÊNCIA**.

  É só visual: nada é clicável e o sinaleiro não acende, para nunca sugerir um estado real do painel.
  Todos os comandos formam uma malha e as plaquetas compartilham uma textura, o que custa poucas
  chamadas de desenho no Quest. As legendas do botão amarelo e da seletora estavam parcialmente
  ilegíveis na foto (ISSUE-019).

### Adicionado
- `src/scene/cabinet.js`: comandos 3D e plaquetas do painel elétrico. A disposição e as legendas ficam
  em `CABINET` (`src/config/bench.js`) e podem ser corrigidas sem mexer no código.
- `src/config/bench.js`: identificação da bancada (fabricante, slogan, cor, caixa FIESP).
  `makerLogoUrl` fica vazio: **nenhum logotipo oficial da IMBIL foi reproduzido**, só o nome em texto.
  Com o arquivo oficial em `public/brand/`, basta preencher o campo.
- `canvasTex.drawSignImage`: carrega cada logo uma vez e o redesenha na placa. É usado pela placa da
  escola e pela da bancada.
- Smoke tests:
  - "Placa da bancada como a real": textos, logo carregado, IMBIL à esquerda vista de frente, placas
    não clicáveis;
  - "Painel elétrico como o real": os 6 comandos e as plaquetas na porta do gabinete, não clicáveis.

### Removido
- `SCHOOL.bench`, sem uso após a troca da placa.

### Testado
- `test:unit` 41/41 · `test:smoke` 75/75 em desktop, tablet e mobile · `test:xr` 48/48.

## xr-f9-paineis — 2026-10-08 (Fase 9: painéis e menu VR)

### Adicionado
- `src/xr/vrPanel.js` virou o **painel principal VR** (itens 26 e 27):
  - cabeçalho **P-01 · BOMBA CENTRÍFUGA**, estado do equipamento (ícone + texto + cor) e origem dos
    dados (◐ SIMULAÇÃO / ● DADOS REAIS);
  - linhas **TEMPERATURA (T-01) · VIBRAÇÃO (VIB-01) · CORRENTE (I-01)** + RPM secundário, com valor,
    unidade e estado, vindos da mesma avaliação do dashboard (nunca divergem);
  - menu **NORMAL · SENSORES · RAIO-X · TÉRMICO · TREINAMENTO**. Os modos ainda não construídos aparecem
    como "em breve" e não são clicáveis;
  - rodapé **Fixar painel / Seguir olhar · Recentrar · Sair da imersão**;
  - fica à esquerda da visão (nunca entre o usuário e a bancada), acompanha o olhar só ao sair de um
    cone de 40° e pode ser fixado no lugar;
  - cada botão tem nome; o mesmo `press(nome)` roda pelo controle (eventos da GUI) ou pela mão (alvo
    `vr:<nome>` do InteractionManager, só com pinça, nunca por atravessar).
- `src/xr/sensorCard.js`: **painel contextual do sensor**. Ao selecionar um sensor (qualquer
  dispositivo), aparece acima dele, um pouco em direção ao usuário e virado para ele, com:
  - tag e nome, valor ao vivo e estado (ícone + texto + cor);
  - tendência e localização;
  - histórico curto (últimas 40 leituras em barras coloridas pelo estado, com a linha do limite de
    alerta);
  - "×" que fecha o painel e limpa a seleção.
- `twin.onSelectionChange(fn)`: avisa a troca de seleção vinda de qualquer dispositivo.
- `QUEST_TESTES.md`: passos da Fase 9.
- Testes no Quest 3 emulado (7 novos):
  - painel do sensor junto a VIB-01, com valor, estado, tendência e histórico;
  - pinça no "×" fecha o painel;
  - TEMP / VIB / CORRENTE / STATUS iguais ao dashboard;
  - menu com os modos futuros desabilitados;
  - "Recentrar" por pinça após andar 1 m;
  - painel fixo não acompanha o olhar e, ao soltar, volta a seguir.

### Alterado
- Os alvos de interação dos botões VR passaram de `vr-exit` para `vr:<nome>` (`vr:exit`, `vr:recenter`,
  `vr:pin`, `vr:mode-normal`, `vr:card-close`).
- Teste XR:
  - `waitXRFrames` falha na hora se a sessão terminar ou os quadros pararem (antes travava 5 min);
  - mostra o progresso de cada verificação durante a execução;
  - as pinças em botões miram com a mão já em pinça (ISSUE-018: no emulador a pose salta em um
    quadro).

### Testado
- `test:unit` 41/41 · `test:smoke` 73/73 em desktop, tablet e mobile · `test:xr` 48/48 (Quest 3 emulado).

## xr-f8-interacao — 2026-10-08 (Fase 8: apontar, pinça e interação direta)

### Adicionado
- `src/interaction/interactionManager.js`: **camada única de interação**. Mouse, toque, controles e mãos
  chamam `hover(id, fonte)` / `select(id, fonte)`, e selecionar VIB-01 executa a mesma ação em qualquer
  dispositivo. O botão "Sair da imersão" é um alvo como os sensores.
- `src/interaction/pinch.js`: pinça robusta:
  - razão polegar–indicador ÷ tamanho da palma (independe do tamanho da mão);
  - histerese (fecha < 0,25, abre > 0,40), debounce de 40 ms e cooldown de 250 ms;
  - estados OPEN → PINCH_START → PINCH → PINCH_END;
  - segurar não repete; perda de tracking solta a pinça.
- `src/interaction/oneEuro.js`: filtro One Euro (pouco tremor parado, pouco atraso em movimento). As
  juntas brutas ficam intactas; só a interface usa os valores suavizados.
- `src/interaction/handInteraction.js`:
  - **apontar**: raio do ombro estimado ao ponto de pinça, estável ao pinçar, alcance de 3 m, linha
    fina, azul no hover;
  - **pinça** seleciona;
  - **interação direta**: indicador ou ponto de pinça dentro do volume do sensor, com "aderência"
    de 1,6× o raio e intenção de 250 ms, porque o dedo se move ao fechar a pinça;
  - cursor com flash na seleção; nada é ativado só por atravessar.
- Indicador de **hover/seleção** dos sensores visível no VR (esfera translúcida branca ou azul).
- **Vibração** do controle na seleção (`motionController.pulse`).
- `QUEST_TESTES.md`: passos das Fases 7 e 8.
- Testes:
  - 8 unitários: pinça (escala, estados, histerese, debounce, cooldown, perda de tracking), filtro e
    InteractionManager;
  - 10 no Quest 3 emulado: hover e seleção pelo controle, 1 ponteiro por mão, mão aberta não clica,
    interação direta, pinça, segurar sem repetir, soltar, raio da mão no botão, pinça que sai do VR.

### Corrigido (bugs reais encontrados pelos testes)
- **Os raios dos controles não acertavam os sensores.** O Babylon usa `scene.pointerMovePredicate ||
  raySelectionPredicate`, e a cena instala um predicado padrão (só malhas visíveis) no primeiro
  movimento do mouse. Agora, no XR, os predicados da cena são o filtro de objetos interativos,
  restaurados ao sair.
- **Só um controle tinha raio.** O 1º gatilho do outro controle só trocava o ponteiro, então eram dois
  cliques. Agora `enablePointerSelectionOnAllControllers`: um raio por controle.
- **O painel VR ficava entre o usuário e a bancada**, bloqueando raios e a visão (contra o item 27).
  Agora fica ~31° à esquerda e mais baixo.
- O ponteiro do Babylon é desligado nas mãos (camada própria), então nunca há dois ponteiros por mão
  (ISSUE-017).

### Testado
- `test:unit` 41/41 · `test:smoke` 73/73 em desktop, tablet e mobile · `test:xr` 41/41 (Quest 3 emulado).

## xr-f7.2-logo-senai — 2026-10-08 (logo oficial fornecido pela escola)

### Adicionado
- `public/brand/senai-sp-logo.png`: logo SENAI-SP fornecido pelo usuário (cópia de
  `SENAI_São_Paulo_logo.png`, renomeada sem acentos para a URL).
- Placa da escola com o **logo oficial** + "Escola SENAI / **Antonio Adolpho Lobbe** / Curso de Manutenção
  Mecânica". O logo é desenhado no canvas da própria placa, sem uma textura extra de 4096 px na GPU, o
  que é importante no Quest. Se o arquivo faltar, a placa usa a versão em texto (`metadata.logo`).
- Smoke test: "Logo oficial do SENAI carregado na placa da escola".

### Alterado
- Cor de destaque (faixas, barras, cabeçalhos do painel 5S e do cartaz) = **#FF0000**, o vermelho do
  logo, amostrado do próprio arquivo.

### Testado
- `test:unit` 33/33 · `test:smoke` 73/73 em desktop, tablet e mobile · `test:xr` 31/31.

## xr-f7.1-cenario-senai — 2026-10-08 (pedido do usuário: ambiente da Escola SENAI)

### Adicionado
- `src/config/school.js`: identidade da escola em um só lugar: SENAI · Escola SENAI Antonio Adolpho
  Lobbe · Curso de Manutenção Mecânica · Oficina de Manutenção Mecânica, cor de destaque e `logoUrl`
  opcional. **Identificação só tipográfica: nenhum logotipo oficial foi reproduzido.**
- `src/scene/workshop.js`: a sala virou uma **oficina de manutenção mecânica de escola**:
  - paredes bicolores (barra inferior escura, faixa na cor de destaque), **teto** e **parede frontal**
    (sala fechada para quem está no VR; invisíveis por fora para a câmera desktop);
  - **placa da escola** no alto da parede de fundo, visível por cima da bancada da bomba;
  - **quadro branco do instrutor** com os limites de VIB-01, T-01 e I-01, gerados da mesma configuração
    dos KPIs (nunca divergem do dashboard), o fluxo Inspecionar → Medir → Comparar → Diagnosticar →
    Agir e a referência ISO 10816-3;
  - **bancada de ajustagem** com morsa, gaveteiro e prateleira, e **painel de ferramentas 5S** (quadro
    de sombras com chaves, martelo, chaves de fenda, alicate e instrumentos de medição);
  - **extintor** com placa e **marcação vermelha/amarela no piso**;
  - **cartaz do Programa 5S** na parede lateral; sinalização de EPI e "Equipamento em operação";
  - linha amarela no piso delimitando a faixa de móveis.
- `src/scene/canvasTex.js`: texturas desenhadas em canvas e materiais compartilhados pelo cenário.
- `layout.js`: faixa de móveis junto à parede de fundo (`BACK_PROPS_DEPTH`), excluída da área
  caminhável e do teleporte. O corredor atrás da bomba continua livre.
- Testes: 1 unitário (faixa de móveis) e 2 no navegador (itens da oficina e móveis fora da área de
  teleporte).

### Alterado
- `lab.js`: a placa da bancada passou a "SENAI · CURSO DE MANUTENÇÃO MECÂNICA / Bancada didática de
  manutenção preditiva · Bomba P-01 · Motor M-01"; paredes e sinalização foram para `workshop.js`.

### Preservado
- GLB, cores da bomba e da tubulação, placas P-01/M-01, fita zebrada, sensores, telemetria, histórico,
  VR (pose inicial, teleporte seguro, mãos).

### Testado
- `test:unit` 33/33 · `test:smoke` 72/72 em desktop, tablet e mobile · `test:xr` 31/31.
- Screenshots: vista desktop, visão do usuário de VR na pose inicial, bancada de ajustagem, quadro +
  extintor, cartaz 5S, mobile.

## xr-f7-maos — 2026-10-08 (Fase 7: hand tracking)

### Adicionado
- `src/xr/handTracking.js` (HandTrackingManager):
  - feature `HAND_TRACKING` habilitada como **opcional** (`required: false`): onde não há rastreamento de
    mãos, o VR continua entrando com controles;
  - sem a malha de mão padrão (não baixa nada da CDN, nada de "mão de videogame"): só 2 marcadores
    discretos por mão (ponta do polegar e do indicador), para o usuário saber que a mão foi reconhecida;
  - juntas **brutas** (wrist, thumb-tip, index/middle/ring/pinky-finger-tip; as 25 continuam acessíveis
    por `joint()`), atualizadas a cada frame sem alocar memória. Suavização, apontar e pinça ficam
    para a Fase 8;
  - modo de entrada por mão (`controller` | `hand` | `none`) com evento de troca, para o Quest alternar
    controles ↔ mãos sem recarregar; mão sem tracking (juntas na origem) é ignorada e escondida.
- `xr.js`/`main.js`: `app.xr.hands`.
- Teste XR emulado (+9):
  - mãos disponíveis; troca controle → mão sem ponteiros duplicados;
  - 6 juntas das duas mãos;
  - anatomia coerente (pulso→indicador 18 cm) e lados sem inversão;
  - 2 marcadores por mão;
  - uma mão só (a outra sai do campo de visão) e o retorno dela;
  - volta aos controles com os marcadores sumindo.

### Corrigido (testes)
- Esperas fixas trocadas por "esperar N frames XR" (o render por software chega a ~2 s/frame).
- "Renderizando frames XR" agora confirma 3 frames renderizados em vez de medir frames em 1 s.

### Testado
- `test:unit` 32/32 · `test:smoke` desktop 70/70 · `test:xr` 31/31 (Quest 3 emulado).

## xr-f6-tracking — 2026-10-07 (Fase 6: tracking WebXR)

### Adicionado
- `src/scene/layout.js` (puro, com testes): planta do laboratório a partir das bounds do modelo.
  Inclui a faixa de segurança (0,45 m), a sala (paredes −2,2 m), a pose inicial, `isWalkable()` e
  `safeFloorRects()`. É compartilhada pelo cenário e pelo XR, então a fita zebrada e a área de
  teleporte nunca divergem.
- **Pose inicial fixa no VR:** 1,5 m em frente à bancada, de frente para ela.
  - Mantém a altura real da cabeça (`local-floor`) e não herda mais a câmera desktop (resolve ISSUE-013).
  - Aplicada no 2º frame XR, depois da compensação de altura do Babylon, via offset reference space
    (o mesmo mecanismo do teleporte). O painel VR se reposiciona em seguida.
- **Teleporte seguro:** os alvos são 4 pisos invisíveis (frente, trás, laterais) que cobrem a sala
  menos a faixa da bancada. O piso visual deixou de ser alvo e as peças do modelo bloqueiam o arco
  de teleporte.
- **Raios dos controles** só em objetos interativos (`metadata.xrInteractive`: painel VR e volumes dos
  sensores), com alcance máximo de 6 m. Não varrem mais as 242 malhas do modelo.
- `recenter()` (volta à pose inicial) exposto para o menu XR das próximas fases.
- `QUEST_TESTES.md`: roteiro de 13 passos para validar a Fase 6 no Quest real.
- Teste XR emulado: +9 verificações:
  - pose inicial e direção do olhar;
  - altura;
  - andar 1 m (mapeamento 1:1 e sentido certo);
  - agachar;
  - girar 90° sem deslocar;
  - piso seguro;
  - teleporte impossível na bancada e na faixa;
  - alvos dos raios;
  - reentrada na mesma pose com a câmera desktop focada num sensor.

### Corrigido
- `vrPanel.show()` recalcula a matriz da câmera antes de posicionar (a pose pode mudar no mesmo frame).
- No harness de teste: o IWER 2.5.0 passava `XRRigidTransform` onde esperava `mat4` em
  `getOffsetReferenceSpace` (offset virava identidade). O teste corrige isso para emular fielmente;
  o app não muda.

### Preservado
- Desktop e mobile (picking explícito, sem alteração), GLB, cenário, sensores, histórico.

### Testado
- `test:unit` 32/32 · `test:smoke` 70/70 em desktop, tablet e mobile · `test:xr` 24/24 (Quest 3 emulado).

## xr-f5-sensores — 2026-10-07 (Fase 5: sensores, áreas de interação e histórico)

### Adicionado
- `src/sensors/sensorBodies.js`: **representação física** de cada sensor em escala real, presa à
  âncora (acompanha a peça; o GLB não é alterado):
  - VIB-01: placa MPU6050 sobre a caixa do mancal;
  - T-01: termopar tipo K com sextavado;
  - I-01: TC de núcleo dividido no condutor;
  - RPM-01: sensor M12 sobre a proteção do acoplamento.
- **Volumes de interação invisíveis** (esferas de 12 cm) maiores que os sensores; são a única
  geometria de sensor pickável.
  - Clique/toque no canvas seleciona o sensor (sem mover a câmera) e o hover destaca o rótulo e
    mostra o cursor de mão.
  - Picking só contra esses volumes, nunca contra as 242 malhas do modelo.
  - Base para mãos e controles nas Fases 7 e 8.
- `src/telemetry/historyStore.js`: buffer circular por KPI (24 h a 1 Hz) com agregação
  mín/média/máx por intervalo e lacunas como `null`. Puro, com testes.
- **Histórico** (`src/ui/historyPanel.js` + `historyChart.js`), aberto pelo botão **Dados ›
  Histórico** ou pelo **[Histórico]** do painel do sensor (abre focado no KPI):
  - uma linha de filtros acima de tudo: **5 min · 30 min · 1 h · 24 h** e **Gráfico | Tabela**;
  - small multiples (Temperatura T-01, Vibração VIB-01, Corrente I-01 e RPM-01 sec.), cada um com
    um eixo, linha de 2 px na cor validada (`#3987e5`, validador dataviz: PASS), faixa mín–máx a 10%
    e ponto final com anel;
  - limites de **alerta (⚠)** e **crítico (✖)** com ícone + valor, nunca só cor;
  - valor atual, estado com ícone, tendência % e resumo mín/méd/máx/leituras;
  - crosshair sincronizado nos gráficos + tooltip (valor em destaque, ⚠ ALERTA quando acima do limite),
    também pelo teclado (setas);
  - **visão em tabela** (médias por intervalo, ⚠/✖ nas leituras fora da faixa) como equivalente acessível;
  - Esc fecha o histórico antes do painel do sensor. Painel quase opaco para leitura.
- Testes: 4 unitários (histórico) e 7 no navegador (sensores, volumes, clique a 3 cm do sensor,
  histórico focado, crosshair, filtro/tabela, ordem do Esc).

### Alterado
- Dock: novo grupo **Dados** (Histórico).
- `sensorPanel.js`: [Histórico] abre os gráficos completos; `twin/index.js`: `onHistory`,
  `sensorBodies`, `pickSensorAt`; `hotspots.js`: `anchors`, `setHover`; `config/sensors.js`: `body`.
- Smoke test: o teste de cor da carcaça ignora as malhas dos sensores (agora presas às peças).

### Preservado
- GLB, câmera, Digital Twin, telemetria, cenário, painel VR. O histórico usa o horário de chegada
  e só guarda dados enquanto a página está aberta (indicado no painel).

### Testado
- `test:unit` 29/29 · `test:smoke` 70/70 em desktop, tablet e mobile · `test:xr` 16/16.
- Screenshots: 4 sensores em close, histórico (gráfico e tabela) no desktop e no celular.

## xr-f4-cenario — 2026-10-07 (Fase 4: cenário industrial)

### Adicionado
- `src/scene/lab.js` (`createLab`): laboratório ao redor do GLB, sem texturas externas (DynamicTexture).
  Todas as posições são calculadas em tempo de execução a partir das peças do modelo.
  - **Piso técnico** epóxi cinza com módulos de 0,5 m (no próprio `ground`, que continua sendo o piso do XR).
  - **Demarcação de segurança**: fita zebrada amarela e preta a 0,45 m da bancada e marcação no piso
    "ÁREA DE INSPEÇÃO · USE EPI".
  - **Placas de identificação** azuis, frente e verso:
    - **P-01 · Bomba centrífuga** na base, sob a carcaça;
    - **M-01 · Motor elétrico** no corpo do motor.
  - **Placa da bancada** no topo do quadro: "Laboratório de Manutenção Preditiva · Bancada didática ·
    Bomba centrífuga P-01 · Motor M-01" (o texto se ajusta à largura).
  - **Sala**: parede de fundo e laterais com faixa azul; sinalização ISO 7010 "USO OBRIGATÓRIO DE EPI"
    e "ATENÇÃO · EQUIPAMENTO EM OPERAÇÃO".
  - **Iluminação**: 2 luminárias LED lineares no teto, só emissivas (sem luzes extras, para o Quest).
- Smoke test (3 novos):
  - cenário sem malhas pickáveis e fora da hierarquia do modelo;
  - placas a até 1 cm das peças certas;
  - bounds do modelo e piso XR preservados.

### Alterado
- `main.js`: cria o laboratório após o piso.
- `style.css`: no celular, header e dashboard mais opacos (o fundo agora tem mais detalhes).

### Desempenho
- +20 malhas estáticas (world matrix e materiais congelados), +11 texturas pequenas, 0 luzes novas,
  0 sombras e 0 pós-processamento. Nada participa de picking, oclusão ou enquadramento.

### Preservado
- GLB intocado (bounds verificados); câmera e enquadramento; sensores; telemetria; XR (piso igual).

### Testado
- `test:unit` 25/25 · `test:smoke` 63/63 em desktop, tablet e mobile · `test:xr` 16/16.
  Uma execução desktop falhou por `ERR_NETWORK_CHANGED` (rede da máquina) e passou ao repetir.
- Screenshots: vista padrão, close das placas, altura dos olhos (usuário em pé) e vista do piso.

## xr-f3-ux — 2026-10-07 (Fase 3: correções de UX)

### Adicionado
- **Tags de instrumento** (`config/sensors.js`): **T-01** (MAX6675), **VIB-01** (MPU6050), **I-01** (SCT013)
  e **RPM-01** (secundário, marcado "sec."). Os locais usam **P-01** e **M-01** ("Mancal P-01", "Quadro
  elétrico — alimentação do motor M-01", "Acoplamento M-01 / P-01").
- `src/ui/states.js`: fonte única dos estados **NORMAL ✓ · ALERTA ⚠ · CRÍTICO ✖ · SEM DADOS –**, sempre
  ícone + texto + cor, com ícones SVG e `trendText` ("↑ +4%", "↓ −0,4%", "→ estável").
- **SEM DADOS por KPI** (`health.evaluateLatest`): o dashboard guarda a última leitura de cada KPI.
  - KPI sem leitura há mais de 5 s → SEM DADOS (valor esmaecido).
  - Saúde e estado global usam só KPIs com leitura recente; sem nenhum → SEM DADOS.
  - Também cobre payloads parciais do ESP32.
- Tendência em **%** em relação à janela anterior (`trend().pct`).
- **Painel do sensor no formato pedido:**
  - **VIB-01** · Sensor de Vibração · valor · estado com ícone;
  - Tendência e Localização;
  - botões **[Histórico]** (rola e destaca o histórico) e **[Localizar]**.

  Modelo, grandeza e tipo ficam na seção "Sensor".
- Hotspots no modelo: "✓ VIB-01 · 2,06 mm/s RMS" (ícone + tag + valor) e "– VIB-01 · SEM DADOS".
- Testes: 5 unitários e 9 no navegador, entre eles SEM DADOS por KPI com dados reais (o ESP32 simulado
  para de enviar só a vibração).

### Alterado
- Origem dos dados: **● DADOS REAIS** / **◐ SIMULAÇÃO** (antes "TEMPO REAL").
- ESP32: **● ONLINE** / **◌ CONECTANDO** / **○ OFFLINE** / **✖ ERRO** (antes "online/sem conexão").
- Vibração em **mm/s RMS**.
- `dashboard.js` reescrito (freshness por KPI + `onResult`); `header.js` recebe a saúde do dashboard
  (`setHealth(result)`); `main.js`: novo fluxo telemetria → dashboard → header e Digital Twin.

### Preservado
- Telemetria, Digital Twin (foco, hotspots, painel), câmera, cores, painel VR, GLB.

### Testado
- `test:unit` 25/25 · `test:smoke` 60/60 em desktop, tablet e mobile · `test:xr` 16/16.
- Screenshots: desktop e mobile.

## xr-f2-estabilizacao — 2026-10-07 (Fase 2: backup e estabilização)

### Adicionado
- Tag **`backup-pre-xr`** (= `xr-f1-auditoria`): último estado antes de qualquer alteração de XR deste plano.
- `ARCHITECTURE.md`: fluxo de dados, módulos, coordenadas, XR, UI, pontos de extensão e testes.
- **Teste XR emulado** `npm run test:xr` (`scripts/xr-test.mjs`): injeta o IWER da Meta (Quest 3 emulado;
  devDependency, fora do app) e roda uma sessão WebXR real no Chrome headless. O teste cobre:
  - detecção de XR e botão habilitado;
  - entrada com clique real;
  - WebXRCamera e frames sendo renderizados;
  - painel VR a 0,85 m;
  - controles esquerdo e direito;
  - troca controle → mãos → controle;
  - "Sair da imersão" e câmera desktop restaurada (vista idêntica);
  - zoom após sair, reentrada sem recarregar, console sem erros.

  Também registra a origem XR e a altura dos olhos (INFO).
- `main.js`: `app.xr = { helper, enter, exit }` (ganchos para teste e ferramentas).

### Corrigido
- **Saída do VR** deixava a câmera desktop dentro da bancada (raio 2,43 → 0,67). Agora a vista é salva
  na entrada e restaurada na saída (ISSUE-014).

### Encontrado (não corrigido nesta fase)
- ISSUE-013: a origem XR fica no centro da bancada. Corrigir na Fase 6.

### Preservado
- Todas as funcionalidades; GLB intocado.

### Testado
- `test:unit` 20/20 · `test:smoke` 52/52 em desktop, tablet e mobile · `test:xr` 16/16 (3 INFO).

## xr-f1-auditoria — 2026-10-07 (novo plano: laboratório de manutenção preditiva, Fase 1)

### Adicionado
- `AUDITORIA_XR.md`:
  - estado real da aplicação × especificação (32 requisitos);
  - auditoria do tracking WebXR;
  - métricas da cena (932 mil triângulos, 115 draw calls, 242 malhas pickáveis);
  - riscos por fase;
  - plano das Fases 2–13.

### Alterado
- Nenhum código.

## v4.3-curvas-verdes — 2026-10-07 (pedido do usuário)

### Alterado
- **Curvas 90° da tubulação em verde (#2E8B47)**, 10 curvas, com `metallic: 0` e `roughness: 0.17`
  (o mesmo acabamento dos tubos; no CAD elas eram aço polido e o verde ficaria espelhado).
- `src/twin/appearance.js`: nova opção `roughness`.
- Smoke test: "Curvas de aço mantidas" virou "Curvas da tubulação em verde (sem acabamento metálico)".

### Preservado
- Flanges, válvulas, registros, manômetros, motor e quadro sem alteração; GLB inalterado.

### Testado
- `npm run test:unit`: 20/20.
- `npm run test:smoke`: 52/52 em desktop, tablet e mobile.
- Screenshot da visão geral conferido.

## v4.2-tubos-verdes — 2026-10-07 (pedido do usuário)

### Alterado
- **Tubos em verde (#2E8B47)**, a mesma cor da carcaça: `PIPE MASTER …` e `PIPE part …`, 30 tubos.
  As curvas de aço (`Curva 90° …`) mantêm o acabamento metálico; para pintá-las também, basta
  incluir o prefixo em `src/config/appearance.js`.
- `src/twin/appearance.js`:
  - seleção por prefixo de nome (`prefixes`);
  - suporte a peças instanciadas: a geometria compartilhada só é recolorida quando todas as cópias
    pertencem ao grupo (caso contrário, avisa e mantém);
  - opção `metallic`.

### Preservado
- GLB inalterado; materiais originais em `metadata.originalMaterial`; todas as funções da v4.1.

### Testado
- `npm run test:unit`: 20/20.
- `npm run test:smoke`: 52/52 em desktop, tablet e mobile (2 testes novos: tubos verdes, inclusive as
  instâncias, e curvas de aço mantidas).
- Screenshot da visão geral conferido.

## v4.1-ajustes — 2026-10-06 (pedido do usuário antes da Etapa 5)

### Adicionado
- **Carcaça da bomba em verde (#2E8B47):** `src/config/appearance.js` + `src/twin/appearance.js`.
  - Peças: `casing oficial-1` (voluta), `coupling-1` (tampa/suporte da carcaça, apesar do nome
    no CAD) e `House Bearing-1` (caixa do mancal); 11 malhas.
  - O GLB não é alterado. Os materiais compartilhados são clonados só para essas peças, e o
    original fica em `mesh.metadata.originalMaterial` para os futuros modos Raio-X e Térmico.
- **Painel de controle dentro do headset**, com o botão **"Sair da imersão"** (`src/xr/vrPanel.js`).
  - Painel 3D em Babylon GUI, sem iluminação, desenhado por cima do modelo.
  - Segue o olhar do usuário, a 0,85 m e um pouco abaixo da linha dos olhos; só se reposiciona ao
    sair de um cone de 40°.
  - Aparece ao entrar na sessão imersiva e some ao sair.
  - O botão chama `exitXRAsync()`. Funciona com o raio dos controles do Quest (seleção padrão do Babylon).
- `src/xr.js`: `exit()` e `onImmersiveChange()` (alteração mínima; o resto do WebXR intacto).
- Testes:
  - carcaça verde;
  - materiais originais preservados nas outras peças;
  - painel VR oculto fora da imersão;
  - clique real no "Sair da imersão" (com o HTML oculto, como no headset).

### Corrigido
- `twin.project()` passou a calcular a projeção pelas matrizes da câmera. O `scene.getTransformMatrix()`
  podia retornar a matriz de um render target e gerar coordenadas erradas (só afetava os testes).

### Preservado
- Todas as funcionalidades da v4. O fluxo de entrada no VR continua o mesmo.

### Testado
- `npm run test:unit`: 20/20.
- `npm run test:smoke`: 50/50 em desktop, tablet e mobile.
- Screenshots: carcaça verde em close e painel VR.
- **Não testado num Meta Quest real** (sem headset neste ambiente).

## v4-digital-twin — 2026-10-06

### Adicionado
- `src/config/sensors.js`: os 4 sensores (modelo, tipo, grandeza, local, interface e notas), com
  âncora na peça do GLB (posição relativa à bounding box + offset) e enquadramento de câmera.
  As **posições são propostas**:
  - MPU6050 e MAX6675 → `House Bearing-1` (mancal);
  - SCT013 → `CEMAR-1` (quadro elétrico);
  - Sensor RPM → `PUMP PROTECTION-1` (proteção do acoplamento).
- `src/twin/hotspots.js`: hotspots em Babylon GUI (rótulo "modelo · valor" com haste e ponto),
  ancorados em TransformNodes filhos da peça (acompanham a peça), com cor por estado. Destaque da
  peça com `HighlightLayer`, sem alterar materiais. Rótulos de sensores muito próximos ficam
  empilhados. Rótulos atrás de geometria ficam translúcidos (raycast a cada 400 ms).
- `src/twin/cameraFocus.js`: transição suave (ease in-out, 0,9 s) de alvo, raio, alpha e beta pelo
  menor caminho angular. Qualquer interação do usuário cancela a transição.
- `src/twin/framing.js`: mantém o sensor focado no centro da área livre de painéis
  (`targetScreenOffset`, sem mexer em alvo, órbita ou zoom).
- `src/twin/sensorPanel.js`: painel técnico com leitura ao vivo, estado, tendência, histórico
  (sparkline das últimas 120 amostras com linhas de limite), limites, origem dos dados (SIMULAÇÃO /
  TEMPO REAL), horário, interface, tipo, local e "Centralizar no sensor".
- `src/twin/index.js`: orquestração.
  - **KPI → sensor → foco da câmera → painel.**
  - **Hotspot → sensor → KPI → telemetria → histórico**, sem mover a câmera.
  - Fechar o painel (✕ ou Esc) limpa a seleção.
- Helpers de console: `mecmonitor.twin.moveHotspot(id, x, y, z)`, `mecmonitor.twin.select(id)`.
- Smoke test: 13 testes novos.
  - Hotspots: 4 presentes, ancorados até 2 cm da peça, geometria inalterada.
  - Clique real no KPI: seleção, câmera no sensor, painel com o mesmo valor do KPI, histórico e origem.
  - Sensor focado visível fora dos painéis.
  - Clique real no hotspot do canvas: seleciona sem mover a câmera.
  - Fechar, Esc, e Recentrar após o foco.

### Alterado
- `src/dashboard.js`: os cards de KPI viraram `<button>` (`aria-pressed`), com `onSelect`/`setSelected`.
- `src/main.js`: cria o Digital Twin após o carregamento. "Recentrar" cancela o foco e remove o deslocamento de enquadramento.
- `index.html`: `#sensorPanel`.
- `src/style.css`:
  - hover, foco e selecionado nos cards;
  - painel lateral no desktop e tablet; bottom sheet no celular (40% da altura, opaco);
  - no celular, com o painel aberto, o card de saúde e o dock ficam ocultos e voltam ao fechar.
- `src/header.js`: o estado "sem dados" é limpo assim que chega uma amostra.

### Corrigido
- Durante a etapa:
  - no celular, o sensor focado ficava escondido sob o painel (corrigido com o enquadramento por área livre);
  - os rótulos do MPU6050 e do MAX6675 se sobrepunham;
  - o SCT013 aparecia "através" do modelo (agora fica translúcido).

### Preservado
- Geometria, hierarquia e materiais do GLB (testado); câmera (órbita, zoom, Recentrar), header,
  KPIs, saúde, telemetria (SIMULAÇÃO/TEMPO REAL) e WebXR (`xr.js` sem alteração).

### Testado
- `npm run test:unit`: 20/20.
- `npm run test:smoke`: 46/46 em desktop, tablet e mobile.
- Screenshots conferidos: visão geral, foco de cada sensor no desktop e foco no celular.
- Observação: algumas execuções falharam com `net::ERR_NETWORK_CHANGED` (a rede da máquina mudou
  durante o teste e o Chrome abortou requisições, até para localhost). Repetidas, passaram.
- O teste de queda da conexão foi ajustado: passa a aceitar "conectando…" e "sem conexão" e usa
  polling por tempo em vez de requestAnimationFrame.

## v3-telemetry — 2026-10-06

### Adicionado
- `src/telemetry/telemetryService.js`: fonte única de dados com um provider ativo por vez,
  status (connecting/online/offline/error) e proteção contra callbacks de provider antigo.
  **Carimba `source` pelo tipo do provider**, então o payload não consegue se apresentar como real.
- `simulationProvider` (envolve `simulation.js` sem alterá-lo), `websocketProvider` (reconexão
  com backoff) e `mqttProvider` (biblioteca `mqtt` 5.16 carregada sob demanda, em chunk separado).
- `src/telemetry/normalize.js`: aceita aliases, strings numéricas, bytes e timestamp em s ou ms,
  com proteção contra relógio do ESP32 fora de sincronia.
- `src/telemetry/index.js` + `src/config/telemetry.js`: seleção por URL
  (`?source=ws|mqtt&url=…&topic=…`). Credenciais nunca vêm da URL.
- Header: chip **● SIMULAÇÃO** (âmbar) / **● TEMPO REAL** (verde). O chip ESP32 reflete a conexão
  real (online / conectando… / sem conexão / erro).
- Dashboard: o rótulo da origem segue a fonte da amostra exibida. Após 5 s sem dados, os valores ficam esmaecidos.
- `TELEMETRY.md`: arquitetura, contrato do payload e exemplo de firmware ESP32.
- Testes: 11 novos testes unitários (20 no total). Smoke test com teste ponta a ponta de tempo real:
  um servidor WebSocket local simula o ESP32 e o teste verifica TEMPO REAL, ESP32 online, valores,
  limites (61,4 °C / 3,1 mm/s → ALERTA) e queda sem fallback para simulação.

### Alterado
- `src/main.js`: `startSimulation` direto → `TelemetryService`.
- `src/header.js`: `onStatus()`; o tempo sem dados é medido pela chegada, não pelo timestamp do dispositivo.
- `index.html`: chip `#chipSource` e `#sourceTag` dinâmico.
- `src/style.css`: estados `sim`/`stale`; o header quebra linha abaixo de 1120 px em vez de truncar o equipamento.
- `src/dashboard.js`: o delta da tendência fica sem unidade (ela já aparece ao lado do valor).

### Corrigido
- Durante a etapa: o nome do equipamento era truncado no tablet e o texto vazava no card de vibração.
  Os dois casos ganharam testes.

### Preservado
- `simulation.js` sem alteração; KPIs, saúde, header, dock, câmera, modelo e WebXR.
- O padrão continua sendo simulação, sem nenhum requisito de MQTT ou hardware.

### Testado
- `npm run test:unit`: 20/20.
- `npm run test:smoke`: 33/33 em desktop, tablet e mobile.

## v2-dashboard — 2026-10-06

### Adicionado
- `src/config/kpis.js`: definição dos 4 KPIs (rótulo, unidade, sensor, peso) com **limites provisórios**:
  - Temperatura: normal ≤ 60 °C, alerta ≤ 75 °C;
  - Vibração: normal ≤ 2,8 mm/s, alerta ≤ 4,5 mm/s (ISO 10816-3, grupo 2 rígido);
  - Corrente: normal ≤ 4,0 A, alerta ≤ 4,6 A;
  - RPM: normal 1700–1800, alerta 1650–1850.
- `src/health.js` (funções puras):
  - `classify` → normal/alerta/crítico;
  - `kpiScore`: 100 na referência, 85 no limite normal, 55 no limite de alerta;
  - `evaluate`: índice de saúde = média ponderada dos KPIs; estado global = pior KPI;
  - `trend`: média dos últimos 5 s vs 5 s anteriores, com zona morta por KPI.
- `src/dashboard.js`: card **Saúde do equipamento** (percentual, estado, barra) e 4 cards de KPI
  com valor, unidade, tendência (▲ ▼ ▶ + delta) e estado. Guarda histórico de 120 amostras por KPI.
- `scripts/unit-test.mjs` (`npm run test:unit`): 9 testes das regras.
- Smoke test: KPIs na ordem; valor, unidade, estado e tendência presentes; saúde coerente com a
  avaliação; status do header igual ao estado da saúde.

### Alterado
- `index.html`: o painel `#simPanel` virou `#dashboard`. O rótulo **● SIMULAÇÃO** foi mantido no card de saúde.
- `src/header.js`: o chip de status passa a refletir o estado real (NORMAL/ALERTA/CRÍTICO) e a
  altura do dock é exposta em `--dock-h`.
- `src/main.js`: `wireSimulationPanel` → `wireDashboard`.
- `src/style.css`: estilos do painel de simulação substituídos pelos do dashboard (desktop em coluna,
  celular em 4 colunas compactas com rótulo curto "Temp.").

### Corrigido
- Durante a etapa: o badge de estado era cortado ao lado do rótulo; o card foi reorganizado
  (rótulo / valor / rodapé com tendência e estado).

### Preservado
- Header (v1), dock, câmera, modelo, `simulation.js` (sem alteração), WebXR.

### Testado
- `npm run test:unit`: 9/9.
- `npm run test:smoke`: 25/25 em desktop, tablet e mobile.
- Screenshots conferidos.

## v1-ux-foundation — 2026-10-06

### Adicionado
- Header em vidro com marca **MECMONITOR**, "Digital Twin · Predictive Maintenance",
  equipamento **Bomba Centrífuga · P-01**, chips de status (**● NORMAL**, **● ESP32**) e
  **Última atualização** (hh:mm:ss da última amostra).
- `src/header.js`: atualiza o status e o horário a cada amostra, mostra "SEM DADOS" se não chegar
  amostra por mais de 5 s e expõe `--header-h` (ResizeObserver) para os painéis nunca sobreporem o header.
- Dock de controles agrupados: **VISUALIZAÇÃO** (Normal | Sensores | Raio-X | Térmico, como controle
  segmentado), **CÂMERA** (Recentrar, Tela cheia) e **IMERSÃO** (Entrar em VR), com ícones SVG inline.
- Testes novos no `smoke-test.mjs`: textos do header, equipamento visível, status, ESP32 não exibido
  como conectado, horário, grupos, modo ativo, painéis sem sobreposição, painéis dentro da tela e
  ausência de scroll horizontal. Novo viewport `VIEWPORT=tablet` (820×1180).

### Alterado
- `src/style.css`: novo sistema visual com tokens de cor, tipografia, glassmorphism discreto,
  estados hover/focus-visible/active/disabled, `prefers-reduced-motion` e 3 breakpoints
  (1120 / 860 / 640 px, além de 380 px, em que os botões ficam só com ícone).
- `index.html`: o bloco do header e da toolbar virou header + dock. Os IDs existentes foram mantidos.
- `src/main.js` (alteração mínima): liga `createHeader()` à simulação e troca o rótulo da tela cheia
  em `.btn-label`, sem apagar o ícone.
- Tela de carregamento com a marca.

### Decisões
- Sensores, Raio-X e Térmico aparecem **desabilitados ("em breve")** até a Etapa 6.
- O chip ESP32 mostra **"sem conexão"** (cinza): não há ESP32 real e os dados são simulados.
- **NORMAL** indica só que há dados chegando. Os limites reais vêm na Etapa 5.
- Abaixo de 860 px o subtítulo "Digital Twin · Predictive Maintenance" fica oculto para caber o equipamento.

### Corrigido
- Nada da versão anterior. Durante a etapa: o header quebrava em 2 linhas no celular e se sobrepunha
  ao painel de simulação; o teste "Simulação atualiza" era instável e agora compara timestamps.

### Preservado
- Modelo 3D, câmera (órbita, zoom, pan, enquadramento), simulação, WebXR (`xr.js` sem alteração),
  carregamento e todos os IDs.

### Testado
- `npm run build` OK.
- `npm run test:smoke`: 22/22 PASS em desktop (1366×768), tablet (820×1180) e mobile (390×844).
- Screenshots conferidos nas 3 resoluções.

## v0.5-app-base — 2026-10-06

### Adicionado
- Projeto Vite 8 + Babylon.js 9.29.0 (`@babylonjs/core`, `loaders`, `gui`, com versões fixas) e `base: "./"`.
- `index.html` com canvas, barra superior (marca + Recentrar / Tela cheia / Entrar em VR),
  painel de simulação e tela de carregamento com progresso real.
- `src/scene.js`: engine, cena, ArcRotateCamera (órbita, zoom, pan, limites), luz hemisférica +
  direcional, environment map local (`public/env`), piso em y = 0 e enquadramento que considera
  o FOV mais estreito (retrato ou paisagem).
- `src/modelLoader.js`: carrega `public/models/bomba-draco.glb` num container-pivot, recentraliza,
  apoia a base em y = 0 e descarta a câmera ortográfica do SolidWorks. O decoder Draco é servido
  localmente (`public/draco`), sem depender de CDN.
- `src/simulation.js`: simulação mínima de temperatura, vibração, corrente e RPM, sempre rotulada
  "● SIMULAÇÃO".
- `src/xr.js`: verifica `isSecureContext`, `navigator.xr` e `isSessionSupported("immersive-vr")`.
  Sem headset, o botão fica desabilitado com a mensagem "VR não detectado neste dispositivo.".
- Helper de console: `mecmonitor.ajustarRotacaoGraus(x, y, z)`.
- `scripts/smoke-test.mjs` (`npm run test:smoke`), teste automatizado em Chrome headless.

### Alterado
- Nada (não havia aplicação).

### Corrigido
- ISSUE-001, 002, 003 e 005 (ver ISSUES.md).

### Preservado
- `bomba.glb` original e as versões otimizadas na raiz; documentos da v0.

### Testado
- `npm run build` sem erros.
- `npm run test:smoke` em desktop (1366×768) e mobile (390×844): 12/12 PASS, cobrindo modelo
  carregado (240 partes), base em y = 0 e centrado, zoom, órbita, recentrar, simulação
  atualizando, rótulo SIMULAÇÃO, botão VR coerente sem headset, tela cheia e console sem erros.
- Inspeção visual por screenshot: modelo de pé, metálicos corretos, enquadramento completo
  também no celular.

## v0-baseline — 2026-10-05

### Adicionado
- `PROJECT_BASELINE.md`: auditoria do estado inicial (só o asset 3D, nenhuma aplicação ainda).
- `CHANGELOG.md`, `ISSUES.md`, `BACKLOG.md`.
- `.gitignore` e repositório Git com o checkpoint `v0-baseline`.
- Versões otimizadas do modelo, geradas antes do roteiro: `bomba-draco.glb` (1,75 MB),
  `bomba-meshopt.glb` (3,3 MB) e `bomba-quantizado.glb` (8,3 MB).

### Alterado
- Nada.

### Corrigido
- Nada.

### Preservado
- `bomba.glb` original (40,4 MB), sem nenhuma alteração.

### Testado
- `gltf-transform inspect` no original e na versão Draco: mesma bounding box, mesmos 185 nós
  e mesma contagem de vértices renderizados (2.798.142).
