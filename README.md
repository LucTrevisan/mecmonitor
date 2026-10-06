# MecMonitor — Bomba Centrífuga P-01

Digital Twin web (Babylon.js + Vite) da bancada de bomba centrífuga.

```bash
npm install
npm run dev          # servidor local (use HTTPS/tunnel para testar WebXR no Quest)
npm run build        # gera dist/
npm run test:unit    # regras de saúde e telemetria (Node)
npm run test:smoke   # testa o build em Chrome/Edge headless (rode após o build)
```

- Modelo usado pela aplicação: `public/models/bomba-draco.glb`. O original de 40 MB fica em `bomba.glb`.
- Ajuste de orientação pelo console do navegador: `mecmonitor.ajustarRotacaoGraus(x, y, z)`.
- Telemetria (simulação, WebSocket, MQTT e payload do ESP32): `TELEMETRY.md`.
- Documentação do processo: `PROJECT_BASELINE.md`, `CHANGELOG.md`, `ISSUES.md`, `BACKLOG.md`.
