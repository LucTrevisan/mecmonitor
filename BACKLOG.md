# BACKLOG — MecMonitor

## IDEA-001
Vista explodida da bomba, aproveitando a hierarquia de peças do GLB.
Benefício: uso didático (SENAI) e apoio à manutenção.
Prioridade: Futura.

## IDEA-002
Análise FFT da vibração (MPU6050).
Benefício: identificação de frequências características (1×, 2× RPM, defeitos de rolamento).
Prioridade: Futura.

## IDEA-003
Animar a rotação do eixo, acoplamento e rotor conforme o RPM.
Benefício: reforça a leitura do estado operacional no Digital Twin.
Prioridade: Etapa 4 ou 6 (exige definir o eixo de rotação das peças).

## IDEA-004
Mais pontos de temperatura para o modo TÉRMICO (mancal do lado do motor, carcaça do motor M-01).
Benefício: o mapa deixaria de ser uma estimativa a partir de um único termopar e mostraria gradientes reais.
Prioridade: Futura (exige sensores adicionais na bancada).

## IDEA-005
No RAIO-X, mostrar o sentido do fluxo (sucção → voluta → recalque) com setas animadas.
Benefício: didático para o funcionamento da bomba centrífuga.
Prioridade: Futura.

## IDEA-006
Relatório do treinamento (aluno, cenário, respostas, tempo) exportável em PDF/CSV para o instrutor.
Benefício: avaliação e registro das práticas no curso.
Prioridade: Futura (exige identificação do aluno e política de dados).

## IDEA-007
Mais cenários de treinamento: cavitação (sucção restrita), desalinhamento após troca do motor, falha do
próprio sensor (leitura travada / SEM DADOS) e combinações de anomalias.
Benefício: amplia o repertório de diagnóstico do curso.
Prioridade: Futura.

## IDEA-008
Lista de **eventos recentes** no dashboard (roteiro original, Etapa 5): por exemplo "18:04 Vibração
elevada" e "18:02 Temperatura 61,4 °C", registrando entradas e saídas de ALERTA/CRÍTICO por KPI, com a
origem dos dados.
Benefício: rastreabilidade do que aconteceu sem abrir os gráficos; base para o relatório do treinamento.
Prioridade: Próxima (único item do roteiro original ainda não implementado; ver QA_REPORT §5).

## IDEA-009
RA (Fase 14): **âncoras** WebXR (a bancada presa a um ponto do ambiente mesmo se o rastreamento
reajustar), **detecção de planos** para mostrar o piso livre e **estimativa de luz** para o metal da
bancada combinar com a iluminação da sala. Também uma escala reduzida (maquete sobre a mesa) como opção.
Benefício: RA mais estável em salas grandes e uso em sala de aula sem espaço livre de ~2 × 1 m.
Prioridade: Futura (validar primeiro a RA atual no Quest 3 e no Android: QUEST_TESTES Fase 14).
