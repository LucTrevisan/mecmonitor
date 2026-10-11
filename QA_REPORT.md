# Relatório de QA: MecMonitor

**Laboratório virtual de manutenção preditiva da bomba centrífuga P-01**
**Escola SENAI Antonio Adolpho Lobbe, Curso de Manutenção Mecânica**

| | |
|---|---|
| Versão | 5.13.0 (tag `xr-f13-quest`) |
| Data | 2026-10-11 |
| Site | https://luctrevisan.github.io/mecmonitor/ |
| Repositório | https://github.com/LucTrevisan/mecmonitor |

## 1. Resumo

| Bateria | Resultado |
|---|---|
| Unitários (`npm run test:unit`) | **51/51** |
| Smoke, Chrome 154: desktop 1366×768, tablet 820×1180 (toque), celular 390×844 (toque) | **97/97** em cada |
| Smoke, Edge 154: desktop | **97/97** |
| WebXR com **Meta Quest 3 emulado** (IWER 2.5, `npm run test:xr`) | **56/56** |
| Desempenho estrutural (`npm run test:perf`) | dentro do orçamento |
| Site publicado (`npm run test:live`, GitHub Pages) | **7/7** |
| **Meta Quest real** | **pendente**: roteiro em `QUEST_TESTES.md`, a executar pela escola |

Nada do que é verificado automaticamente está falhando. **Só o headset real** confirma FPS, a sensação
de escala e conforto, o hand tracking com luz e mãos reais e a legibilidade (seção 7).

## 2. Ambientes

| Ambiente | Como | Situação |
|---|---|---|
| Chrome 154 (Windows), desktop | Puppeteer, render por software (SwiftShader) | ✅ automatizado |
| Chrome 154, tablet e celular (toque) | Mesmo teste com viewport móvel e toque | ✅ automatizado |
| Edge 154 (Windows), desktop | Mesmo teste com o Edge | ✅ automatizado |
| Meta Quest 3, controles e mãos | Emulador oficial da Meta (IWER) numa sessão WebXR real | ✅ automatizado (limites na seção 7) |
| GitHub Pages (produção) | Site publicado, sem cache | ✅ automatizado |
| ESP32 real | Caminho de tempo real testado com um servidor WebSocket local no papel do ESP32 | ⚠ falta o dispositivo físico |
| **Meta Quest 2/3 real** | `QUEST_TESTES.md` | ⏳ pendente |

## 3. Testes XR obrigatórios (item 33 da especificação)

| Item | Verificação automática (Quest 3 emulado) | No Quest real |
|---|---|---|
| Entrada em VR | "Sessão imersiva iniciada", "Renderizando frames XR", "Pose inicial fixa em frente à bancada" | 6.1–6.3 |
| Saída do VR | "Sair da imersão encerra a sessão", "Vista desktop restaurada exatamente", "Reentrada sem recarregar" | 6.12, 6.13 |
| Controle esquerdo | "Controles esquerdo e direito detectados", "Seleção de T-01 (controle esquerdo)" | 8.3 |
| Controle direito | "Controle: gatilho seleciona VIB-01", "Seleção de I-01 (direito)" | 8.1, 8.2 |
| Hand tracking esquerdo / direito | "Juntas das duas mãos", "Mão esquerda à esquerda, direita à direita" | 7.1–7.3 |
| Pinça | "Pinça seleciona VIB-01", "Segurar a pinça não gera cliques repetidos", "Soltar a pinça reabre a mão" | 8.5, 8.8 |
| Apontar | "Raio da mão sobre o botão (hover, sem ativar)", "Mão aberta não clica" | 8.4, 8.6 |
| Interação direta | "Interação direta: indicador perto de VIB-01 destaca o sensor" | 8.7 |
| Controle → mão | "Troca controle → mãos sem recarregar e sem ponteiros duplicados" | 7.1 |
| Mão → controle | "Retorno mãos → controles (marcadores somem)" | 7.3 |
| Seleção T-01 / VIB-01 / I-01 | Os três selecionados no headset (controle e pinça) e o painel do sensor com a tag certa | 8.x, 9.5 |
| Raio-X | "RAIO-X no headset (menu VR)" | 10.3, 10.4 |
| Térmico | "Pinça em TÉRMICO no menu VR: região do T-01 colorida e legenda 3D" | 10.5 |
| Treinamento | "Painel de treinamento no headset", "Pinça inicia o cenário A e marca a inspeção" (fluxo completo no smoke) | 11.1–11.8 |
| Teleporte | "Teleporte só no piso seguro", "impossível dentro da bancada e da faixa zebrada" | 6.10, 6.11 |
| Telemetria | "Painel VR P-01: TEMP / VIB / CORRENTE e STATUS iguais ao dashboard" | 9.1, 9.2 |
| Tracking perdido temporariamente / retorno | "Uma mão só: a outra some sem afetar a rastreada", "Retorno do tracking da mão esquerda"; unitário "perda de tracking solta a pinça" | 7.2, 13.2 |
| Uma única mão / duas mãos | Idem; "um único ponteiro por mão" | 7.2, 13.3 |
| Controle em apenas uma mão | **Não emulável**: o IWER troca as duas mãos juntas | **13.1** |

## 4. Fluxo final esperado (item 36)

| Etapa | Coberto por |
|---|---|
| Entrar → visualizar a bancada | Pose inicial em frente à bancada (XR); modelo carregado (smoke, site publicado) |
| Identificar P-01 e M-01 | "Placas P-01 e M-01 nas peças certas" (smoke); painel VR "P-01 · BOMBA CENTRÍFUGA" |
| Localizar sensores → aproximar-se | Sensores físicos e volumes (smoke); andar e agachar (XR); modo SENSORES |
| Apontar com a mão → destacar → pinçar → selecionar | Raio da mão, interação direta, pinça (XR) |
| Consultar telemetria → histórico | Painel do sensor no headset; histórico com gráficos, filtros e tabela (smoke) |
| Raio-X → Térmico | Modos no desktop e no headset (smoke + XR) |
| Identificar anomalia → diagnóstico → treinamento | Fluxo completo do cenário B com cliques reais (smoke); pinça no painel de treinamento (XR) |
| Alternar controles ↔ mãos automaticamente | Troca nos dois sentidos sem recarregar (XR) |

## 5. Checklist de regressão (roteiro original)

| Item | Situação | Evidência |
|---|---|---|
| Modelo 3D | ✅ | Carregado, geometria inalterada, base em y=0 (smoke); GLB e Draco no site publicado |
| Câmera / zoom / controles | ✅ | Órbita, zoom e recentrar (smoke); vista desktop restaurada após o VR (XR) |
| Simulação | ✅ | Atualiza e é sempre rotulada SIMULAÇÃO; nunca aparece como dado real |
| KPIs / Health Index | ✅ | 4 KPIs com valor, unidade, estado (ícone + texto + cor) e tendência; saúde 0–100 % |
| Hotspots / sensores | ✅ | 4 sensores ancorados (≤ 2 cm), volumes de interação, painel técnico |
| Gráficos (histórico) | ✅ | Gráficos com limites, crosshair, filtros 5 min–24 h e tabela |
| Eventos recentes | ❌ **não implementado** | Etapa 5 do roteiro original; o plano XR a cobriu com histórico (Fase 5) e diagnóstico por regras no treinamento (Fase 11), mas sem a lista de eventos. Registrado em `BACKLOG.md` (IDEA-008) |
| Raio-X / Térmico | ✅ | Transparência seletiva; térmico ligado ao T-01; NORMAL restaura exatamente, pixel a pixel |
| Tela cheia | ⚠ parcial | Botão presente e rotulado; a tela cheia real não é testável em navegador headless |
| WebXR | ✅ emulado / ⏳ real | Seção 3 |
| Responsividade | ✅ | Desktop, tablet e celular sem sobreposição, sem rolagem horizontal, dock inteiro na tela |
| Console | ✅ | Sem erros em todas as baterias e no site publicado |
| Assets / GLB | ✅ | Site publicado: nenhuma requisição falhou; modelo 241 peças, ambiente, logo |

## 6. Desempenho

Medido com `npm run test:perf` (estrutura) e no Quest 3 emulado:

| Modo | Draw calls / vista | Triângulos / vista | Malhas pickáveis | Texturas |
|---|---|---|---|---|
| NORMAL | 175 | 937 mil | 5 | 58 MB |
| SENSORES | 179 | 937 mil | 9 | 60 MB |
| RAIO-X | 185 | 937 mil | 5 | 62 MB |
| TÉRMICO | 185 | 937 mil | 5 | 63 MB |
| **Headset (2 olhos, emulado)** | **406** | **1,89 milhão** | n/a | n/a |

- Sem sombras e sem pós-processamento. No headset, a camada de rótulos 2D e o destaque ficam
  desligados.
- O modelo é estático (matrizes e materiais congelados): a CPU gasta 7 a 12 vezes menos com as
  matrizes por quadro.
- A foveação fixa é aplicada no Quest (nível 0,5; ajustável com `?foveation=`).
- **FPS real: medir no Quest** com `?perf=1` (passos 12.1–12.6).
- **ISSUE-004:** 99,7 % dos triângulos vêm do GLB. Simplificar volantes, válvulas, prisioneiros e
  registros exige **autorização** (altera malhas). Recomendação: só fazer se o FPS medido ficar
  abaixo de 72.
- **ISSUE-006:** o bundle JS tem 6,5 MB (≈ 1,4 MB comprimido). No site publicado, o carregamento sem
  cache levou 6,7 s neste ambiente; medir no Quest.

## 7. O que só o Quest real confirma (limitações dos testes automáticos)

- **FPS e conforto:** o emulador renderiza por software (~1 quadro/s); só a estrutura é comparável.
- **Hand tracking real:** iluminação, oclusões e tremor natural. No emulador as poses são perfeitas
  e a mão salta de aberta para pinça em um quadro (ISSUE-018). Os testes miram com a mão já em pinça.
- **Offset reference spaces:** o IWER 2.5 tem um bug, corrigido só no harness de teste (ISSUE-016).
- **Controle numa mão e mão na outra:** não emulável.
- **Foveação:** o emulador não a suporta. No Quest, verificar se o texto dos painéis laterais
  continua legível (12.6).
- **Legibilidade e escala:** painéis a ~75 cm, bancada de ~1,85 m, textos dos cartões.
- **ESP32 real:** o caminho de tempo real foi testado com um servidor local no papel do ESP32. Falta o
  hardware na rede da escola.

## 8. Pendências

| # | Pendência | Responsável | Referência |
|---|---|---|---|
| 1 | Executar o roteiro no Quest real e anotar os resultados (seção 9) | Escola | `QUEST_TESTES.md` |
| 2 | Decidir sobre a simplificação de malhas, com base no FPS medido | Usuário | ISSUE-004 |
| 3 | Confirmar as legendas do botão amarelo e da seletora do painel elétrico | Escola | ISSUE-019 |
| 4 | Logo oficial da IMBIL (hoje só o nome em texto) | Escola | `src/config/bench.js` |
| 5 | Lista de eventos recentes (roteiro original) | Futuro | BACKLOG IDEA-008 |
| 6 | Reduzir o bundle JS (imports por caminho) | Futuro | ISSUE-006 |
| 7 | Conectar o ESP32 real (`?source=ws&url=…`) | Escola | `TELEMETRY.md` |

## 9. Teste no Quest real (para preencher)

| Campo | Valor |
|---|---|
| Data | |
| Dispositivo (Quest 2 / 3 / Pro) | |
| Versão do Meta Quest Browser | |
| Responsável | |
| FPS em NORMAL / RAIO-X / TÉRMICO (`?perf=1`) | |
| Passos com ❌ (número + uma frase) | |
| Observações | |
