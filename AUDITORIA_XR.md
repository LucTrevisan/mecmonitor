# MecMonitor — Auditoria (Fase 1 do plano "Laboratório Virtual de Manutenção Preditiva")

Data: 2026-10-07 · Base auditada: `main` @ `9403dd8` (tag `v4.3-curvas-verdes`)
Publicação: https://luctrevisan.github.io/mecmonitor/ · **Nenhum código foi alterado nesta fase.**

---

## 1. Estado atual: o que existe de fato

| Área | Implementação | Arquivos |
|---|---|---|
| Modelo | `bomba-draco.glb` (Draco, 1,75 MB), em container-pivot, centrado, base em y = 0, escala real em metros (1,76 × 1,85 × 1,00 m). GLB nunca modificado | `modelLoader.js` |
| Aparência | Carcaça, tubos e curvas em verde por clonagem de material; o original fica em `metadata.originalMaterial` | `twin/appearance.js`, `config/appearance.js` |
| Câmera desktop | ArcRotate (órbita, zoom, pan), enquadramento por FOV, Recentrar, foco suave por sensor, enquadramento pela área livre de painéis | `scene.js`, `twin/cameraFocus.js`, `twin/framing.js` |
| Telemetria | `TelemetryService` com providers: simulação (padrão), WebSocket, MQTT; carimbo SIMULAÇÃO/TEMPO REAL; ESP32 online/sem conexão; SEM DADOS após 5 s | `telemetry/*`, `header.js` |
| Dashboard | Saúde (%), 4 KPIs (Temp., Vibração, Corrente, RPM) com valor, unidade, tendência e estado; limites provisórios | `dashboard.js`, `health.js`, `config/kpis.js` |
| Sensores | 4 hotspots (MPU6050, MAX6675, SCT013, RPM) ancorados em peças do GLB; painel técnico com sparkline de 2 min, limites, origem; KPI ↔ sensor | `twin/*`, `config/sensors.js` |
| WebXR | `createDefaultXRExperienceAsync` (`local-floor`, teleporte no piso, ponteiros padrão); painel 3D "Sair da imersão" que acompanha o olhar | `xr.js`, `xr/vrPanel.js` |
| Modos | **Só "Normal" funciona**: Sensores, Raio-X e Térmico estão desabilitados ("em breve") | `index.html` |
| Testes | 20 unitários (Node) + 52 ponta a ponta (Chrome headless) em 3 viewports; CI no GitHub Actions com testes unitários + build + deploy | `scripts/*`, `.github/workflows/deploy.yml` |

**Divergências entre a especificação e a realidade.** A especificação pede para "manter funcionando"
itens que **ainda não existem**. Eles serão **implementados**, não preservados:
- modos Sensores, Raio-X e Térmico (botões desabilitados);
- histórico com gráficos temporais (hoje só há um sparkline de 2 min no painel do sensor);
- hand tracking, interação XR com sensores e menu XR;
- "movimentação existente" e "animações existentes": o GLB não tem animações e nada se move além da câmera.

## 2. Requisitos da especificação × situação

Legenda: ✅ atende · 🟡 parcial · ❌ não existe

| # | Requisito | Situação | Observação |
|---|---|---|---|
| 1 | Preservar a lógica existente | ✅ | Base estável; 72 testes cobrem regressões |
| 2 | Identificação P-01 / M-01; T-01 / VIB-01 / I-01 | 🟡 | P-01 só no header; **M-01 não aparece**; os sensores usam nomes de modelo (MPU6050…) e não tags |
| 3 | Cenário de laboratório | 🟡 | Só um piso cinza liso e um fundo escuro: sem demarcação, placas nem iluminação industrial |
| 4 | Sensores: hotspot, tooltip, tag, valor, unidade, estado, posição 3D | 🟡 | Tem hotspot, valor, unidade, estado e posição. Falta a **tag**; não há **representação física** do sensor; a área de clique é só o rótulo |
| 5 | Painel contextual (tag, valor, estado, tendência %, local, Histórico, Localizar) | 🟡 | Já existe; a tendência é absoluta (não %) e o botão "Localizar" se chama "Centralizar no sensor" |
| 6 | Estados NORMAL / ALERTA / CRÍTICO / SEM DADOS com ícone + texto + cor | 🟡 | Texto + cor existem, **sem ícone**; SEM DADOS existe só no header, **não por KPI** |
| 7–9 | Modos Normal / Sensores / Raio-X / Térmico | ❌ | Só Normal; os materiais originais já estão guardados, o que viabiliza a restauração |
| 10 | Telemetria: ● ONLINE / ○ OFFLINE; DADOS REAIS × SIMULAÇÃO | 🟡 | Existe ("TEMPO REAL"/"SIMULAÇÃO", "ESP32 online/sem conexão"); falta padronizar ícones e texto |
| 11 | Gráficos temporais com limites e tendência | ❌ | Só o sparkline |
| 12 | Modo Treinamento com cenários | ❌ | — |
| 13–14 | Tracking WebXR | 🟡 | Ver §3 |
| 15–18 | Hand tracking, pinch com histerese, filtragem | ❌ | A feature `HAND_TRACKING` não é habilitada |
| 19–20 | Raio da mão, interação direta | ❌ | — |
| 21–22 | Camada comum de interação; troca controle ↔ mão | ❌ | Mouse: GUI e eventos DOM; XR: ponteiro padrão do Babylon; **não há camada comum** |
| 23–24 | Feedback das mãos; colliders de interação | ❌ | Os hotspots são GUI 2D em tela cheia, **invisíveis no headset** |
| 25 | Teleporte seguro e posição inicial | ❌ | Ver §3 |
| 26–27 | Painel XR de telemetria e menu XR | 🟡 | Só o painel com "Sair da imersão" |
| 28 | Segurança da interação | 🟡 | O botão de sair tem hover, mas sem confirmação |
| 29 | UX cross-platform | 🟡 | Desktop e mobile bons; XR mínimo |
| 30 | Performance XR | ❌ | Ver §4 |
| 31 | GLB intocado | ✅ | Testado: geometria, hierarquia e bounding box inalteradas |
| 32 | Arquitetura por domínios | 🟡 | Já está modular (`telemetry/`, `twin/`, `xr/`, `config/`); faltam `interaction/` e `training/` |

## 3. Auditoria do tracking WebXR

Configuração atual (`src/xr.js`): `createDefaultXRExperienceAsync({ floorMeshes: [ground], disableDefaultUI: true })`
e sessão `immersive-vr` com `local-floor`.

| Item | Situação encontrada | Risco | Correção proposta (Fase 6) |
|---|---|---|---|
| Referência espacial | `local-floor`: correto para uso em pé; o piso XR é y = 0, igual à base do modelo | Baixo | Manter; fallback para `local` se `local-floor` não existir |
| Escala | Modelo em metros, sem `worldScaleFactor` | Nenhum | Manter |
| **Origem XR** | Pela leitura do código, o Babylon copiaria a posição XZ da câmera desktop. **Medido no Quest 3 emulado (Fase 2): a cabeça começa em (0; 1,6; 0), no centro da bancada, dentro da bomba** | **Alto**: com a câmera focada num sensor (raio 0,75 m) ou com zoom, o usuário começa **dentro da bancada** ou atrás dela; com a vista padrão começa a 2,3 m, na diagonal | Pose inicial fixa via `onInitialXRPoseSetObservable`: na frente da bancada (~1,6–1,8 m), de frente para P-01, independente da câmera desktop |
| Altura do usuário | O 1º frame soma a altura real da cabeça (`compensateOnFirstFrame`) | Baixo | Manter; não forçar altura |
| Orientação | Só o yaw é copiado (bom) | Baixo | Coberto pela pose inicial fixa |
| **Teleporte** | Piso de ~10 × 10 m inteiro é alvo, **inclusive sob a bancada** | **Alto**: o usuário pode teleportar para dentro da bomba ou da bancada | Malha de área segura ao redor da bancada, sem a projeção da bancada; limites |
| **Ponteiros** | Os rays do controle testam **todas as 242 malhas** a cada frame | Médio-alto (custo e seleção acidental de peças) | Filtro: só objetos interativos (painéis, colliders dos sensores) |
| Hotspots | GUI 2D em tela cheia: **não aparecem no VR** | Alto (os sensores não existem dentro do headset) | Hotspots 3D com colliders (Fases 5 e 8) |
| Hand tracking | Não habilitado; o Quest passa para as mãos sem ponteiro útil | Alto | Feature `HAND_TRACKING` + gestos (Fases 7 e 8) |
| Troca controle ↔ mão | Padrão do Babylon, não testado | Médio | Gerenciar a fonte de entrada ativa por mão (Fase 7) |
| Entrada e saída | Funcionam (eventos `IN_XR`/`NOT_IN_XR`); painel 3D com "Sair da imersão". **Bug encontrado na Fase 2:** ao sair, o Babylon copiava a pose da cabeça para a câmera desktop (raio 2,43 → 0,67, dentro da bancada) | — | **Corrigido na Fase 2** (vista desktop salva na entrada e restaurada na saída; testado) |
| Jitter, saltos, ray desalinhado | **Não verificável sem o Quest** | ? | Medir no Quest na Fase 6, depois das correções acima |

## 4. Performance (medida no desktop, render por software; números estruturais)

| Métrica | Valor | Leitura para o Quest |
|---|---|---|
| Triângulos ativos | **932.716** | **Acima do confortável** para Quest 2/3 a 72–90 Hz × 2 olhos. Os volantes `Manopla-1` (×2) somam ~154 mil (ISSUE-004) |
| Draw calls por frame | **115** (127 malhas já instanciadas) | Aceitável; ~2× em estéreo sem multiview |
| Malhas / pickáveis | 242 / **242** | Todas pickáveis: os raycasts de XR e de oclusão varrem tudo |
| Materiais / texturas / luzes | 61 / 6 / 2 | OK; sem sombras e sem pós-processamento |
| HighlightLayer | 1 (sempre ativa) | Custo de render-target; reavaliar no XR |
| Observers por frame | 4 antes, 2 depois do render | OK; o raycast de oclusão roda a cada 400 ms contra toda a cena |
| Bundle JS | **6,2 MB** (índice completo do Babylon) | Carregamento lento no Quest (ISSUE-006) |
| FPS real no Quest | **Não medido** | Medir na Fase 12 (e já na Fase 6) |

## 5. Riscos de regressão por fase

- **Cenário (Fase 4):** elementos novos não podem ser pickáveis nem atrapalhar o enquadramento (`frameCamera` usa as bounds da bomba, não da cena) nem o teleporte.
- **Sensores (Fase 5):** trocar MPU6050 → VIB-01 etc. muda textos verificados em testes. A tag vira o identificador visível e o modelo do sensor continua no painel. O RPM não está na lista principal da especificação: proposta é mantê-lo como **sensor secundário**, sem removê-lo.
- **XR (Fases 6–9):** mexer em ponteiros e teleporte não pode afetar desktop e mobile. Tudo fica isolado em `xr/` e `interaction/`.
- **Raio-X e Térmico (Fase 10):** precisam restaurar exatamente os materiais (incluindo os verdes). Já existe `originalMaterial`, mas a restauração precisa considerar o "material verde" como a base do modo Normal.
- **Performance (Fase 12):** simplificar os volantes (`Manopla-1`) é decimação **em tempo de build num GLB derivado**, nunca no `bomba.glb`, e só com aprovação.

## 6. Plano de execução proposto (fases da especificação)

| Fase | Entrega | Checkpoint |
|---|---|---|
| 1 | Esta auditoria | `xr-f1-auditoria` |
| 2 | Backup e estabilização: tag de backup, documentação da arquitetura e teste XR emulado (sessão simulada no headless para entrada/saída/painel) | `xr-f2-estabilizacao` |
| 3 | UX: tags P-01, M-01, T-01, VIB-01, I-01; estados com ícone + texto + cor; SEM DADOS por KPI; ● ONLINE / ○ OFFLINE; DADOS REAIS × SIMULAÇÃO | `xr-f3-ux` |
| 4 | Cenário: piso técnico, demarcação de segurança, placas P-01/M-01, iluminação industrial (sem novas malhas pickáveis) | `xr-f4-cenario` |
| 5 | Sensores: representação física discreta, colliders de interação, painel no formato pedido, **gráficos temporais** (item 11) | `xr-f5-sensores` |
| 6 | Tracking: pose inicial fixa, área segura de teleporte, filtro de ponteiros, restauração ao sair | `xr-f6-tracking` |
| 7 | Hand tracking: juntas, troca controle ↔ mão, representação discreta | `xr-f7-maos` |
| 8 | `InteractionManager` (mouse, touch, controle, mão): point, pinch com histerese, near interaction | `xr-f8-interacao` |
| 9 | Painéis XR (telemetria) e menu XR (modos + treinamento) | `xr-f9-paineis` |
| 10 | Modos Sensores, Raio-X (transparência seletiva) e Térmico (ligado ao T-01, escala BAIXA → CRÍTICA) | `xr-f10-modos` |
| 11 | Modo Treinamento: cenários e fluxo inspeção → diagnóstico → feedback | `xr-f11-treinamento` |
| 12 | Performance (Quest) | `xr-f12-performance` |
| 13 | Testes no Meta Quest (roteiro do item 33) e relatório | `xr-f13-quest` |

Este plano **substitui as Etapas 5–9 do roteiro anterior**, que estão cobertas pelas Fases 3–13:
- Etapa 5 (histórico e diagnóstico) → Fases 5 e 11;
- Etapa 6 (modos) → Fase 10;
- Etapa 7 (WebXR) → Fases 6–9;
- Etapa 8 (performance) → Fase 12;
- Etapa 9 (QA) → Fase 13.

## 7. Limitação de verificação

Não há Meta Quest neste ambiente. Os itens de tracking, mãos, pinch, troca controle ↔ mão e FPS
**só podem ser confirmados por você no headset**. Para cada fase de XR vou entregar:
- teste automatizado do que for verificável (lógica de pinch, histerese, filtros, seleção, pose inicial);
- **roteiro curto de teste no Quest** para você executar e me devolver o resultado.
