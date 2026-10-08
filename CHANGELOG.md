# CHANGELOG — MecMonitor

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
