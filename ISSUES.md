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

## ISSUE-007
Problema: na vista padrão (frente da bancada), o quadro elétrico encobre parcialmente o motor e o mancal.
Severidade: Baixa
Encontrado: Etapa 0.5
Resolver: Etapa 4 (foco de câmera por sensor) e Etapa 6 (raio-X)

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
