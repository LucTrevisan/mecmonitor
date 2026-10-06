# CHANGELOG — MecMonitor

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
