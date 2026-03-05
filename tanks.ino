#include <Adafruit_NeoPixel.h>
#include <Arduino_JSON.h>

// --- CONFIGURATION PINS ---
#define T1_TRIG_G 10
#define T1_ECHO_G 9
#define T1_TRIG_D 6
#define T1_ECHO_D 5
#define T1_PRESS  0
#define T1_SW_DIR 7
#define T1_ENC_CLK 2
#define T1_ENC_DT  3
#define T1_BTN_FIR 11
#define T1_LED_PIN 8

#define T2_TRIG_G 34
#define T2_ECHO_G 35
#define T2_TRIG_D 40
#define T2_ECHO_D 41
#define T2_PRESS  10
#define T2_SW_DIR 29
#define T2_ENC_CLK 18
#define T2_ENC_DT  19
#define T2_BTN_FIR 23
#define T2_LED_PIN 51

#define LED_COUNT 8
#define PRESS_THRESHOLD 200 

Adafruit_NeoPixel strip1(LED_COUNT, T1_LED_PIN, NEO_GRB + NEO_KHZ800);
Adafruit_NeoPixel strip2(LED_COUNT, T2_LED_PIN, NEO_GRB + NEO_KHZ800);

volatile int counter1 = 0;
volatile int counter2 = 0;

void setup() {
  Serial.begin(9600);
  
  strip1.begin(); strip1.show();
  strip2.begin(); strip2.show();

  // Tank 1 Setup
  pinMode(T1_TRIG_G, OUTPUT); pinMode(T1_ECHO_G, INPUT);
  pinMode(T1_TRIG_D, OUTPUT); pinMode(T1_ECHO_D, INPUT);
  pinMode(T1_SW_DIR, INPUT_PULLUP);
  pinMode(T1_ENC_CLK, INPUT); pinMode(T1_ENC_DT, INPUT);
  pinMode(T1_BTN_FIR, INPUT_PULLUP);

  // Tank 2 Setup
  pinMode(T2_TRIG_G, OUTPUT); pinMode(T2_ECHO_G, INPUT);
  pinMode(T2_TRIG_D, OUTPUT); pinMode(T2_ECHO_D, INPUT);
  pinMode(T2_SW_DIR, INPUT_PULLUP);
  pinMode(T2_ENC_CLK, INPUT); pinMode(T2_ENC_DT, INPUT);
  pinMode(T2_BTN_FIR, INPUT_PULLUP);

  // Interruptions prioritaires
  attachInterrupt(digitalPinToInterrupt(T1_ENC_CLK), updateEnc1, CHANGE);
  attachInterrupt(digitalPinToInterrupt(T2_ENC_CLK), updateEnc2, CHANGE);
}

// --- LOGIQUE LED SEGMENTÉE ---
void updateLEDs(Adafruit_NeoPixel &strip, int pressure, int direction) {
  // 1. ZONE CANON (LEDs 0 à 3) : Gère la pression
  uint32_t canonColor;
  if (pressure >= PRESS_THRESHOLD) {
    canonColor = strip.Color(0, 255, 0); // VERT : Prêt à tirer
  } else {
    canonColor = strip.Color(255, 0, 0); // ROUGE : Pas assez de munitions
  }
  
  for(int i = 0; i < 4; i++) {
    strip.setPixelColor(i, canonColor);
  }

  // 2. ZONE PILOTAGE (LEDs 4 à 7) : Gère la direction
  uint32_t driveColor;
  if (direction == 1) {
    driveColor = strip.Color(0, 0, 255);   // BLEU : Marche Avant
  } else {
    driveColor = strip.Color(255, 255, 0); // JAUNE : Marche Arrière
  }

  for(int i = 4; i < 8; i++) {
    strip.setPixelColor(i, driveColor);
  }

  strip.show();
}

float getDist(int trig, int echo) {
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long duration = pulseIn(echo, HIGH, 25000);
  if (duration == 0) return 0; // Max distance mappée
  int dist = duration * 0.034 / 2;
  if(dist>20)
  return 0;
else
  return map(dist, 0, 20, 5, 1);
}

void loop() {
  JSONVar root;
  JSONVar tanks;

  // --- TANK 1 ---
  int p1 = map(analogRead(T1_PRESS), 1023, 0, 5, 1020);
  int d1 = (int)!digitalRead(T1_SW_DIR);
  
  JSONVar tank1;
  tank1["distG"] = getDist(T1_TRIG_G, T1_ECHO_G);
  tank1["distD"] = getDist(T1_TRIG_D, T1_ECHO_D);
  tank1["pressure"] = p1;
  tank1["directionSwitch"] = d1;
  tank1["angleEncoder"] = counter1;
  tank1["shootButton"] = (int)!digitalRead(T1_BTN_FIR);
  tanks[0] = tank1;
  
  updateLEDs(strip1, p1, d1);

  delay(10);

  // --- TANK 2 ---
  int p2 = map(analogRead(T2_PRESS), 1023, 0, 5, 1020);
  int d2 = (int)!digitalRead(T2_SW_DIR);

  JSONVar tank2;
  tank2["distG"] = getDist(T2_TRIG_G, T2_ECHO_G);
  tank2["distD"] = getDist(T2_TRIG_D, T2_ECHO_D);
  tank2["pressure"] = p2;
  tank2["directionSwitch"] = d2;
  tank2["angleEncoder"] = counter2;
  tank2["shootButton"] = (int)!digitalRead(T2_BTN_FIR);
  tanks[1] = tank2;

  updateLEDs(strip2, p2, d2);

  root["tanks"] = tanks;
  Serial.println(JSON.stringify(root));

  delay(30); 
}

void updateEnc1() {
  if (digitalRead(T1_ENC_CLK) != digitalRead(T1_ENC_DT)) counter1++; else counter1--;
}

void updateEnc2() {
  if (digitalRead(T2_ENC_CLK) != digitalRead(T2_ENC_DT)) counter2++; else counter2--;
}