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
| WebSocket | `?source=ws&url=ws://192.168.0.50:81` |
| MQTT | `?source=mqtt&url=wss://broker:8884/mqtt&topic=mecmonitor/p01/telemetry` |

Os valores padrão ficam em `src/config/telemetry.js`. **Usuário e senha do broker nunca são lidos
da URL** e, se forem colocados nesse arquivo, vão parar no JavaScript público. Use um usuário
de broker com permissão **somente de leitura** no tópico.

Observação: uma página servida em HTTPS (necessário para WebXR) só consegue abrir `wss://`.
Para `ws://` de um ESP32 na rede local, sirva a página em HTTP ou use um bridge com TLS.

## Payload (JSON, uma amostra por mensagem)

```json
{ "temperature": 52.3, "vibration": 2.14, "current": 3.42, "rpm": 1748, "ts": 1791280000 }
```

- Campos opcionais: o que vier é atualizado e o que faltar mantém o último valor no card.
- Aliases aceitos: `temp`/`temperatura`/`t`, `vib`/`vibracao`/`vrms`/`v`, `corrente`/`i`/`irms`,
  `rotacao`/`n`. As chaves são case-insensitive.
- `ts`/`timestamp` é opcional (em s ou ms). Sem NTP no ESP32, omita: o horário de chegada é usado.
  Diferenças acima de 5 min também são substituídas pelo horário de chegada.
- Unidades esperadas: °C, mm/s RMS, A RMS, rpm.

### Exemplo ESP32 (Arduino, PubSubClient)

```cpp
char buf[128];
snprintf(buf, sizeof buf, "{\"temp\":%.1f,\"vrms\":%.2f,\"i\":%.2f,\"rpm\":%d}",
         tempC, vibRms, currentA, rpm);
mqtt.publish("mecmonitor/p01/telemetry", buf);
```

## Garantias

- Dado simulado nunca aparece como tempo real: o serviço carimba `source` a partir do **tipo do
  provider** e ignora o que vier no payload.
- Quando a conexão cai, **não há fallback automático para simulação**. O chip ESP32 fica
  "sem conexão", o status vai para "SEM DADOS" após 5 s e os valores ficam esmaecidos.
- WebSocket reconecta com backoff (1 s → 15 s). MQTT reconecta a cada 3 s.
- A biblioteca `mqtt` é carregada sob demanda (chunk separado) e só baixa se a fonte for MQTT.
