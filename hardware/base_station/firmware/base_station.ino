/**
 * PFUMA Base Station BS-01 — Firmware v1.0
 * PFUMA Livestock Monitoring System
 *
 * Hardware: ESP32-WROOM-32
 * Radio   : SX1278 LoRa 433 MHz (receives collar packets)
 * Display : SSD1306 OLED 128×64
 * Network : WiFi → Flask API (backend/app.py)
 *
 * Receives the compact 28-byte binary CollarPacket from collar nodes over
 * LoRa (see collar_node.ino — this struct must match exactly), re-expands it
 * into JSON, and forwards to the PFUMA API via WiFi where airtime is not a
 * constraint. Displays live collar status on OLED.
 * Drives 4 status LEDs: PWR / LoRa / WiFi / Alert.
 *
 * Dependencies:
 *   LoRa (Sandeep Mistry), ArduinoJson, WiFi (built-in),
 *   HTTPClient (built-in), Adafruit SSD1306, Adafruit GFX
 */

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <LoRa.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ═══════════════════════════════════════════════════════════════════════
//  PIN MAP  (matches HARDWARE_DESIGN.md BS-01)
// ═══════════════════════════════════════════════════════════════════════
#define PIN_LORA_NSS     5
#define PIN_LORA_RST    14
#define PIN_LORA_DIO0   26
#define PIN_LORA_SCK    18
#define PIN_LORA_MISO   19
#define PIN_LORA_MOSI   23
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22

#define PIN_LED_PWR      2    // Green
#define PIN_LED_LORA     4    // Blue
#define PIN_LED_WIFI     15   // Yellow
#define PIN_LED_ALERT    13   // Red

// ═══════════════════════════════════════════════════════════════════════
//  CONFIGURATION — REPLACE THE 4 VALUES BELOW BEFORE FLASHING
//  See "Connecting Your Physical Hardware" in IOT_HARDWARE_GUIDE.md for the
//  full step-by-step (non-technical) walkthrough.
// ═══════════════════════════════════════════════════════════════════════
#define WIFI_SSID        "YOUR_FARM_WIFI_NAME"      // <-- your router's WiFi name
#define WIFI_PASS        "YOUR_FARM_WIFI_PASSWORD"  // <-- your router's WiFi password

// The IP address of the computer/server running backend/app.py on your farm
// network (find it with `ipconfig` on Windows or `ifconfig`/`ip addr` on
// Mac/Linux — look for the local 192.168.x.x address, not 127.0.0.1).
#define API_HOST         "http://YOUR_SERVER_IP:5000"
#define API_IOT_ENDPOINT "/api/iot/telemetry"
#define API_ALERT_ENDPOINT "/api/iot/alert"

#define LORA_FREQ        433E6
#define LORA_BANDWIDTH   125E3
// Must match collar_node.ino exactly — see its LORA_SF comment for the
// airtime/capacity trade-off this value encodes (~30 collars at SF7 with the
// compact binary packet vs. ~4-5 at the old SF9+JSON combination).
#define LORA_SF          7
#define LORA_CR          5

// This is the device serial you'll type into the app's IoT tab ("Paired
// Devices" panel) to claim this base station under your PFUMA account.
// Give every base station/collar a unique ID, e.g. "BS-01-<YourFarmCode>".
#define STATION_ID       "BS-01-HNO"

// OLED
#define OLED_WIDTH       128
#define OLED_HEIGHT       64
#define OLED_ADDR        0x3C
#define OLED_RESET       -1

// ═══════════════════════════════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════════════════════════════
Adafruit_SSD1306 oled(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET);

// ── Over-the-air packet — MUST exactly match CollarPacket in collar_node.ino ──
enum Activity : uint8_t { ACT_RESTING = 0, ACT_GRAZING = 1, ACT_WALKING = 2, ACT_RUNNING = 3, ACT_UNKNOWN = 255 };

struct __attribute__((packed)) CollarPacket {
  char     collarId[8];
  int16_t  tempC_x10;
  uint8_t  heartRate;
  int32_t  lat_x1e6;
  int32_t  lon_x1e6;
  uint16_t gpsAcc_x10;
  uint16_t moveMag;
  uint8_t  activity;
  uint8_t  battPct;
  uint8_t  flags;
  uint16_t pkt;
};  // sizeof == 28 bytes

const char* activityName(uint8_t a) {
  switch (a) {
    case ACT_RESTING: return "Resting";
    case ACT_GRAZING: return "Grazing";
    case ACT_WALKING: return "Walking";
    case ACT_RUNNING: return "Running";
    default:          return "Unknown";
  }
}

// Max collars one base station tracks locally (OLED rotation + RAM budget).
// At SF7 + this 28-byte packet, the RF layer comfortably supports 30+ collars
// at the 10s report interval (~22% channel utilization) — see
// hardware/HARDWARE_DESIGN.md "Network Capacity" section for the full numbers.
#define MAX_COLLARS 40

struct CollarRecord {
  String  collarId;
  float   temp;
  int     hr;
  String  activity;
  bool    inZone;
  int     batt;
  bool    fever;
  bool    theft;
  int     rssi;
  unsigned long lastSeen;
};

CollarRecord collars[MAX_COLLARS];
int          collarCount  = 0;
int          oledPage     = 0;         // Which collar to show on OLED
unsigned long lastOledSwitch = 0;
unsigned long totalReceived  = 0;
unsigned long totalForwarded = 0;
bool          wifiConnected  = false;

// ═══════════════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println(F("\n=== PFUMA Base Station BS-01 ==="));

  initLEDs();
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  initOLED();
  initLoRa();
  initWiFi();

  digitalWrite(PIN_LED_PWR, HIGH);
  showOLED_Boot();
  Serial.println(F("[BOOT] Base station ready — listening for collars."));
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════
void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    handleLoRaPacket(packetSize);
  }

  // Rotate OLED display every 4 seconds
  if (millis() - lastOledSwitch > 4000 && collarCount > 0) {
    lastOledSwitch = millis();
    oledPage = (oledPage + 1) % collarCount;
    updateOLED();
  }

  // WiFi reconnect if dropped
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    digitalWrite(PIN_LED_WIFI, LOW);
    Serial.println(F("[WiFi] Reconnecting..."));
    WiFi.reconnect();
    delay(2000);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  LORA RECEIVE
// ═══════════════════════════════════════════════════════════════════════
void handleLoRaPacket(int size) {
  if (size != sizeof(CollarPacket)) {
    // Not one of ours (or a corrupted/partial packet) — drop it rather than
    // mis-parse garbage into a collar record.
    while (LoRa.available()) LoRa.read();
    Serial.printf("[LoRa] RX %d bytes — expected %u, dropped\n", size, (unsigned)sizeof(CollarPacket));
    return;
  }

  CollarPacket pkt;
  LoRa.readBytes((uint8_t*)&pkt, sizeof(pkt));
  int rssi = LoRa.packetRssi();

  digitalWrite(PIN_LED_LORA, HIGH);
  totalReceived++;

  char idBuf[9];
  memcpy(idBuf, pkt.collarId, 8);
  idBuf[8] = '\0';
  Serial.printf("[LoRa] RX %s  %d bytes  RSSI=%d dBm  pkt#%u\n", idBuf, size, rssi, pkt.pkt);

  updateCollarRecord(pkt, idBuf, rssi);

  bool anyAlert = (pkt.flags & 0x02) || (pkt.flags & 0x04);  // fever | theft
  if (WiFi.status() == WL_CONNECTED) {
    forwardToAPI(pkt, idBuf, rssi, anyAlert);
  }

  digitalWrite(PIN_LED_ALERT, anyAlert ? HIGH : LOW);

  updateOLED();
  delay(50);
  digitalWrite(PIN_LED_LORA, LOW);
}

void updateCollarRecord(const CollarPacket& pkt, const char* id, int rssi) {
  int idx = -1;
  for (int i = 0; i < collarCount; i++) {
    if (collars[i].collarId == id) { idx = i; break; }
  }
  if (idx == -1 && collarCount < MAX_COLLARS) {
    idx = collarCount++;
  }
  if (idx == -1) return;  // Table full — raise MAX_COLLARS if you have a bigger herd

  collars[idx].collarId = id;
  collars[idx].temp     = pkt.tempC_x10 / 10.0f;
  collars[idx].hr       = pkt.heartRate;
  collars[idx].activity = activityName(pkt.activity);
  collars[idx].inZone   = pkt.flags & 0x01;
  collars[idx].batt     = pkt.battPct;
  collars[idx].fever    = pkt.flags & 0x02;
  collars[idx].theft    = pkt.flags & 0x04;
  collars[idx].rssi     = rssi;
  collars[idx].lastSeen = millis();
}

// ═══════════════════════════════════════════════════════════════════════
//  API FORWARDING — re-expand the compact packet into JSON for the backend;
//  WiFi/HTTP has no airtime budget to worry about, unlike the LoRa hop.
// ═══════════════════════════════════════════════════════════════════════
void forwardToAPI(const CollarPacket& pkt, const char* id, int rssi, bool isAlert) {
  StaticJsonDocument<384> doc;
  doc["id"]       = id;
  doc["temp"]     = pkt.tempC_x10 / 10.0f;
  doc["hr"]       = pkt.heartRate;
  doc["lat"]      = pkt.lat_x1e6 / 1000000.0;
  doc["lon"]      = pkt.lon_x1e6 / 1000000.0;
  doc["gpsAcc"]   = pkt.gpsAcc_x10 / 10.0f;
  doc["activity"] = activityName(pkt.activity);
  doc["move"]     = pkt.moveMag;
  doc["inZone"]   = (bool)(pkt.flags & 0x01);
  doc["batt"]     = pkt.battPct;
  doc["fever"]    = (bool)(pkt.flags & 0x02);
  doc["theft"]    = (bool)(pkt.flags & 0x04);
  doc["pkt"]      = pkt.pkt;
  doc["rssi"]     = rssi;

  String body;
  serializeJson(doc, body);

  HTTPClient http;
  String endpoint = String(API_HOST) + (isAlert ? API_ALERT_ENDPOINT : API_IOT_ENDPOINT);

  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Station-ID", STATION_ID);
  http.setTimeout(3000);

  int code = http.POST(body);
  if (code > 0) {
    totalForwarded++;
    Serial.printf("[API] POST %s → %d\n", endpoint.c_str(), code);
  } else {
    Serial.printf("[API] POST FAILED: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

// ═══════════════════════════════════════════════════════════════════════
//  OLED DISPLAY
// ═══════════════════════════════════════════════════════════════════════
void initOLED() {
  if (!oled.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println(F("[OLED] Not found — continuing without display"));
    return;
  }
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  Serial.println(F("[OLED] OK"));
}

void showOLED_Boot() {
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.println(F("PFUMA"));
  oled.println(F("Base Station BS-01"));
  oled.drawLine(0, 18, 128, 18, SSD1306_WHITE);
  oled.setCursor(0, 22);
  oled.println(F("Listening on 433MHz"));
  oled.setCursor(0, 34);
  oled.printf("Station: %s\n", STATION_ID);
  oled.setCursor(0, 46);
  oled.println(wifiConnected ? "WiFi: Connected" : "WiFi: Connecting...");
  oled.display();
}

void updateOLED() {
  oled.clearDisplay();

  if (collarCount == 0) {
    showOLED_Boot();
    return;
  }

  CollarRecord& c = collars[oledPage];

  // Header bar
  oled.fillRect(0, 0, 128, 14, SSD1306_WHITE);
  oled.setTextColor(SSD1306_BLACK);
  oled.setTextSize(1);
  oled.setCursor(2, 3);
  oled.printf("%s  [%d/%d]", c.collarId.c_str(), oledPage + 1, collarCount);
  oled.setTextColor(SSD1306_WHITE);

  // Vitals
  oled.setTextSize(1);
  oled.setCursor(0, 18);
  oled.printf("Temp : %.1fC  HR: %d bpm\n", c.temp, c.hr);
  oled.printf("Move : %s\n", c.activity.c_str());
  oled.printf("Zone : %s\n", c.inZone ? "IN SAFE ZONE" : "!! OUTSIDE !!");
  oled.printf("Batt : %d%%   RSSI:%ddBm\n", c.batt, c.rssi);

  // Alert strip
  if (c.fever || c.theft) {
    oled.fillRect(0, 56, 128, 8, SSD1306_WHITE);
    oled.setTextColor(SSD1306_BLACK);
    oled.setCursor(2, 57);
    if (c.fever && c.theft)     oled.print(F("FEVER + THEFT ALERT"));
    else if (c.fever)            oled.print(F("FEVER DETECTED"));
    else                         oled.print(F("THEFT ALERT"));
    oled.setTextColor(SSD1306_WHITE);
  } else {
    oled.setCursor(0, 57);
    oled.printf("RX:%lu FWD:%lu", totalReceived, totalForwarded);
  }

  oled.display();
}

// ═══════════════════════════════════════════════════════════════════════
//  INIT HELPERS
// ═══════════════════════════════════════════════════════════════════════
void initLEDs() {
  int pins[] = { PIN_LED_PWR, PIN_LED_LORA, PIN_LED_WIFI, PIN_LED_ALERT };
  for (int p : pins) {
    pinMode(p, OUTPUT);
    digitalWrite(p, LOW);
  }
  // Startup sweep
  for (int p : pins) { digitalWrite(p, HIGH); delay(120); digitalWrite(p, LOW); }
}

void initLoRa() {
  Serial.print(F("[LoRa] Initialising 433 MHz... "));
  LoRa.setPins(PIN_LORA_NSS, PIN_LORA_RST, PIN_LORA_DIO0);
  SPI.begin(PIN_LORA_SCK, PIN_LORA_MISO, PIN_LORA_MOSI, PIN_LORA_NSS);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println(F("FAILED"));
    while (true) { delay(500); }
  }
  LoRa.setSignalBandwidth(LORA_BANDWIDTH);
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setCodingRate4(LORA_CR);
  LoRa.setSyncWord(0xF3);    // Must match collar firmware
  LoRa.receive();            // Put in continuous receive mode
  Serial.println(F("OK — continuous RX mode"));
}

void initWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    digitalWrite(PIN_LED_WIFI, HIGH);
    Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println(F("\n[WiFi] FAILED — will retry in loop. Continuing offline."));
  }
}
