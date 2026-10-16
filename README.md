# MecMonitor — Bomba Centrífuga P-01

Digital Twin web (Babylon.js + Vite) da bancada de bomba centrífuga.

```bash
npm install
npm run dev          # servidor local (use HTTPS/tunnel para testar WebXR no Quest)
npm run build        # gera dist/
npm run test:unit    # regras de saúde e telemetria (Node)
npm run test:smoke   # testa o build em Chrome/Edge headless (rode após o build)
npm run test:xr      # sessões VR e RA com Meta Quest 3 emulado (IWER), após o build
npm run test:perf    # desempenho estrutural por modo (draw calls, triângulos…) contra um orçamento
npm run test:ux      # layout responsivo em 11 resoluções (após o build)
npm run test:live    # testa o site publicado (GitHub Pages); relatório completo em QA_REPORT.md
```

- Modelo usado pela aplicação: `public/models/bomba-draco.glb`. O original de 40 MB fica em `bomba.glb`.
- Realismo do modelo (cores, estrutura tubular, IHM WEG) conforme as fotos da bancada real: `node scripts/glb-realismo.mjs <original.glb> public/models/bomba-draco.glb`, com o original de `git show xr-f14-ra:public/models/bomba-draco.glb`.
- Ajuste de orientação pelo console do navegador: `mecmonitor.ajustarRotacaoGraus(x, y, z)`.
- Telemetria (simulação, WebSocket, MQTT e payload do ESP32): `TELEMETRY.md`.
- Imersão: **VR** (Meta Quest) e **RA** (Quest 3 com passthrough e Android com Chrome + ARCore; o
  iPhone não tem WebXR). Testes no aparelho real: `QUEST_TESTES.md`.
- `standalone/mecmonitor-arquivo-unico.html`: versão autônoma de arquivo único (modelo antigo embutido), enviada pelo site do GitHub em 2026-10-14. Não é publicada; o site é gerado a partir do `index.html` do projeto.
- Arquitetura: `ARCHITECTURE.md` · Auditoria XR: `AUDITORIA_XR.md`.
- Documentação do processo: `PROJECT_BASELINE.md`, `CHANGELOG.md`, `ISSUES.md`, `BACKLOG.md`.
