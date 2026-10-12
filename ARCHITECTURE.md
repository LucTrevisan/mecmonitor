# MecMonitor — Arquitetura (estado em `xr-f2-estabilizacao`)

## Fluxo de dados

```text
ESP32 (MPU6050 · MAX6675 · SCT013 · RPM)
   │ JSON (WebSocket ou MQTT/WSS)
   ▼
telemetry/  ── TelemetryService (1 provider ativo; carimba source = simulation | realtime)
   │  providers: simulationProvider (padrão) · websocketProvider · mqttProvider (lazy)
   │  normalize.js: aliases, timestamps, validação
   ▼ onSample(sample) / onStatus(status)
main.js ───────────────► dashboard.js ─ health.js (classify / kpiScore / evaluate / evaluateLatest / trend) ─ config/kpis.js
   │                        │ ui/states.js: NORMAL ✓ · ALERTA ⚠ · CRÍTICO ✖ · SEM DADOS – (ícone + texto + cor)
   │                        │ result (estado por KPI, saúde %)
   │                        ▼
   ├──────────────► header.js (status, DADOS REAIS/SIMULAÇÃO, ESP32 ● ONLINE/○ OFFLINE)
   └──────────────► twin/ (Digital Twin)
                       index.js        orquestra KPI ↔ sensor ↔ câmera ↔ painel
                       hotspots.js     rótulos GUI ancorados nas peças, highlight, oclusão
                       sensorPanel.js  painel técnico + sparkline
                       cameraFocus.js  transição suave da ArcRotateCamera
                       framing.js      mantém o alvo na área livre de painéis
                       appearance.js   recoloração por peça (config/appearance.js)
```

## Cena e modelo

| Módulo | Responsabilidade | Não deve |
|---|---|---|
| `scene.js` | Engine, cena, luzes, environment local, piso (y = 0), ArcRotateCamera, `frameCamera` | — |
| `modelLoader.js` | Decoder Draco local; carrega `public/models/bomba-draco.glb` num **container-pivot**, centra e apoia em y = 0; descarta a câmera do SolidWorks | Alterar o GLB, a hierarquia ou os nomes |
| `twin/appearance.js` | Clona o material por peça; o original fica em `mesh.metadata.originalMaterial` | Alterar materiais compartilhados com peças fora do grupo |

**Coordenadas:** metros, Y para cima, base da bancada em y = 0, centro da bancada em x = z = 0
(bounds: 1,76 × 1,85 × 1,00 m). O piso XR (`local-floor`) coincide com y = 0.

## WebXR

| Módulo | Responsabilidade |
|---|---|
| `xr.js` | `checkVRSupport()` (contexto seguro → `navigator.xr` → `isSessionSupported`); `setupXR()` = `createDefaultXRExperienceAsync` (`local-floor`, teleporte no piso, ponteiros padrão), `enter`, `exit`, `onImmersiveChange` |
| `xr/vrPanel.js` | Painel principal VR (Babylon GUI em malha, sem iluminação, `renderingGroupId = 1`): P-01 + estado + origem, TEMP / VIB / CORRENTE / RPM, menu de modos, Fixar/Seguir · Recentrar · Sair da imersão. Fica à esquerda da visão, acompanha o olhar (cone de 40°) ou fica fixo. Botões com nome: `press(nome)`, `buttonAt(ponto)`, `buttonWorld(nome)` |
| `xr/sensorCard.js` | Painel contextual do sensor selecionado: acima do sensor, virado para o usuário; valor, estado, tendência, localização, histórico curto e "×" |
| `xr/ar.js` (Fase 14) | Realidade aumentada (`immersive-ar`, mesma sessão do VR via `setupXR().enterAR`): `checkARSupport()` (iPhone/iPad sem WebXR); `createARMode()` esconde a oficina e o piso (ficam bancada, placas e quadro), fundo transparente, desliga o teleporte. Retículo + contorno da bancada por hit-test (ou no chão 1,5 m à frente sem resultados). O gatilho, a pinça ou o toque posiciona a bancada **deslocando o espaço de referência**, nunca o GLB. Só posiciona se o clique começou no modo de posicionamento e não acionou um botão ou sensor. Barra DOM overlay no celular (Reposicionar, Sair da RA). `prepare()` antes de entrar, `start()`/`stop()` na troca de estado |
| `xr/arPlacement.js` | Matemática pura do posicionamento (testada): `placementPose(cam, ponto, âncora)` = âncora + R·(cam − ponto), R = yaw que põe a frente (+z) da bancada voltada ao usuário |
| `main.js › wireVR` | Cria os painéis, registra os botões como alvos `vr:<nome>` do InteractionManager, sincroniza o painel do sensor com `twin.onSelectionChange`, liga entrada e saída e **guarda/restaura a vista desktop** ao sair do VR |

Pendências de XR (ver `AUDITORIA_XR.md` §3):
- **Fase 6:** origem XR no centro da bancada; teleporte sem restrição; ponteiros contra todas as malhas.
- **Fases 5, 7 e 8:** hotspots invisíveis no headset; hand tracking desabilitado.

## UI (DOM)

`index.html` + `style.css`:
- **Header:** marca, equipamento, status, origem e ESP32.
- **`#dashboard`:** saúde e KPIs (os KPIs são botões).
- **`#dock`:** Visualização, Câmera e Imersão.
- **`#sensorPanel`:** painel técnico (gaveta inferior no celular).

`--header-h` e `--dock-h` vêm de ResizeObserver para os painéis nunca se sobreporem.

## Pontos de extensão planejados

| Pasta futura | Fase | Conteúdo |
|---|---|---|
| `scene/workshop.js` + `config/school.js` | 7.1 ✔ | Oficina SENAI (paredes, teto, placa da escola, quadro do instrutor, bancada de ajustagem, 5S, extintor); móveis fora da área caminhável |
| `scene/lab.js › benchSign` + `config/bench.js` | 9.1 ✔ | Placas do pórtico da bancada como na bancada real: IMBIL · Soluções em Bombeamento (esquerda); FIESP/SESI/SENAI/IRS + logo SENAI (direita) |
| `scene/cabinet.js` + `config/bench.js › CABINET` | 9.1 ✔ | Painel elétrico como o real: manopla, botões, sinaleiro, seletora, emergência e plaquetas sobre a porta do gabinete `CEMAR-1` (só visual) |
| `sensors/` | 5 ✔ | `sensorBodies.js`: sensores físicos + volumes de interação (única geometria de sensor pickável) |
| `ui/historyPanel.js` | 5 ✔ | Histórico: small multiples, filtros, crosshair, tabela (dados em `telemetry/historyStore.js`) |
| `interaction/` | 8 ✔ | `interactionManager.js` (camada única: mouse · toque · controle · mão → `hover/select`), `pinch.js` (pinça com histerese/debounce/cooldown), `oneEuro.js` (filtro), `handInteraction.js` (raio da mão, pinça, interação direta) |
| `xr/` (ampliar) | 6–9 ✔ | Pose inicial, teleporte seguro e filtro de ponteiros (`xr.js`), `handTracking.js`, painel principal e menu (`vrPanel.js`), painel do sensor (`sensorCard.js`) |
| `twin/viewModes.js` + `config/viewModes.js` | 10 ✔ | NORMAL · SENSORES · RAIO-X · TÉRMICO: trocas de material registradas e restauradas, cartões 3D (`twin/modeCards.js`), escala térmica pura (`twin/thermalScale.js`), legenda HTML (`ui/thermalLegend.js`) |
| `training/` + `config/training.js` | 11 ✔ | `trainingEngine.js` (fluxo de 7 etapas, puro), cenários A–D, `telemetry/trainingProvider.js` (dados simulados), painéis `ui/trainingPanel.js` (desktop/celular) e `xr/trainingPanel3d.js` (headset) |
| `scene/` | 4 | Cenário de laboratório (elementos não pickáveis, fora do enquadramento) |

## Testes

| Comando | O que cobre | Tempo |
|---|---|---|
| `npm run test:unit` | Regras de saúde, tendência e telemetria (normalização, service, WS e MQTT com mocks) | ~1 s |
| `npm run test:smoke` | App em Chrome headless: modelo, câmera, dashboard, telemetria (inclui WebSocket real local), Digital Twin, cores, painel VR (`VIEWPORT=desktop\|tablet\|mobile`) | ~4–5 min por viewport |
| `npm run test:perf` | Desempenho estrutural por modo (draw calls, triângulos, malhas pickáveis, texturas, render targets, observers, CPU) contra um orçamento | ~1 min |
| `npm run test:live` | Site publicado (GitHub Pages): HTTPS, GLB/Draco/ambiente/logo, requisições, console, telemetria, HUD | ~30 s |
| `npm run test:xr` | Sessão WebXR real com **Meta Quest 3 emulado (IWER)**: entrada, pose inicial, teleporte, controles, mãos (raio, pinça, interação direta), painéis VR (valores = dashboard, painel do sensor, Recentrar, Fixar/Seguir), saída, restauração da vista, reentrada | ~10 min (render por software, ~2 s/quadro) |

O CI (`.github/workflows/deploy.yml`) roda `test:unit` + build + deploy no GitHub Pages a cada push em `main`.

## Checkpoints

Tags `v0-baseline` … `v4.3-curvas-verdes` (roteiro anterior) e `xr-f1-auditoria`, `xr-f2-estabilizacao` (plano atual).
**`backup-pre-xr`** marca o último estado antes de qualquer alteração de XR deste plano.
