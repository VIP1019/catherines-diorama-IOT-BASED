#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h> // TFT 1.8"

// Provide the token generation process info.
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// -----------------------------------------------------
// PIN DEFINITIONS
// -----------------------------------------------------

// KTV RGB LEDs
#define LED_R_PIN 25
#define LED_G_PIN 27
#define LED_B_PIN 32

// TFT 1.8" DISPLAY (SPI)
#define TFT_CS    5
#define TFT_RST   22
#define TFT_DC    21
#define TFT_SDA   23
#define TFT_SCLK  18

// RELAYS
#define EVENT_HALL_RLY_PIN 33
#define STAGE_SPOT_RLY_PIN 19
#define POOL_PUMP_RLY_PIN  16

// TACTILE BUTTONS (NEW)
#define BTN_KTV_PLAY_PIN 4
#define BTN_BEACON_PIN   13
#define BTN_POOL_PIN     14
#define BTN_EVENT_PIN    15
#define BTN_COTTAGE_PIN  26

// -----------------------------------------------------
// OBJECTS & GLOBALS
// -----------------------------------------------------
Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool signupOK = false;

// FIREBASE CREDENTIALS
#define WIFI_SSID "TP-Link_5885"
#define WIFI_PASSWORD "rNvFULp2"
#define API_KEY "AIzaSyCQuIal-nZj4PKoJqU1a60Rx2W-EO6hxI8"
#define DATABASE_URL "https://catherines-diorama-default-rtdb.asia-southeast1.firebasedatabase.app"

// State Trackers
unsigned long lastHeartbeat = 0;
int heartbeatCount = 0;

// TFT Trackers
int lastSongId = -1;
String lastPlayback = "";
unsigned long lastLyricTimer = 0;
int lyricIndex = 0;

// Local States for Instant Button Response
bool ktvPlaying = false;
bool beaconOn = false;
bool poolPumpOn = false;
bool eventModeOn = false;
bool cottageLightOn = false;

// Button Trackers
bool lastKtvBtn = HIGH;
bool lastBeaconBtn = HIGH;
bool lastPoolBtn = HIGH;
bool lastEventBtn = HIGH;
bool lastCottageBtn = HIGH;
unsigned long lastDebounceTime = 0;

void setup() {
  Serial.begin(115200);
  
  // Initialize Pins
  pinMode(LED_R_PIN, OUTPUT);
  pinMode(LED_G_PIN, OUTPUT);
  pinMode(LED_B_PIN, OUTPUT);
  
  pinMode(EVENT_HALL_RLY_PIN, OUTPUT);
  pinMode(STAGE_SPOT_RLY_PIN, OUTPUT);
  pinMode(POOL_PUMP_RLY_PIN, OUTPUT);
  
  // Buttons
  pinMode(BTN_KTV_PLAY_PIN, INPUT_PULLUP);
  pinMode(BTN_BEACON_PIN, INPUT_PULLUP);
  pinMode(BTN_POOL_PIN, INPUT_PULLUP);
  pinMode(BTN_EVENT_PIN, INPUT_PULLUP);
  pinMode(BTN_COTTAGE_PIN, INPUT_PULLUP);

  // Initialize TFT
  tft.initR(INITR_BLACKTAB);
  tft.setRotation(1); 
  tft.fillScreen(ST77XX_BLACK);
  
  drawTFTBorder();
  tft.setCursor(20, 50);
  tft.setTextColor(ST77XX_YELLOW);
  tft.setTextSize(1);
  tft.print("CONNECTING TO WIFI...");
  
  // Connect WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  tft.fillScreen(ST77XX_BLACK);
  drawTFTBorder();
  tft.setCursor(20, 50);
  tft.setTextColor(ST77XX_GREEN);
  tft.print("WIFI CONNECTED!");
  
  // Firebase Setup
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  if (Firebase.signUp(&config, &auth, "", "")) {
    signupOK = true;
  }
  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  tft.fillScreen(ST77XX_BLACK);
  drawTFTBorder();
  updateTFTUI(0, "stopped");
}

unsigned long lastFirebaseRead = 0;

void loop() {
  if (Firebase.ready() && signupOK) {
    
    checkPhysicalButtons();
    
    if (millis() - lastFirebaseRead > 1000) {
      lastFirebaseRead = millis();
      readLightingState();
      readEventState();
      readPoolState();
      readKTVState(); 
    }
    
    // Heartbeat
    if (millis() - lastHeartbeat > 3000) {
      lastHeartbeat = millis();
      Firebase.RTDB.setInt(&fbdo, "/diorama/status/esp2/heartbeat", heartbeatCount++);
      Firebase.RTDB.setInt(&fbdo, "/diorama/status/esp2/rssi", WiFi.RSSI());
    }
  }
}

// ==========================================
// PHYSICAL BUTTONS
// ==========================================
void checkPhysicalButtons() {
  if (millis() - lastDebounceTime > 50) {
    
    bool ktvBtn = digitalRead(BTN_KTV_PLAY_PIN);
    if (ktvBtn == LOW && lastKtvBtn == HIGH) {
      ktvPlaying = !ktvPlaying;
      Firebase.RTDB.setString(&fbdo, "/diorama/ktv/playback", ktvPlaying ? "playing" : "stopped");
      lastDebounceTime = millis();
    }
    lastKtvBtn = ktvBtn;

    bool beaconBtn = digitalRead(BTN_BEACON_PIN);
    if (beaconBtn == LOW && lastBeaconBtn == HIGH) {
      beaconOn = !beaconOn;
      Firebase.RTDB.setBool(&fbdo, "/diorama/beacon/on", beaconOn);
      lastDebounceTime = millis();
    }
    lastBeaconBtn = beaconBtn;

    bool poolBtn = digitalRead(BTN_POOL_PIN);
    if (poolBtn == LOW && lastPoolBtn == HIGH) {
      poolPumpOn = !poolPumpOn;
      digitalWrite(POOL_PUMP_RLY_PIN, poolPumpOn ? HIGH : LOW); // INSTANT physical response
      Firebase.RTDB.setBool(&fbdo, "/diorama/pool/pump", poolPumpOn);
      lastDebounceTime = millis();
    }
    lastPoolBtn = poolBtn;

    bool eventBtn = digitalRead(BTN_EVENT_PIN);
    if (eventBtn == LOW && lastEventBtn == HIGH) {
      eventModeOn = !eventModeOn;
      Firebase.RTDB.setBool(&fbdo, "/diorama/event/mode", eventModeOn);
      lastDebounceTime = millis();
    }
    lastEventBtn = eventBtn;

    bool cottageBtn = digitalRead(BTN_COTTAGE_PIN);
    if (cottageBtn == LOW && lastCottageBtn == HIGH) {
      cottageLightOn = !cottageLightOn;
      Firebase.RTDB.setBool(&fbdo, "/diorama/cottages/c1/light", cottageLightOn);
      lastDebounceTime = millis();
    }
    lastCottageBtn = cottageBtn;
  }
}

// ==========================================
// KTV TFT SCREEN LOGIC
// ==========================================
void readKTVState() {
  int currentSongId = 0;
  String currentPlayback = "stopped";
  
  if (Firebase.RTDB.getInt(&fbdo, "/diorama/ktv/song")) {
    currentSongId = fbdo.intData();
  }
  if (Firebase.RTDB.getString(&fbdo, "/diorama/ktv/playback")) {
    currentPlayback = fbdo.stringData();
  }
  
  if (currentSongId != lastSongId || currentPlayback != lastPlayback) {
    lastSongId = currentSongId;
    lastPlayback = currentPlayback;
    lyricIndex = 0; 
    updateTFTUI(currentSongId, currentPlayback);
  }
  
  if (currentPlayback == "playing") {
    if (millis() - lastLyricTimer > 2500) {
      lastLyricTimer = millis();
      drawLyrics(currentSongId);
    }
  }
}

void drawTFTBorder() {
  tft.drawRect(0, 0, tft.width(), tft.height(), ST77XX_MAGENTA);
  tft.drawRect(2, 2, tft.width()-4, tft.height()-4, ST77XX_CYAN);
  
  tft.fillRect(2, 2, tft.width()-4, 20, ST77XX_BLUE);
  tft.setCursor(30, 6);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(1);
  tft.print("CATHERINE'S KTV");
}

void updateTFTUI(int songId, String playback) {
  tft.fillScreen(ST77XX_BLACK);
  drawTFTBorder();
  
  tft.setTextSize(1);
  tft.setCursor(10, 35);
  
  if (playback == "stopped") {
    tft.setTextColor(ST77XX_YELLOW);
    tft.print("STATUS: IDLE");
    
    tft.setCursor(10, 60);
    tft.setTextColor(ST77XX_WHITE);
    tft.print("Select a song on the");
    tft.setCursor(10, 75);
    tft.print("Web App to begin!");
  } 
  else if (playback == "playing") {
    tft.setTextColor(ST77XX_GREEN);
    tft.print("NOW PLAYING:");
    drawLyrics(songId);
  }
}

void drawLyrics(int songId) {
  tft.fillRect(5, 55, tft.width()-10, tft.height()-60, ST77XX_BLACK);
  tft.setTextSize(1);
  tft.setCursor(10, 60);
  tft.setTextColor(ST77XX_CYAN);
  
  if (songId == 1) { 
    String lyrics[] = {"Oh baby baby...", "How was I supposed", "to know...", "That something wasn't", "right here!"};
    tft.print(lyrics[lyricIndex % 5]);
  } 
  else if (songId == 2) { 
    String lyrics[] = {"I'm on the highway...", "to hell!", "No stop signs...", "Speed limit!"};
    tft.print(lyrics[lyricIndex % 4]);
  } 
  else { 
    String lyrics[] = {"La la la...", "Singing to the music", "Having a good time!", "Oh yeah!"};
    tft.print(lyrics[lyricIndex % 4]);
  }
  
  lyricIndex++;
}


// ==========================================
// OTHER FUNCTIONS
// ==========================================

void readLightingState() {
  if (Firebase.RTDB.getString(&fbdo, "/diorama/ktv/lightMode")) {
    String mode = fbdo.stringData();
    
    if (mode == "off") {
      digitalWrite(LED_R_PIN, LOW);
      digitalWrite(LED_G_PIN, LOW);
      digitalWrite(LED_B_PIN, LOW);
    } else if (mode == "static") {
      bool r = false, g = false, b = false;
      if (Firebase.RTDB.getBool(&fbdo, "/diorama/ktv/light/r")) r = fbdo.boolData();
      if (Firebase.RTDB.getBool(&fbdo, "/diorama/ktv/light/g")) g = fbdo.boolData();
      if (Firebase.RTDB.getBool(&fbdo, "/diorama/ktv/light/b")) b = fbdo.boolData();
      
      digitalWrite(LED_R_PIN, r ? HIGH : LOW);
      digitalWrite(LED_G_PIN, g ? HIGH : LOW);
      digitalWrite(LED_B_PIN, b ? HIGH : LOW);
    } else if (mode == "party") {
      digitalWrite(LED_R_PIN, HIGH); digitalWrite(LED_G_PIN, LOW); digitalWrite(LED_B_PIN, LOW);
      delay(100);
      digitalWrite(LED_R_PIN, LOW); digitalWrite(LED_G_PIN, HIGH); digitalWrite(LED_B_PIN, LOW);
      delay(100);
      digitalWrite(LED_R_PIN, LOW); digitalWrite(LED_G_PIN, LOW); digitalWrite(LED_B_PIN, HIGH);
      delay(100);
    }
  }
}

void readEventState() {
  if (Firebase.RTDB.getBool(&fbdo, "/diorama/event/hallLight")) {
    digitalWrite(EVENT_HALL_RLY_PIN, fbdo.boolData() ? HIGH : LOW);
  }
  
  bool reactive = false;
  if (Firebase.RTDB.getBool(&fbdo, "/diorama/event/mode")) eventModeOn = fbdo.boolData();
  if (Firebase.RTDB.getBool(&fbdo, "/diorama/event/reactive")) reactive = fbdo.boolData();
  
  if (eventModeOn && reactive) {
    int soundLevel = 0;
    if (Firebase.RTDB.getInt(&fbdo, "/diorama/event/soundLevel")) soundLevel = fbdo.intData();
    digitalWrite(STAGE_SPOT_RLY_PIN, soundLevel > 50 ? HIGH : LOW); 
  } else {
    if (Firebase.RTDB.getBool(&fbdo, "/diorama/event/stageLight")) {
      digitalWrite(STAGE_SPOT_RLY_PIN, fbdo.boolData() ? HIGH : LOW);
    }
  }
}

void readPoolState() {
  if (Firebase.RTDB.getBool(&fbdo, "/diorama/pool/pump")) {
    poolPumpOn = fbdo.boolData();
    digitalWrite(POOL_PUMP_RLY_PIN, poolPumpOn ? HIGH : LOW);
  }
}
