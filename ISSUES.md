# ISSUES — MecMonitor

## ISSUE-001 — RESOLVIDA (v0.5)
Problema: modelo descentralizado (centro em ~(0.57, 1.23, 1.71) m).
Severidade: Alta
Encontrado: Etapa 0
Resolvido: Etapa 0.5. O container-pivot recentraliza e apoia a base em y = 0.

## ISSUE-002 — RESOLVIDA (v0.5)
Problema: o GLB contém a câmera ortográfica "current camera" do SolidWorks.
Severidade: Baixa
Encontrado: Etapa 0
Resolvido: Etapa 0.5. A câmera é descartada após o carregamento.

## ISSUE-003 — RESOLVIDA (v0.5)
Problema: materiais com metallic = 1 sem textura de ambiente ficam pretos no Babylon.
Severidade: Alta
Encontrado: Etapa 0
Resolvido: Etapa 0.5. Environment map local `public/env/environmentSpecular.env`.

## ISSUE-004
Problema: as malhas `Manopla-1` (×2) têm ~154 mil triângulos (~19% dos vértices).
Severidade: Média
Encontrado: Etapa 0
Resolver: Etapa 8 (LOD/simplificação localizada)

## ISSUE-005 — RESOLVIDA (v0.5)
Problema: orientação (eixo up) do modelo ainda não verificada visualmente.
Severidade: Média
Encontrado: Etapa 0
Resolvido: Etapa 0.5. Os screenshots confirmam o modelo de pé (Y-up) sem rotação extra;
o helper `mecmonitor.ajustarRotacaoGraus()` continua disponível.

## ISSUE-006
Problema: bundle JS de 5,9 MB (1,26 MB gzip), porque o código importa o índice completo de `@babylonjs/core`.
Severidade: Média
Encontrado: Etapa 0.5
Resolver: Etapa 8 (imports por caminho / tree-shaking)

## ISSUE-007 — PARCIAL (v4)
Problema: na vista padrão (frente da bancada), o quadro elétrico encobre parcialmente o motor e o mancal.
Severidade: Baixa
Encontrado: Etapa 0.5
Resolver: Etapa 4 (foco de câmera por sensor) e Etapa 6 (raio-X)
Status v4: os KPIs agora levam a câmera direto a cada sensor (vista traseira, sem obstrução). A vista
geral continua com o quadro na frente; o raio-X (Etapa 6) resolve o restante.

## ISSUE-008
Problema: no celular, o header e o dashboard cobrem parte do modelo, porque o enquadramento usa a tela inteira e não a área livre.
Severidade: Baixa
Encontrado: Etapa 2
Resolver: Etapa 8/9 (deslocar o alvo da câmera conforme os painéis, ou permitir recolher o dashboard)

## ISSUE-009
Problema: os limites dos KPIs são provisórios. Corrente e RPM foram estimados e não vêm da placa do motor.
Severidade: Média
Encontrado: Etapa 2
Resolver: com os dados reais da bancada (configurável em src/config/kpis.js)

## ISSUE-010
Problema: as posições dos sensores no modelo são propostas a partir dos nomes das peças; a instalação real pode ser outra.
Severidade: Média
Encontrado: Etapa 4
Resolver: com a posição real na bancada (src/config/sensors.js ou mecmonitor.twin.moveHotspot no console)

## ISSUE-011
Problema: os hotspots usam GUI em tela cheia, que não aparece dentro do headset.
Severidade: Média (esperado)
Encontrado: Etapa 4
Resolver: Etapa 7 (hotspots/painéis 3D para VR)

## ISSUE-012
Problema: no Chrome headless com renderização por software, os frames demoram e as transições CSS
aparecem atrasadas nos screenshots. Não afeta GPU real, mas os testes ficam lentos (~4 min por viewport).
Severidade: Baixa (ambiente de teste)
Encontrado: Etapa 4
Resolver: Etapa 8 (medir FPS em hardware real; avaliar o custo da HighlightLayer e do raycast)

## ISSUE-013 — RESOLVIDA (xr-f6)
Problema: no VR, a cabeça do usuário começa em (0; 1,6; 0), no centro da bancada (dentro da bomba). Medido com o Quest 3 emulado (IWER).
Severidade: Alta
Encontrado: Fase 2 (plano XR)
Resolvido: Fase 6. Pose inicial fixa 1,5 m em frente à bancada, olhando para ela (testado no Quest 3 emulado).

## ISSUE-014 — RESOLVIDA (xr-f2)
Problema: ao sair do VR, a câmera desktop ficava dentro da bancada (o Babylon copia a pose da cabeça; raio 2,43 → 0,67).
Severidade: Alta
Encontrado: Fase 2 (plano XR)
Resolvido: Fase 2. A vista desktop é salva ao entrar e restaurada ao sair (`main.js › wireVR`), com teste.

## ISSUE-015
Problema: vista de frente, a placa M-01 (e o próprio motor) fica parcialmente atrás do quadro elétrico e da
tubulação. É o layout do modelo; a placa traseira e a vista lateral ficam legíveis.
Severidade: Baixa
Encontrado: Fase 4 (plano XR)
Resolver: Fase 5/10 (hotspot do M-01 e Raio-X), sem mover peças do GLB

## ISSUE-016
Problema: o emulador IWER 2.5.0 ignora offset reference spaces (passa XRRigidTransform onde espera mat4). Corrigido só no harness de teste (scripts/xr-test.mjs).
Severidade: Baixa (ambiente de teste)
Encontrado: Fase 6 (plano XR)
Resolver: remover o patch quando o IWER corrigir; considerar reportar ao projeto IWER

## ISSUE-017
Problema: o Babylon 9.29 não tem opção pública para desligar o ponteiro dele só nas mãos. O MecMonitor usa `pointerSelection._detachController` (API interna), protegido por verificação. Se uma versão futura remover o método, o app continua funcionando, mas pode aparecer um segundo raio na mão.
Severidade: Baixa
Encontrado: Fase 8 (plano XR)
Resolver: revisar ao atualizar o Babylon (o teste XR "um único ponteiro por mão" detecta a regressão)

## ISSUE-018
Problema: no emulador IWER a mão salta da pose aberta para a pinça em um único quadro (~2 s por quadro com render por software). O ponto de pinça, e com ele o raio, desloca-se de uma vez, além da janela de intenção de 250 ms. No "×" do painel do sensor (≈4 cm a ~1,6 m) o raio saía do botão; em "Recentrar" podia cair em "Sair da imersão", ao lado. A sessão então terminava e o teste travava até o timeout do protocolo. Uma mão real fecha gradualmente, e a janela de intenção cobre isso. O teste XR agora mira já com a pose de pinça (como um usuário que corrige a mira) e `waitXRFrames` falha na hora se a sessão terminar.
Severidade: Baixa (ambiente de teste)
Encontrado: Fase 9 (plano XR)
Resolver: confirmar no Quest real (QUEST_TESTES 9.7, 9.8 e 9.11). Se o raio escorregar ao pinçar, a seleção deve usar o alvo sob o raio no início do fechamento dos dedos, e o "×" deve ganhar uma área de toque maior.
