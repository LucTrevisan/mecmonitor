# MecMonitor — Baseline do Projeto (v0-baseline)

Data: 2026-10-05
Pasta: `Desktop/bomba-final`

## 1. Situação encontrada

**Ainda não existe nenhuma aplicação MecMonitor.** A pasta só tem o modelo 3D da bomba
(exportado do SolidWorks) e três versões otimizadas dele. Também procurei no Desktop e em
Documents: nenhum projeto menciona "MecMonitor", "bomba" ou "P-01". O usuário confirmou
que a aplicação ainda não existe.

Portanto não há HTML, CSS, JavaScript, Babylon.js, WebXR, sensores, simulação, câmera,
iluminação, controles ou responsividade para auditar. Esta auditoria cobre o que existe de
fato, que é o **asset 3D**, e registra os riscos que a construção da aplicação precisa evitar.

| Arquivo | Tamanho | Observação |
|---|---|---|
| `bomba.glb` | 40,4 MB | Original do SolidWorks, **não deve ser alterado** |
| `bomba-quantizado.glb` | 8,3 MB | dedup + weld + quantização (KHR_mesh_quantization); não precisa de decoder |
| `bomba-meshopt.glb` | 3,3 MB | igual ao anterior + EXT_meshopt_compression |
| `bomba-draco.glb` | 1,75 MB | dedup + weld + KHR_draco_mesh_compression (pos 16 bits, normal 12 bits); **recomendado para web** |

As versões otimizadas mantêm a mesma bounding box, os mesmos 185 nós (com a hierarquia de
peças intacta) e a mesma contagem de vértices renderizados que o original.

## 2. Auditoria do modelo `bomba.glb`

### Visão geral
- Gerador: `SOLIDWORKSGLTF`, glTF 2.0, sem extensões.
- **Sem texturas e sem imagens**, sem animações, sem skins. Todo o visual vem da geometria
  e de materiais PBR por fator.
- 185 nós, 178 meshes, 78 materiais (39 depois do dedup), 2 materiais `BLEND` (transparentes).
- Cerca de 932 mil triângulos renderizados e 1,2M vértices enviados à GPU (345 mil na versão otimizada).
- Bounding box em metros: min (-0.306, 0.306, 1.207) e max (1.451, 2.159, 2.210).
  O modelo mede ~1,76 × 1,85 × 1,00 m e **não está centrado na origem**.
- O nó raiz 0, `current camera`, é uma câmera **ortográfica** exportada pelo SolidWorks.
  Não deve ser usada como câmera ativa.

### Hierarquia (nó raiz `projeto_bomba_centrifuga1609final`, 147 filhos)
Peças relevantes para o Digital Twin, com o nome exato do nó:

| Função | Nó(s) | Sensor candidato (Etapa 4) |
|---|---|---|
| Motor | `Motor teste-2` | SCT013 (corrente) e MAX6675 (temperatura de carcaça) |
| Mancal / rolamentos | `House Bearing-1`, `radial ball bearing_68_din-1/-2`, `Bearing Cover-1/-2`, `bbcover-1/-2` | MPU6050 (vibração) e MAX6675 |
| Eixo / acoplamento | `Shaft-1`, `coupling-1`, grupo `coupling As` | Sensor RPM |
| Rotor / voluta | `IMPELLER-2`, `casing oficial-1`, `WEAR RING-1/-3` | — |
| Vedação | `Seal chamber-1`, `Pump Packing Set-*`, `PUMP LANTERN RING-1`, `Pump Packing Glang-1` | — |
| Base / estrutura | `Base-1`, `SUPPORT-1`, `PUMP PROTECTION-1` | — |
| Tubulação | `PIPE MASTER *`, `Curva 90° *`, `SLIP-ON FLANGE *` | — |
| Válvulas | 2× `Registro 22` (subgrupos), `Registro de Gaveta`, 4× `VÁLVULA DE ESFERA MONOBLOCO` | — |
| Instrumentos | `INGAPOOL manometro-1/-2`, `VISOR DE NIVEL` | — |
| Bancada / outros | `reservatorio.stp-1`, `reservatorio_2.stp-1`, `hopperfunnel 2-1`, `CEMAR-1`, `senai_placa.stp-1`, `toreira menor-1` | — |

Fixadores (`hex nut`, `stud2d`, `hex screw`, `plain washer`, `spring lock washer`, `parallel_din`)
somam várias dezenas de nós pequenos.

### Malhas mais pesadas (distribuição de vértices)
| Nó | Triângulos | % dos vértices |
|---|---|---|
| `Manopla-1` (×2, uma em cada `Registro 22`) | 77 mil cada | ~9% cada (**~19% somadas**) |
| `Peça 10-3` | 34 mil | 3,9% |
| `CorpoRegistro2-2` (×2) | 26 mil cada | 3,4% cada |
| `VÁLVULA DE ESFERA…` (×4) | 26,5 mil cada | 3,1% cada |
| `CorpoRegistro1-1` (×2) | 24 mil cada | 3,1% cada |

Volantes de válvula, que são detalhe secundário, concentram a maior parte da geometria. São
candidatos a simplificação ou LOD na Etapa 8, sem tocar nas peças principais da bomba.

### Materiais
- A maioria é `defaultplastic` (metallic 0, roughness ~0,17) em várias cores.
- Há metálicos com metallic = 1: `satinfinishstainlesssteel`, `polishedsteel`, `polishedbrass`,
  `castbronze` e `castiron` (este último com cor base vermelha [1,0,0]).
- `PlasticPolystyrene`: branco, roughness 1.
- 2 materiais transparentes (`BLEND`), provavelmente o visor de nível e a tampa de proteção.

## 3. FUNCIONA

- `bomba.glb` é um glTF 2.0 válido: o `gltf-transform inspect` lê sem erros.
- A hierarquia de montagem está preservada e os nomes são descritivos, o que serve para
  hotspots, raio-X, vista explodida e seleção de peças.
- As versões otimizadas (Draco, Meshopt e quantizada) foram geradas sem alterar a geometria visível.
- Ferramentas disponíveis na máquina: Node.js, npx, `gltf-transform` (global) e Git 2.53.

## 4. PROBLEMAS

| ID | Problema | Impacto |
|---|---|---|
| P1 | Não há aplicação: as Etapas 1 a 9 do roteiro pressupõem UI, câmera, controles e simulação já existentes | O roteiro precisa de uma etapa de criação da base antes da Etapa 1 |
| P2 | O modelo não está centrado: o centro fica em ~(0.57, 1.23, 1.71) m | Sem recentralizar, a câmera orbita um ponto vazio |
| P3 | Há um nó de câmera ortográfica do SolidWorks no GLB | O Babylon pode criá-la; ela deve ser ignorada ou descartada |
| P4 | Materiais com metallic = 1 e nenhuma textura de ambiente | Sem `environmentTexture` as peças metálicas ficam pretas no Babylon |
| P5 | 40 MB no original | Inviável em celular ou rede móvel; usar `bomba-draco.glb` |
| P6 | Malhas de volantes com ~154 mil triângulos no total | Custo de GPU desproporcional (relevante para o Quest) |
| P7 | Orientação (eixo "up") não foi verificada visualmente | O SolidWorks normalmente exporta em Y-up, mas é preciso confirmar no viewer |

## 5. RISCOS

- **Flatten, join ou merge de meshes** (`gltf-transform optimize` padrão, `mergeMeshes` do Babylon)
  destrói a hierarquia de peças. Isso quebra hotspots, raio-X, vista explodida e seleção. Só aplicar
  na Etapa 8, com cuidado e por grupo.
- **Rotacionar o nó raiz importado diretamente** gera bugs de pivô e de bounding box. Usar o padrão
  container-pivot.
- **Aumentar metallic** para dar brilho deixa o modelo lavado ou branco. Ajustar roughness e
  iluminação em vez disso.
- **Modo térmico ou raio-X alterando os materiais originais** sem guardar cópia não permite
  voltar ao modo Normal. É preciso clonar ou guardar o estado dos materiais.
- **HUD em HTML não aparece dentro do headset.** A Etapa 7 precisa de GUI 3D (`@babylonjs/gui`).
- **Pós-processamento (SSAO, bloom) dentro do XR** derruba o FPS no Quest. Desligar ao entrar em VR.
- **Caminhos absolutos** (`/models/...`) quebram no GitHub Pages. Usar `base: "./"` no Vite.
- **Commitar `node_modules`** quebra o CI. Precisa de `.gitignore` desde o início.
- **Dado simulado exibido como real**: a Etapa 3 exige o rótulo "● SIMULAÇÃO".

## 6. ARQUITETURA ATUAL

```text
UI              → (não existe)
↓
Babylon.js      → (não existe)
↓
Digital Twin    → apenas o asset bomba.glb / bomba-draco.glb
↓
Telemetria      → (não existe)
↓
Sensores        → (não existem; MPU6050 / MAX6675 / SCT013 / RPM previstos)
```

## 7. ARQUITETURA PROPOSTA (referência para as próximas etapas)

```text
UI (HTML/CSS: header, controles, KPIs)  ── GUI 3D para VR (Etapa 7)
↓
SceneManager (Babylon.js: engine, câmera, luz, environment, modos visuais)
↓
DigitalTwin (carrega GLB, mapa nó → peça/sensor, hotspots, foco de câmera)
↓
TelemetryService (fonte única de dados, rótulo SIM/REAL)
↓
Providers: simulationProvider | mqttProvider | websocketProvider
↓
ESP32 (MPU6050, MAX6675, SCT013, RPM)
```

Stack sugerida: Vite + `@babylonjs/core`, `@babylonjs/loaders` e `@babylonjs/gui`, com versões fixas
e iguais entre si, `base: "./"`, e o modelo em `public/models/bomba-draco.glb`.

## 8. Ajuste necessário no roteiro

Como não há base existente, proponho inserir uma etapa antes da Etapa 1:

**ETAPA 0.5 — APLICAÇÃO BASE (checkpoint `v0.5-app-base`)**
- Scaffold Vite + Babylon.js;
- carregar `bomba-draco.glb` com barra de progresso;
- container-pivot, recentralização e base apoiada em y = 0;
- ArcRotateCamera com órbita, zoom e pan, e enquadramento automático;
- iluminação básica + environment, para resolver o problema dos metálicos pretos;
- tela cheia e botão VR mínimo, usando o suporte padrão do Babylon;
- simulação mínima de valores (temperatura, vibração, corrente e RPM) exibida em texto, para que
  as Etapas 1 a 3 tenham o que preservar.

A partir daí as Etapas 1 a 9 seguem como foram especificadas.
