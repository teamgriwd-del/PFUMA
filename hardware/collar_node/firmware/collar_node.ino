/**
 * PFUMA Collar Node CN-01  — Firmware v1.0
 * PFUMA Livestock Monitoring System
 *
 * Hardware: ESP32-WROOM-32
 * Sensors : DS18B20 (temp) | MAX30102 (HR) | MPU-6050 (IMU) | NEO-6M (GPS)
 * Radio   : SX1278 LoRa 433 MHz
 * Power   : LiPo 3.7V + Solar via TP4056
 *
 * Sends a compact 28-byte binary CollarPacket every REPORT_INTERVAL_MS via
 * LoRa to BS-01 Base Station (see the CollarPacket struct + LORA_SF comment
 * below for why this isn't JSON-over-LoRa — the base station re-expands it
 * into JSON before forwarding to the Flask API over WiFi, where airtime is
 * not a constraint).
 * Switches to ALERT_INTERVAL_MS on theft / fever detection.
 *
 * Dependencies (install via Arduino Library Manager):
 *   OneWire, DallasTemperature, MPU6050 (ElectronicCats),
 *   SparkFun MAX3010x, TinyGPSPlus, LoRa (Sandeep Mistry)
 */

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>

// ── Sensor libraries ─────────────────────────────────────────────────────────
#include <OneWire.h>
#include <DallasTemperature.h>
#include <MPU6050.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ── Radio ─────────────────────────────────────────────────────────────────────
#include <LoRa.h>

// ═══════════════════════════════════════════════════════════════════════
//  PIN MAP  (matches HARDWARE_DESIGN.md CN-01)
// ═══════════════════════════════════════════════════════════════════════
#define PIN_ONE_WIRE     4
#define PIN_LORA_NSS     5
#define PIN_LORA_DIO1   12
#define PIN_LORA_DIO2   13
#define PIN_LORA_RST    14
#define PIN_LED          2
#define PIN_GPS_RX      16
#define PIN_GPS_TX      17
#define PIN_LORA_SCK    18
#define PIN_LORA_MISO   19
#define PIN_I2C_SDA     21
#define PIN_I2C_SCL     22
#define PIN_LORA_MOSI   23
#define PIN_LORA_DIO0   26
#define PIN_VBAT_ADC    34
#define PIN_MPU_INT     35

// ═══════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════
#define LORA_FREQ          433E6
#define LORA_BANDWIDTH     125E3
// SF7 (not SF9) is a deliberate capacity decision, not a default: at SF9 with
// this telemetry payload, airtime is ~1.15s/packet and a base station can only
// reliably hear ~4-5 collars before airtime collisions dominate. SF7 cuts
// airtime ~4x on its own, and combined with the compact binary packet below
// (~28 bytes instead of a ~230-byte JSON string) gets airtime down to ~70ms,
// supporting 30+ collars per base station at the 10s report interval. The
// trade-off is range: SF7 typically covers ~1-2km on farm terrain rather than
// SF9's ~5km open-field figure — acceptable for a single farm's paddocks; if
// your grazing area is unusually large/hilly, raise SF back up (see
// hardware/HARDWARE_DESIGN.md "Network Capacity" section for the full numbers
// and how to re-run this trade-off for your farm).
#define LORA_SF            7         // Spreading factor (range vs speed vs node capacity)
#define LORA_CR            5         // Coding rate 4/5
#define LORA_TX_POWER      17        // dBm (max 20)

// Collar identity — REPLACE before flashing each collar. Max 8 characters
// (fits the compact over-the-air packet) — suggested format "CNnnnFFF"
// (CN + 3-digit collar number + up to 3-char farm code), e.g. "CN014ZVI" for
// collar #14 on a Zvimba farm. This exact string is also what you'll type
// into the app's IoT tab ("Paired Devices" panel) to claim this collar under
// your PFUMA account and attach it to the matching animal — the animal name
// and tag live in the app/database, not on the collar, so they aren't sent
// over the air.
#define COLLAR_ID          "CN014ZVI"

// Safe zone (home paddock GPS coordinates)
#define SAFE_LAT          -17.3601f
#define SAFE_LON           30.1918f
#define SAFE_RADIUS_DEG    0.0045f   // ~500m in degrees

// Reporting intervals (ms)
#define REPORT_INTERVAL_MS   10000UL  // Normal: every 10s
#define ALERT_INTERVAL_MS     3000UL  // Theft / fever: every 3s

// Thresholds
#define TEMP_FEVER_C         39.5f    // Body temp above this = fever
#define TEMP_HIGH_C          39.0f    // Elevated (warn)
#define MOVEMENT_THEFT       2500     // Accel magnitude during fast movement
#define BATT_LOW_PCT         20       // Battery warn threshold
#define HR_HIGH_BPM          100      // Heart rate concern

// I2C addresses
#define I2C_ADDR_MPU       0x68
#define I2C_ADDR_MAX       0x57

// ═══════════════════════════════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════════════════════════════
OneWire           oneWire(PIN_ONE_WIRE);
DallasTemperature tempSensor(&oneWire);

MPU6050           mpu;
MAX30105          maxSensor;
TinyGPSPlus       gps;
HardwareSerial    gpsSerial(2);   // UART2

// Telemetry state (in-memory, full precision — trimmed down to the compact
// binary CollarPacket below only at the moment of transmission)
struct Telemetry {
  float  bodyTempC   = 0.0f;
  int    heartRate   = 0;
  float  latitude    = 0.0f;
  float  longitude   = 0.0f;
  float  gpsAccuracy = 0.0f;
  int    accelX      = 0;
  int    accelY      = 0;
  int    accelZ      = 0;
  int    moveMag     = 0;
  String activity    = "Unknown";
  bool   inSafeZone  = true;
  int    battPct     = 100;
  int    signalRSSI  = 0;
  bool   feverAlert  = false;
  bool   theftAlert  = false;
  String timestamp   = "";
};

// ── Compact over-the-air packet ─────────────────────────────────────────────
// 28 bytes total, deliberately binary (not JSON) — see the LORA_SF comment
// above for why. Animal name/tag are NOT sent: the base station/backend look
// those up from collarId via the app's device-pairing table, so they never
// need to travel over the airtime-constrained LoRa link.
enum Activity : uint8_t { ACT_RESTING = 0, ACT_GRAZING = 1, ACT_WALKING = 2, ACT_RUNNING = 3, ACT_UNKNOWN = 255 };

struct __attribute__((packed)) CollarPacket {
  char     collarId[8];    // null-padded, e.g. "CN014ZVI"
  int16_t  tempC_x10;      // body temp * 10 (e.g. 385 = 38.5C)
  uint8_t  heartRate;      // bpm, 0-255
  int32_t  lat_x1e6;       // latitude  * 1,000,000 (fixed point, ~0.11m precision)
  int32_t  lon_x1e6;       // longitude * 1,000,000
  uint16_t gpsAcc_x10;     // HDOP * 10
  uint16_t moveMag;        // movement magnitude (see readIMU)
  uint8_t  activity;       // Activity enum
  uint8_t  battPct;        // 0-100
  uint8_t  flags;          // bit0=inSafeZone, bit1=feverAlert, bit2=theftAlert
  uint16_t pkt;            // packet counter (wraps at 65535)
};                         // sizeof == 28 bytes

Telemetry tel;

unsigned long lastReport   = 0;
unsigned long reportInterval = REPORT_INTERVAL_MS;
int           packetCount  = 0;

// HR beat detection
const byte    HR_RATE_SIZE = 4;
byte          rates[HR_RATE_SIZE];
byte          rateIndex    = 0;
long          lastBeat     = 0;
float         beatsPerMin  = 0;
int           beatAvg      = 0;

// ═══════════════════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println(F("\n=== PFUMA Collar Node CN-01 ==="));
  Serial.printf("Collar ID: %s  (pair this exact string in the app's IoT tab)\n", COLLAR_ID);
  static_assert(sizeof(CollarPacket) == 28, "CollarPacket drifted from the documented 28-byte layout");

  pinMode(PIN_LED, OUTPUT);
  blinkLED(3, 200);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  initLoRa();
  initTempSensor();
  initIMU();
  initHeartRate();
  initGPS();

  Serial.println(F("[BOOT] All systems ready."));
  blinkLED(5, 80);
}

// ═══════════════════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════
void loop() {
  // Feed GPS parser continuously
  while (gpsSerial.available())
    gps.encode(gpsSerial.read());

  // Collect HR beat in real-time between reports
  sampleHeartRate();

  unsigned long now = millis();
  if (now - lastReport >= reportInterval) {
    lastReport = now;

    digitalWrite(PIN_LED, HIGH);

    readTemperature();
    readIMU();
    readGPS();
    readBattery();
    buildAlerts();
    sendLoRa();

    digitalWrite(PIN_LED, LOW);

    // Adaptive interval — fast tracking when alert active
    reportInterval = (tel.theftAlert || tel.feverAlert)
                     ? ALERT_INTERVAL_MS
                     : REPORT_INTERVAL_MS;

    printDebug();
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  INIT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════
void initLoRa() {
  Serial.print(F("[LoRa] Initialising 433 MHz... "));
  LoRa.setPins(PIN_LORA_NSS, PIN_LORA_RST, PIN_LORA_DIO0);
  SPI.begin(PIN_LORA_SCK, PIN_LORA_MISO, PIN_LORA_MOSI, PIN_LORA_NSS);

  if (!LoRa.begin(LORA_FREQ)) {
    Serial.println(F("FAILED — check wiring!"));
    errorHalt();
  }
  LoRa.setSignalBandwidth(LORA_BANDWIDTH);
  LoRa.setSpreadingFactor(LORA_SF);
  LoRa.setCodingRate4(LORA_CR);
  LoRa.setTxPower(LORA_TX_POWER);
  LoRa.setSyncWord(0xF3);         // Private network byte (matches base station)
  Serial.println(F("OK"));
}

void initTempSensor() {
  Serial.print(F("[DS18B20] Initialising... "));
  tempSensor.begin();
  int count = tempSensor.getDeviceCount();
  Serial.printf("%d sensor(s) found\n", count);
  if (count == 0) Serial.println(F("[DS18B20] WARNING: No sensor on 1-Wire bus"));
}

void initIMU() {
  Serial.print(F("[MPU-6050] Initialising... "));
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println(F("FAILED — check I2C address 0x68"));
  } else {
    mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_4);  // ±4g
    mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_500);  // ±500°/s
    Serial.println(F("OK"));
  }
}

void initHeartRate() {
  Serial.print(F("[MAX30102] Initialising... "));
  if (!maxSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println(F("FAILED — check I2C address 0x57"));
    return;
  }
  maxSensor.setup();
  maxSensor.setPulseAmplitudeRed(0x0A);   // Low power red LED
  maxSensor.setPulseAmplitudeGreen(0);    // Off
  Serial.println(F("OK"));
}

void initGPS() {
  Serial.print(F("[NEO-6M] Initialising UART2... "));
  gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  Serial.println(F("OK — waiting for fix"));
}

// ═══════════════════════════════════════════════════════════════════════
//  SENSOR READS
// ═══════════════════════════════════════════════════════════════════════
void readTemperature() {
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  tel.bodyTempC = (t == DEVICE_DISCONNECTED_C) ? tel.bodyTempC : t;
}

void sampleHeartRate() {
  long irValue = maxSensor.getIR();
  if (checkForBeat(irValue)) {
    long delta = millis() - lastBeat;
    lastBeat   = millis();
    beatsPerMin = 60.0f / (delta / 1000.0f);

    if (beatsPerMin >= 40 && beatsPerMin <= 180) {
      rates[rateIndex++] = (byte)beatsPerMin;
      rateIndex %= HR_RATE_SIZE;
      beatAvg = 0;
      for (byte x = 0; x < HR_RATE_SIZE; x++) beatAvg += rates[x];
      beatAvg /= HR_RATE_SIZE;
    }
  }
  tel.heartRate = beatAvg;
}

void readIMU() {
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);

  // Scale raw to mg (at ±4g range: 1g = 8192 LSB)
  tel.accelX = ax / 8;
  tel.accelY = ay / 8;
  tel.accelZ = az / 8;

  // Movement magnitude (subtract gravity ~1000 from Z)
  int dz = (az / 8) - 1000;
  tel.moveMag = abs(ax / 8) + abs(ay / 8) + abs(dz);

  // Activity classification from magnitude
  if      (tel.moveMag < 100)  tel.activity = "Resting";
  else if (tel.moveMag < 400)  tel.activity = "Grazing";
  else if (tel.moveMag < 1200) tel.activity = "Walking";
  else                          tel.activity = "Running";
}

void readGPS() {
  if (gps.location.isValid() && gps.location.age() < 5000) {
    tel.latitude    = gps.location.lat();
    tel.longitude   = gps.location.lng();
    tel.gpsAccuracy = gps.hdop.isValid() ? gps.hdop.value() / 100.0f : 99.9f;
  }

  // Zone check: haversine approximation (accurate enough at farm scale)
  float dLat = tel.latitude  - SAFE_LAT;
  float dLon = tel.longitude - SAFE_LON;
  float dist  = sqrt(dLat * dLat + dLon * dLon);
  tel.inSafeZone = (dist <= SAFE_RADIUS_DEG) || !gps.location.isValid();

  // Build timestamp from GPS
  if (gps.time.isValid()) {
    char ts[20];
    snprintf(ts, sizeof(ts), "%02d:%02d:%02d",
             gps.time.hour(), gps.time.minute(), gps.time.second());
    tel.timestamp = String(ts);
  } else {
    tel.timestamp = String(millis() / 1000) + "s";
  }
}

void readBattery() {
  // Voltage divider: R2=100k, R3=100k → ADC reads Vbat/2
  // ADC max = 3.3V at 4095 counts
  int raw   = analogRead(PIN_VBAT_ADC);
  float adc = (raw / 4095.0f) * 3.3f;
  float vbat = adc * 2.0f;                          // Undo voltage divider

  // LiPo: 4.2V = 100%, 3.0V = 0%
  tel.battPct = constrain((int)((vbat - 3.0f) / 1.2f * 100), 0, 100);
}

// ═══════════════════════════════════════════════════════════════════════
//  ALERT LOGIC
// ═══════════════════════════════════════════════════════════════════════
void buildAlerts() {
  // Fever: body temp above threshold
  tel.feverAlert = (tel.bodyTempC >= TEMP_FEVER_C);

  // Theft signature: outside safe zone AND rapid movement
  tel.theftAlert = (!tel.inSafeZone && tel.moveMag > MOVEMENT_THEFT);
}

// ═══════════════════════════════════════════════════════════════════════
//  LORA TRANSMIT — compact binary CollarPacket, not JSON (see LORA_SF comment)
// ═══════════════════════════════════════════════════════════════════════
uint8_t activityToEnum(const String& a) {
  if (a == "Resting") return ACT_RESTING;
  if (a == "Grazing") return ACT_GRAZING;
  if (a == "Walking") return ACT_WALKING;
  if (a == "Running") return ACT_RUNNING;
  return ACT_UNKNOWN;
}

void sendLoRa() {
  CollarPacket pkt = {};
  strncpy(pkt.collarId, COLLAR_ID, sizeof(pkt.collarId));  // truncates/pads to 8 bytes

  pkt.tempC_x10  = (int16_t)round(tel.bodyTempC * 10);
  pkt.heartRate  = (uint8_t)constrain(tel.heartRate, 0, 255);
  pkt.lat_x1e6   = (int32_t)round(tel.latitude  * 1000000.0);
  pkt.lon_x1e6   = (int32_t)round(tel.longitude * 1000000.0);
  pkt.gpsAcc_x10 = (uint16_t)constrain((int)round(tel.gpsAccuracy * 10), 0, 65535);
  pkt.moveMag    = (uint16_t)constrain(tel.moveMag, 0, 65535);
  pkt.activity   = activityToEnum(tel.activity);
  pkt.battPct    = (uint8_t)constrain(tel.battPct, 0, 100);
  pkt.flags      = (tel.inSafeZone ? 0x01 : 0) | (tel.feverAlert ? 0x02 : 0) | (tel.theftAlert ? 0x04 : 0);
  pkt.pkt        = (uint16_t)(++packetCount & 0xFFFF);

  LoRa.beginPacket();
  LoRa.write((uint8_t*)&pkt, sizeof(pkt));
  int ok = LoRa.endPacket();

  tel.signalRSSI = LoRa.packetRssi();
  Serial.printf("[LoRa] TX pkt#%d (%u bytes, SF%d) %s\n",
                packetCount, (unsigned)sizeof(pkt), LORA_SF, ok ? "OK" : "FAIL");
}

// ═══════════════════════════════════════════════════════════════════════
//  DEBUG OUTPUT (mirrors IoTScreen.js data model)
// ═══════════════════════════════════════════════════════════════════════
void printDebug() {
  Serial.println(F("─────────────────────────────────"));
  Serial.printf("Collar   : %s\n", COLLAR_ID);
  Serial.printf("Temp     : %.1f°C  %s\n",
                tel.bodyTempC, tel.feverAlert ? "*** FEVER ***" : "OK");
  Serial.printf("Heart    : %d bpm  %s\n",
                tel.heartRate, tel.heartRate > HR_HIGH_BPM ? "HIGH" : "OK");
  Serial.printf("Activity : %s  (move=%d)\n", tel.activity.c_str(), tel.moveMag);
  Serial.printf("GPS      : %.5f, %.5f  acc=%.1f\n",
                tel.latitude, tel.longitude, tel.gpsAccuracy);
  Serial.printf("Zone     : %s  %s\n",
                tel.inSafeZone ? "IN SAFE ZONE" : "OUTSIDE ZONE",
                tel.theftAlert ? "*** THEFT ALERT ***" : "");
  Serial.printf("Battery  : %d%%  RSSI=%d dBm\n", tel.battPct, tel.signalRSSI);
  Serial.printf("Interval : %lu ms\n", reportInterval);
  Serial.println(F("─────────────────────────────────"));
}

// ═══════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════
void blinkLED(int times, int ms) {
  for (int i = 0; i < times; i++) {
    digitalWrite(PIN_LED, HIGH); delay(ms);
    digitalWrite(PIN_LED, LOW);  delay(ms);
  }
}

void errorHalt() {
  Serial.println(F("[HALT] Critical hardware error. Check connections."));
  while (true) {
    digitalWrite(PIN_LED, HIGH); delay(100);
    digitalWrite(PIN_LED, LOW);  delay(100);
  }
}
