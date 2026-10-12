# Auditoria UX e responsividade (mobile): MecMonitor

**Fase 1 do refactoring da camada de apresentação.** Medido no Chrome headless emulando cada tamanho de
tela e o toque (`isMobile`, `hasTouch`). **Não foram testes em aparelhos reais** (Android/iPhone).

Regras do trabalho: só apresentação (CSS, organização visual, acessibilidade). Lógica de negócio, ESP32,
telemetria, simulação, cena Babylon.js, câmeras, controles 3D, WebXR e o GLB ficam intocados. Mudanças
em JavaScript só na camada de interface, justificadas antes.

## Medições antes do refactoring (11 tamanhos × 4 estados)

| Tela | Cena 3D visível | Cabeçalho / dock | Botões < 44 px | Menor fonte |
|---|---|---|---|---|
| 320×568 | 21 % | 120 / 148 px | 9 de 14 | 9 px |
| 360–430 retrato | 40–46 % | 120 / 148–215 px | 9 de 14 | 9 px |
| 568×320 paisagem | **9 %** | 88 / 215 px | 9 de 14 | 9 px |
| 844×390 / 932×430 paisagem | 30–33 % | 92 / 152 px | 9 de 14 | 9,5 px |
| 768×1024 | 64 % (35 % com sensor aberto) | 92 / 152 px | 9 de 14 | 9,5 px |
| 1024×768 · 1280×800 · 1920×1080 | 69 · 75 · 86 % | 55 / 84 px | 9 de 14 | 9,5 px |

Positivo: nenhuma rolagem horizontal; estados sempre com ícone + texto + cor; gaveta do sensor no
celular; histórico com × e Esc; tela de carregamento; layout desktop.

## Problemas, heurísticas e situação

| # | Problema | Gravidade | Heurística | Situação |
|---|---|---|---|---|
| P1 | Celular em paisagem: cabeçalho + dock ~95 % da altura; dashboard escondido; KPIs e painel do sensor cortados | Crítica | H8, H3, H1 | ✅ Fase 2 (layout de tela baixa) |
| P2 | Painel de treinamento com 26 px (844×390) / 50 px (320×568), botões inacessíveis | Crítica | H3, H5 | ✅ Fase 2 |
| P3 | Pouco espaço para a cena 3D no retrato (21 % em 320×568) | Alta | H8 | ⏳ Fase 3 |
| P4 | Textos cortados em 320–380 px (equipamento, ESP32, última atualização, KPIs, "SEM DA") | Alta | H1, H9, H2 | ✅ KPIs e SEM DADOS (Fase 2) · ⏳ cabeçalho (Fase 3) |
| P5 | Botões só com ícone sem nome acessível em ≤ 380 px | Alta | H6 | ✅ nome acessível (Fase 2) · ⏳ rótulo visível (Fase 4) |
| P6 | Alvos de toque < 44 px | Alta | H5 | ⏳ Fase 4 |
| P7 | Contraste 2,1:1 do texto secundário sobre painéis translúcidos com fundo claro | Alta | H1, H8 | ✅ Fase 2 |
| P8 | Fontes de 9–11,5 px | Média | H8 | ✅ Fase 2 (mínimo 11 px) |
| P9 | Dicas só em hover (botão VR, ESP32, origem) | Média | H10, H1 | ⏳ Fase 6 |
| P10 | Foco do teclado invisível na cena 3D | Média | H4 | ⏳ Fase 6 |
| P11 | Horários sobrepostos no eixo dos gráficos (celular) | Média | H8 | ⏳ Fase 5 |
| P12 | Sem áreas seguras (entalhe, barra inferior) | Média | H5 | ✅ Fase 2 |
| P13 | Histórico no celular com gráficos altos | Baixa | H8, H7 | ⏳ Fase 5 |
| P14 | Tablet retrato: painel do sensor cobre metade da bancada | Baixa | H8 | ⏳ Fase 3 |
| P15 | Abreviações e nomes cortados nos KPIs | Baixa | H2 | ✅ Fase 2 |
| P16 | Dock com até 215 px no celular | Média | H8, H7 | ⏳ Fase 3 |
| P17 | Falha de carregamento diz "Veja o console" | Baixa | H9 | ⏳ Fase 6 |
| P18 | Rótulos 3D dos sensores se sobrepõem em telas pequenas | Média | H8 | ⏳ Fase 4 (autorizado; JS só da camada de rótulos) |

## Plano

| Fase | Conteúdo |
|---|---|
| 1 | Esta auditoria |
| 2 | Estrutura CSS: contraste, áreas seguras, tipografia mínima, KPIs sem corte, tela baixa (paisagem), gaveta de treinamento; teste `npm run test:ux` |
| 3 | Layout mobile: cabeçalho e dock compactos, espaço da cena (P3, P4, P14, P16) |
| 4 | Toque: alvos de 44 px, rótulos visíveis, rótulos 3D compactos (P5, P6, P18) |
| 5 | Painéis e modais: histórico e gráficos (P11, P13) |
| 6 | Acessibilidade e heurísticas: dicas por toque e foco, foco visível, mensagens (P9, P10, P17) |
| 7 | Testes e refinamento: todos os tamanhos e orientações, regressão completa |
