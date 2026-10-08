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
| `xr/vrPanel.js` | Painel 3D (Babylon GUI em malha, sem iluminação, `renderingGroupId = 1`) com "Sair da imersão"; acompanha o olhar (cone de 40°) |
| `main.js › wireVR` | Cria o painel, liga entrada e saída e **guarda/restaura a vista desktop** ao sair do VR |

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
| `sensors/` | 5 ✔ | `sensorBodies.js`: sensores físicos + volumes de interação (única geometria de sensor pickável) |
| `ui/historyPanel.js` | 5 ✔ | Histórico: small multiples, filtros, crosshair, tabela (dados em `telemetry/historyStore.js`) |
| `interaction/` | 8 | `InteractionManager`: mouse · touch · controle · mão → `hover/select/grab/release` |
| `xr/` (ampliar) | 6–9 | `XRManager` (pose inicial, teleporte seguro, filtro de ponteiros), `HandTrackingManager`, painéis e menu XR |
| `training/` | 11 | `TrainingManager` e cenários |
| `scene/` | 4 | Cenário de laboratório (elementos não pickáveis, fora do enquadramento) |

## Testes

| Comando | O que cobre | Tempo |
|---|---|---|
| `npm run test:unit` | Regras de saúde, tendência e telemetria (normalização, service, WS e MQTT com mocks) | ~1 s |
| `npm run test:smoke` | App em Chrome headless: modelo, câmera, dashboard, telemetria (inclui WebSocket real local), Digital Twin, cores, painel VR (`VIEWPORT=desktop\|tablet\|mobile`) | ~4–5 min por viewport |
| `npm run test:xr` | Sessão WebXR real com **Meta Quest 3 emulado (IWER)**: entrada, painel, controles, controle ↔ mão, saída, restauração da vista, reentrada | ~1–2 min |

O CI (`.github/workflows/deploy.yml`) roda `test:unit` + build + deploy no GitHub Pages a cada push em `main`.

## Checkpoints

Tags `v0-baseline` … `v4.3-curvas-verdes` (roteiro anterior) e `xr-f1-auditoria`, `xr-f2-estabilizacao` (plano atual).
**`backup-pre-xr`** marca o último estado antes de qualquer alteração de XR deste plano.
