/**
 * PFUMA CN-01 Collar Node — Wokwi ESP32 Simulation
 * PFUMA Livestock Monitoring System
 *
 * This is a SOFTWARE INTEGRATION TEST RIG, not the real hardware firmware.
 * It exists to let you test the full app<->hardware pipeline (pairing, real
 * telemetry storage, the "Live Physical Device" dashboard badge) TODAY,
 * without waiting for physical parts to arrive. It runs in the browser at
 * wokwi.com — no soldering, no purchase required.
 *
 * Reads the collar sensors, builds JSON telemetry, and PUBLISHES it over
 * MQTT (the simulation stand-in for the real 433MHz LoRa uplink — Wokwi has
 * no built-in SX1278/LoRa part, so this substitutes public MQTT over the
 * WiFi Wokwi gives every simulated ESP32). The BS-01 base station sketch
 * (in ../pfuma) subscribes to the same topic and receives it.
 *
 * The REAL physical firmware (SF7 LoRa, compact binary packet, no MQTT) is
 * in hardware/collar_node/firmware/collar_node.ino — see that file and
 * hardware/HARDWARE_DESIGN.md for what actually ships on real hardware.
 *
 *   Sensors in this sim:
 *     DS18B20     -> body temperature        (real Wokwi part)
 *     MPU-6050    -> movement / activity      (real Wokwi part)
 *     POT #1 (HR) -> heart rate 50..180 bpm   (stands in for MAX30102)
 *     POT #2 (GPS)-> geofence / zone drift     (stands in for NEO-6M)
 *
 * Board:     ESP32 Dev Module
 * Libraries: PubSubClient, ArduinoJson, Adafruit MPU6050,
 *            Adafruit Unified Sensor, OneWire, DallasTemperature
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <math.h>

// ── Network (MUST match the BS-01 sketch) ───────────────────────────────
const char* WIFI_SSID  = "Wokwi-GUEST";
const char* WIFI_PASS  = "";
const char* MQTT_HOST  = "broker.hivemq.com";
const int   MQTT_PORT  = 1883;
// This is a PUBLIC broker shared with every other Wokwi user on the internet
// — the topic string below is effectively your "room name" on it. It's
// already fairly unique (team + project), but if you ever see telemetry
// you didn't send, make it more unique (e.g. add today's date or your
// initials) and update the SAME string in the BS-01 sketch.
const char* MQTT_TOPIC = "pfuma/ramambo/griwd/telemetry-v2";   // <-- same as BS-01

// ── Collar identity ─────────────────────────────────────────────────────
// This is the device serial you'll pair in the app's IoT tab ("Paired
// Devices" panel), same as a real collar — max 8 characters to mirror the
// real firmware's convention (see IOT_HARDWARE_GUIDE.md).
#define COLLAR_ID    "CN001SIM"
#define ANIMAL_NAME  "Bessie"   // for your own reference only — not sent to the app; pairing links the collar to an animal in-app

// ── Pins ────────────────────────────────────────────────────────────────
#define PIN_DS18B20     15
#define PIN_POT_HR      34   // ADC1 (input only) — heart rate
#define PIN_POT_GPS     35   // ADC1 (input only) — geofence drift
#define PIN_LED_STATUS   2   // Green — TX heartbeat
#define PIN_LED_ALERT    4   // Red   — fever / theft
#define PIN_BUZZER       5   // Theft buzzer

OneWire            oneWire(PIN_DS18B20);
DallasTemperature  tempSensor(&oneWire);
Adafruit_MPU6050   mpu;
WiFiClient         net;
PubSubClient       mqtt(net);

bool          mpuOK = false;
unsigned long lastSend = 0, pkt = 0;

// ════════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println(F("\n=== PFUMA Collar CN-01 (Wokwi) ==="));

  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_LED_ALERT, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  analogReadResolution(12);            // 0..4095

  tempSensor.begin();
  Wire.begin(21, 22);
  mpuOK = mpu.begin();
  if (mpuOK) mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  else       Serial.println(F("[MPU] not found — activity will read 'Resting'"));

  connectWiFi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  Serial.println(F("[BOOT] Collar ready — transmitting every 3 s."));
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) reconnectMQTT();
  mqtt.loop();

  if (millis() - lastSend > 3000) {
    lastSend = millis();
    sendTelemetry();
  }
}

// ── Read sensors, build JSON, publish ───────────────────────────────────
void sendTelemetry() {
  // Temperature (drag the DS18B20 slider in Wokwi to change it)
  tempSensor.requestTemperatures();
  float temp = tempSensor.getTempCByIndex(0);
  if (temp < -100) temp = 38.5;                 // guard if sensor not ready

  // Heart rate from POT #1
  int hr = map(analogRead(PIN_POT_HR), 0, 4095, 50, 180);

  // Geofence from POT #2 — turn CW (toward max) to leave the safe zone
  int  zoneRaw = analogRead(PIN_POT_GPS);
  bool inZone  = zoneRaw < 3000;

  // Activity from the accelerometer
  float amag = 9.8;
  if (mpuOK) {
    sensors_event_t a, g, t;
    mpu.getEvent(&a, &g, &t);
    amag = sqrt(a.acceleration.x * a.acceleration.x +
                a.acceleration.y * a.acceleration.y +
                a.acceleration.z * a.acceleration.z);
  }
  float dev = fabs(amag - 9.8);
  const char* activity = (dev > 6) ? "Running" : (dev > 2) ? "Grazing" : "Resting";

  bool fever = temp > 39.5;
  bool theft = !inZone;
  int  batt  = 100 - (int)((pkt / 2) % 40);     // gentle drain for realism

  StaticJsonDocument<384> doc;
  doc["id"]       = COLLAR_ID;
  doc["animal"]   = ANIMAL_NAME;
  doc["temp"]     = round(temp * 10) / 10.0;
  doc["hr"]       = hr;
  doc["activity"] = activity;
  doc["inZone"]   = inZone;
  doc["batt"]     = batt;
  doc["fever"]    = fever;
  doc["theft"]    = theft;
  doc["pkt"]      = ++pkt;

  char buf[384];
  size_t n = serializeJson(doc, buf);
  bool ok = mqtt.publish(MQTT_TOPIC, buf, n);

  Serial.printf("[TX %s] %s\n", ok ? "OK" : "FAIL", buf);

  // Status LED heartbeat
  digitalWrite(PIN_LED_STATUS, HIGH); delay(60); digitalWrite(PIN_LED_STATUS, LOW);
  // Local alert outputs
  digitalWrite(PIN_LED_ALERT, (fever || theft) ? HIGH : LOW);
  digitalWrite(PIN_BUZZER, theft ? HIGH : LOW);
}

// ── Helpers ─────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("[WiFi] connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  int n = 0;
  while (WiFi.status() != WL_CONNECTED && n < 40) { delay(250); Serial.print('.'); n++; }
  Serial.println(WiFi.status() == WL_CONNECTED ? F(" connected") : F(" failed"));
}

void reconnectMQTT() {
  while (!mqtt.connected()) {
    String cid = "pfuma-cn01-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    Serial.print(F("[MQTT] connecting... "));
    if (mqtt.connect(cid.c_str())) Serial.println(F("ok"));
    else { Serial.printf("rc=%d, retry in 1.5s\n", mqtt.state()); delay(1500); }
  }
}