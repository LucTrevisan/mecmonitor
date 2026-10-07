# CHANGELOG — MecMonitor

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
