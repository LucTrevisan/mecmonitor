# Telemetria — MecMonitor

```text
            TelemetryService  (fonte única; carimba source = simulation | realtime)
                   │
     ┌─────────────┼──────────────┐
     ↓             ↓              ↓
simulationProvider  mqttProvider   websocketProvider
 (padrão)          (MQTT/WSS)     (WebSocket)
```

## Escolher a fonte

| Fonte | Como ativar |
|---|---|
| Simulação (padrão) | nada a fazer |
| **ESP32 (MQTT)** | botão **ESP32** no dock (grupo Dados); a escolha fica salva no aparelho |
| WebSocket | `?source=ws&url=ws://192.168.0.50:81` |
| MQTT (outro broker) | `?source=mqtt&url=wss://broker:8884/mqtt&topic=mecmonitor/p01/telemetry` |

A URL vence a escolha salva; o botão vence a URL a partir do momento em que é tocado.

## ESP32 → site (padrão)

```text
ESP32-C3 ──wss:// porta 443──► public.cloud.shiftr.io ◄──wss:// porta 443── site (HTTPS)
          MQTT PUBLISH                 broker público          MQTT SUBSCRIBE
          mecmonitor/luctrevisan/p01/telemetry
```

- Os dois lados usam **WebSocket seguro na porta 443**: passa por redes de escola/empresa que só liberam
  HTTPS (as portas 1883, 8883 e 8884 costumam estar bloqueadas — foi o caso na rede usada nos testes).
- O site em HTTPS não pode abrir `ws://` direto no ESP32 (o navegador bloqueia conteúdo misto); por isso o
  broker no meio. A página de teste local do ESP32 (`http://<IP>/`) continua usando `ws://` direto.
- Broker público de teste do shiftr.io: usuário e senha `public` são os publicados por ele, não são segredo.
  Qualquer um que souber o tópico pode ler ou publicar nele — aceitável para leituras de sensores em aula.
- O selo **ESP32** do topo mostra **◌ AGUARDANDO** enquanto o site está ligado ao broker mas nenhuma leitura
  chegou (placa desligada ou sem internet) e **● ONLINE** quando as leituras chegam.
- Sketch do ESP32: `mecmonitor_esp32c3` (`.ino` + `rede.h` + `pagina.h`), sem bibliotecas extras; preencha
  `WIFI_SSID`/`WIFI_SENHA` em `rede.h` com uma rede que tenha internet.

Os valores padrão ficam em `src/config/telemetry.js`. **Usuário e senha do broker nunca são lidos
da URL** e, se forem colocados nesse arquivo, vão parar no JavaScript público. Use um usuário
de broker com permissão **somente de leitura** no tópico.

Observação: uma página servida em HTTPS (necessário para WebXR) só consegue abrir `wss://`.
Para `ws://` de um ESP32 na rede local, sirva a página em HTTP ou use um bridge com TLS.

## Payload (JSON, uma amostra por mensagem)

```json
{ "temperature": 52.3, "vibration": 2.14, "current": 3.42, "oil": 71, "ts": 1791280000 }
```

O sketch do ESP32 envia a forma curta: `{"temp":54.2,"i":3.48,"vrms":1.96,"nivel":71}`.

- Campos opcionais: o que vier é atualizado e o que faltar mantém o último valor no card.
- Aliases aceitos: `temp`/`temperatura`/`t`, `vib`/`vibracao`/`vrms`/`v`, `corrente`/`i`/`irms`,
  `nivel`/`nivel_pct`/`level`/`oleo` (nível do óleo, %). As chaves são case-insensitive. Outros campos
  (por exemplo `rpm`) são ignorados, e `null` ou vazio também (o campo mantém a última leitura).
- `ts`/`timestamp` é opcional (em s ou ms). Sem NTP no ESP32, omita: o horário de chegada é usado.
  Diferenças acima de 5 min também são substituídas pelo horário de chegada.
- Unidades esperadas: °C, mm/s RMS, A RMS, % (nível do óleo: alerta abaixo de 40 %, crítico abaixo de 20 %).

### Exemplo ESP32 (Arduino, PubSubClient)

```cpp
char buf[128];
snprintf(buf, sizeof buf, "{\"temp\":%.1f,\"vrms\":%.2f,\"i\":%.2f}",
         tempC, vibRms, currentA);
mqtt.publish("mecmonitor/p01/telemetry", buf);
```

## Garantias

- Dado simulado nunca aparece como tempo real: o serviço carimba `source` a partir do **tipo do
  provider** e ignora o que vier no payload.
- Quando a conexão cai, **não há fallback automático para simulação**. O chip ESP32 mostra
  "○ OFFLINE" e, após 5 s sem leitura, cada KPI vai para **SEM DADOS**.
- O SEM DADOS é **por KPI**: se o ESP32 parar de enviar só um campo (por exemplo, a vibração),
  apenas esse KPI vai para SEM DADOS. A saúde usa somente KPIs com leitura recente.
- WebSocket reconecta com backoff (1 s → 15 s). MQTT reconecta a cada 3 s.
- A biblioteca `mqtt` é carregada sob demanda (chunk separado) e só baixa se a fonte for MQTT.
