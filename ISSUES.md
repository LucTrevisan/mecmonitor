# ISSUES — MecMonitor

## ISSUE-001
Problema: modelo descentralizado (centro em ~(0.57, 1.23, 1.71) m).
Severidade: Alta
Encontrado: Etapa 0
Resolver: Etapa 0.5 (aplicação base)

## ISSUE-002
Problema: o GLB contém a câmera ortográfica "current camera" do SolidWorks.
Severidade: Baixa
Encontrado: Etapa 0
Resolver: Etapa 0.5 (ignorar ou descartar ao carregar)

## ISSUE-003
Problema: materiais com metallic = 1 sem textura de ambiente ficam pretos no Babylon.
Severidade: Alta
Encontrado: Etapa 0
Resolver: Etapa 0.5 (environmentTexture)

## ISSUE-004
Problema: as malhas `Manopla-1` (×2) têm ~154 mil triângulos (~19% dos vértices).
Severidade: Média
Encontrado: Etapa 0
Resolver: Etapa 8 (LOD/simplificação localizada)

## ISSUE-005
Problema: orientação (eixo up) do modelo ainda não foi verificada visualmente.
Severidade: Média
Encontrado: Etapa 0
Resolver: Etapa 0.5 (helper de rotação no console)
