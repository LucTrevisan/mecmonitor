# CHANGELOG — MecMonitor

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
