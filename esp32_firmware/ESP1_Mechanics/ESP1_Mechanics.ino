#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// -----------------------------------------------------
// PIN DEFINITIONS
// -----------------------------------------------------

// SERVOS
#define GATE_SERVO1_PIN 12   // MOVED FROM 14 TO 12
#define GATE_SERVO2_PIN 27
#define KTV_SERVO_PIN   13   // MOVED FROM 14 TO 13 (Clean Pin)

// RELAYS
#define PATHWAY_RELAY_PIN 33 // The relay plugged into 33

// SENSORS
#define IR_BEAM_PIN     21
#define HALL_SENSOR_PIN 34
#define MIC_PIN         35

// MOTORS (TB6612)
#define TB_AIN1_PIN     25
#define SHARED_AIN2_RLY_PIN 26
#define TB_PWMA_PIN     32

// RC522 (SPI)
#define RC522_SS_PIN    5
#define RC522_RST_PIN   22

// TACTILE BUTTONS
#define BTN_CAR_FWD_PIN 4
#define BTN_GATE_PIN    14   // MOVED FROM 13 TO 14 (Safe for buttons)
#define BTN_CAR_REV_PIN 15
#define BTN_KTV_PIN     2

// -----------------------------------------------------
// OBJECTS & GLOBALS
// -----------------------------------------------------
Servo gateServo1;
Servo gateServo2;
Servo ktvServo;
MFRC522 rfid(RC522_SS_PIN, RC522_RST_PIN);
LiquidCrystal_I2C lcd(0x27, 16, 2);

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
bool lastIrState = false;
bool lastHallState = false;
unsigned long lastSensorRead = 0;
unsigned long lastHeartbeat = 0;
int heartbeatCount = 0;

// Global States for Toggling
bool gateOpen = false;
bool ktvOpen = false;

// LCD & Guest Trackers
String lastGuestName = "";
bool lastCheckedIn = false;
unsigned long lcdMessageClearTime = 0;

// Button Trackers
bool lastGateBtn = HIGH;
bool lastCarFwdBtn = HIGH;
bool lastCarRevBtn = HIGH;
bool lastKtvBtn = HIGH;
unsigned long lastDebounceTime = 0;

void setup() {
  Serial.begin(115200);
  
  // Initialize Pins
  pinMode(IR_BEAM_PIN, INPUT_PULLUP);
  pinMode(HALL_SENSOR_PIN, INPUT_PULLUP);
  pinMode(MIC_PIN, INPUT);
  
  // Buttons
  pinMode(BTN_CAR_FWD_PIN, INPUT_PULLUP);
  pinMode(BTN_GATE_PIN, INPUT_PULLUP);
  pinMode(BTN_CAR_REV_PIN, INPUT_PULLUP);
  pinMode(BTN_KTV_PIN, INPUT_PULLUP);
  
  pinMode(TB_AIN1_PIN, OUTPUT);
  pinMode(SHARED_AIN2_RLY_PIN, OUTPUT);
  pinMode(TB_PWMA_PIN, OUTPUT);
  pinMode(PATHWAY_RELAY_PIN, OUTPUT);
  digitalWrite(PATHWAY_RELAY_PIN, HIGH); // Default OFF (active LOW)
  
  // Attach Servos
  gateServo1.attach(GATE_SERVO1_PIN);
  gateServo2.attach(GATE_SERVO2_PIN);
  ktvServo.attach(KTV_SERVO_PIN);
  
  // Initialize SPI & RC522
  SPI.begin(); 
  rfid.PCD_Init();
  
  // Initialize LCD (Custom SDA/SCL)
  Wire.begin(16, 17);
  lcd.init();
  lcd.backlight();
  displayLCD("ESP1 Starting...", "");

  // Connect WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  displayLCD("WiFi Connected!", "");
  Serial.println("\nWiFi Connected");
  
  // Firebase Setup
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  displayLCD("Connecting to", "Firebase...");
  if (Firebase.signUp(&config, &auth, "", "")) {
    signupOK = true;
    displayLCD("Firebase OK!", "");
  } else {
    displayLCD("Firebase Failed", fbdo.errorReason());
    Serial.println(config.signer.signupError.message.c_str());
    delay(3000);
  }
  
  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  if (signupOK) {
    displayLCD("System Ready", "Scan ID Card");
  }
}

unsigned long lastFirebaseRead = 0;

void loop() {
  if (Firebase.ready() && signupOK) {
    
    if (millis() - lastFirebaseRead > 1000) {
      lastFirebaseRead = millis();
      readFirebaseCommands();
    }
    
    readSensorsAndSync();
    checkNFC();
    checkPhysicalButtons();
    
    // Clear LCD message if needed
    if (lcdMessageClearTime > 0 && millis() > lcdMessageClearTime) {
      lcdMessageClearTime = 0;
      displayLCD("System Ready", "Scan ID Card");
    }
    
    // Heartbeat
    if (millis() - lastHeartbeat > 3000) {
      lastHeartbeat = millis();
      Firebase.RTDB.setInt(&fbdo, "/diorama/status/esp1/heartbeat", heartbeatCount++);
      Firebase.RTDB.setInt(&fbdo, "/diorama/status/esp1/rssi", WiFi.RSSI());
    }
  }
}

void displayLCD(String line1, String line2) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

void checkPhysicalButtons() {
  if (millis() - lastDebounceTime > 50) {
    // GATE BUTTON (Toggle)
    bool gateBtn = digitalRead(BTN_GATE_PIN);
    if (gateBtn == LOW && lastGateBtn == HIGH) {
      gateOpen = !gateOpen; // Local update
      Firebase.RTDB.setString(&fbdo, "/diorama/gate/target", gateOpen ? "open" : "closed"); 
      if (gateOpen) openGatesSlowly();
      else closeGatesSlowly();
      lastDebounceTime = millis();
    }
    lastGateBtn = gateBtn;

    // KTV BUTTON (Toggle)
    bool ktvBtn = digitalRead(BTN_KTV_PIN);
    if (ktvBtn == LOW && lastKtvBtn == HIGH) {
      ktvOpen = !ktvOpen; // Local update
      Firebase.RTDB.setString(&fbdo, "/diorama/ktv/target", ktvOpen ? "open" : "closed");
      if (ktvOpen) ktvServo.write(90);
      else ktvServo.write(0);
      lastDebounceTime = millis();
    }
    lastKtvBtn = ktvBtn;

    // CAR FORWARD BUTTON
    bool carFwdBtn = digitalRead(BTN_CAR_FWD_PIN);
    if (carFwdBtn == LOW && lastCarFwdBtn == HIGH) {
      Firebase.RTDB.setString(&fbdo, "/diorama/car/command", "forward");
      lastDebounceTime = millis();
    }
    lastCarFwdBtn = carFwdBtn;

    // CAR REVERSE BUTTON
    bool carRevBtn = digitalRead(BTN_CAR_REV_PIN);
    if (carRevBtn == LOW && lastCarRevBtn == HIGH) {
      Firebase.RTDB.setString(&fbdo, "/diorama/car/command", "backward");
      lastDebounceTime = millis();
    }
    lastCarRevBtn = carRevBtn;
    
    // STOP CAR if both buttons are released
    if (carFwdBtn == HIGH && carRevBtn == HIGH && (lastCarFwdBtn == LOW || lastCarRevBtn == LOW)) {
       Firebase.RTDB.setString(&fbdo, "/diorama/car/command", "stop");
    }
  }
}

const int GATE1_CLOSED = 30;
const int GATE1_OPEN   = 90;
const int GATE2_CLOSED = 150;
const int GATE2_OPEN   = 90;
bool isGatePhysicallyOpen = false;

void openGatesSlowly() {
  if (isGatePhysicallyOpen) return;
  for (int step = 0; step <= 60; step++) {
    gateServo1.write(GATE1_CLOSED + step);
    gateServo2.write(GATE2_CLOSED - step);
    delay(30);
  }
  isGatePhysicallyOpen = true;
}

void closeGatesSlowly() {
  if (!isGatePhysicallyOpen) return;
  for (int step = 0; step <= 60; step++) {
    gateServo1.write(GATE1_OPEN - step);
    gateServo2.write(GATE2_OPEN + step);
    delay(30);
  }
  isGatePhysicallyOpen = false;
}

void readFirebaseCommands() {
  static bool firstSync = true;

  // Always keep track of the latest guest name from Firebase
  if (Firebase.RTDB.getString(&fbdo, "/diorama/guest/name")) {
    String currentName = fbdo.stringData();
    if (currentName != "") {
      lastGuestName = currentName;
    }
  }

  // Read Guest Details for LCD check-in animation from webapp
  if (Firebase.RTDB.getBool(&fbdo, "/diorama/guest/checkedIn")) {
    bool checkedIn = fbdo.boolData();
    
    // Always sync the relay to the check-in state (Active LOW)
    digitalWrite(PATHWAY_RELAY_PIN, checkedIn ? LOW : HIGH);
    
    if (checkedIn && !lastCheckedIn && !firstSync) {
      displayLCD("WELCOME!", lastGuestName != "" ? lastGuestName : "VIP Guest");
      lcdMessageClearTime = millis() + 5000;
    }
    lastCheckedIn = checkedIn;
  }

  // Gate Target
  if (Firebase.RTDB.getString(&fbdo, "/diorama/gate/target")) {
    gateOpen = (fbdo.stringData() == "open");
    Firebase.RTDB.setString(&fbdo, "/diorama/gate/state", gateOpen ? "open" : "closed");
  }
  
  // KTV Target
  if (Firebase.RTDB.getString(&fbdo, "/diorama/ktv/target")) {
    ktvOpen = (fbdo.stringData() == "open");
  }
  
  // Gate Servo Logic (Slow Sweep)
  if (gateOpen) {
    if (!isGatePhysicallyOpen) {
      openGatesSlowly();
    }
  } else {
    if (isGatePhysicallyOpen) {
      closeGatesSlowly();
    }
  }
  
  // Independent KTV Door Servo Logic (Snaps to 90 degrees)
  if (ktvOpen) {
    ktvServo.write(90);
  } else {
    ktvServo.write(0);
  }
  
  // Car Command
  if (Firebase.RTDB.getString(&fbdo, "/diorama/car/command")) {
    String carCmd = fbdo.stringData();
    int speed = 255;
    if (Firebase.RTDB.getInt(&fbdo, "/diorama/car/speed")) speed = fbdo.intData();
    
    if (carCmd == "forward") {
      digitalWrite(TB_AIN1_PIN, HIGH);
      digitalWrite(SHARED_AIN2_RLY_PIN, LOW); 
      analogWrite(TB_PWMA_PIN, speed);
      Firebase.RTDB.setString(&fbdo, "/diorama/car/state", "moving forward");
      
    } else if (carCmd == "backward") {
      digitalWrite(TB_AIN1_PIN, LOW);
      digitalWrite(SHARED_AIN2_RLY_PIN, HIGH); 
      analogWrite(TB_PWMA_PIN, speed);
      Firebase.RTDB.setString(&fbdo, "/diorama/car/state", "moving backward");
      
    } else {
      digitalWrite(TB_AIN1_PIN, LOW);
      digitalWrite(SHARED_AIN2_RLY_PIN, LOW); 
      analogWrite(TB_PWMA_PIN, 0);
      Firebase.RTDB.setString(&fbdo, "/diorama/car/state", "stopped");
    }
  }

  if (firstSync) firstSync = false;
}

void readSensorsAndSync() {
  if (millis() - lastSensorRead > 200) {
    lastSensorRead = millis();
    
    // TRUE BREAK-BEAM SENSORS output HIGH when the beam is broken/blocked!
    // Obstacle sensors output LOW. We use HIGH here for a break beam.
    bool irBlocked = digitalRead(IR_BEAM_PIN) == HIGH; 
    
    if (irBlocked != lastIrState) {
      Firebase.RTDB.setBool(&fbdo, "/diorama/gate/irBlocked", irBlocked);
      
      // AUTO-OPEN GATE IF IR DETECTS SOMETHING
      if (irBlocked) {
        Serial.println("IR BEAM BLOCKED - OPENING GATE!");
        Firebase.RTDB.setString(&fbdo, "/diorama/gate/target", "open");
        gateOpen = true; // Update locally for instant feel
        openGatesSlowly();
      } else {
        Serial.println("IR BEAM RESTORED");
      }
      
      lastIrState = irBlocked;
    }
    
    bool hallOpen = digitalRead(HALL_SENSOR_PIN) == LOW; 
    if (hallOpen != lastHallState) {
      Firebase.RTDB.setBool(&fbdo, "/diorama/ktv/hallOpen", hallOpen);
      lastHallState = hallOpen;
    }
    
    int micVal = analogRead(MIC_PIN);
    int soundLevel = map(micVal, 0, 4095, 0, 100); 
    Firebase.RTDB.setInt(&fbdo, "/diorama/event/soundLevel", soundLevel);
  }
}

void checkNFC() {
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uidString = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      uidString += String(rfid.uid.uidByte[i], HEX);
    }
    uidString.toUpperCase();
    
    // Tell Firebase the card was scanned
    Firebase.RTDB.setString(&fbdo, "/diorama/nfc/lastUid", uidString);
    Firebase.RTDB.setInt(&fbdo, "/diorama/nfc/lastScan", millis()); 
    
    // INSTANT BYPASS: Don't wait for web app! 
    // Show Welcome Message immediately with whatever name is loaded in memory
    displayLCD("WELCOME!", lastGuestName != "" ? lastGuestName : "VIP Guest");
    lcdMessageClearTime = millis() + 5000;
    
    // Instantly Open Gate!
    Firebase.RTDB.setString(&fbdo, "/diorama/gate/target", "open");
    gateOpen = true;
    openGatesSlowly();
    
    // Tell Firebase they are checked in!
    Firebase.RTDB.setBool(&fbdo, "/diorama/guest/checkedIn", true);
    
    rfid.PICC_HaltA();
    delay(1000); 
  }
}
