#include <Adafruit_NeoPixel.h>
#include <Arduino_JSON.h> // <--- La bibliothèque officielle Arduino_JSON

// --- TANK 1 PINS ---
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

// --- TANK 2 PINS (Tes nouvelles pins) ---
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

volatile int counter1 = 0;
volatile int counter2 = 0;
volatile int lastCLK1;
volatile int lastCLK2;

void setup() {
  Serial.begin(9600);
  
  // Configuration Tank 1
  pinMode(T1_TRIG_G, OUTPUT); pinMode(T1_ECHO_G, INPUT);
  pinMode(T1_TRIG_D, OUTPUT); pinMode(T1_ECHO_D, INPUT);
  pinMode(T1_SW_DIR, INPUT_PULLUP);
  pinMode(T1_ENC_CLK, INPUT); pinMode(T1_ENC_DT, INPUT);
  pinMode(T1_BTN_FIR, INPUT_PULLUP);

  // Configuration Tank 2
  pinMode(T2_TRIG_G, OUTPUT); pinMode(T2_ECHO_G, INPUT);
  pinMode(T2_TRIG_D, OUTPUT); pinMode(T2_ECHO_D, INPUT);
  pinMode(T2_SW_DIR, INPUT_PULLUP);
  pinMode(T2_ENC_CLK, INPUT); pinMode(T2_ENC_DT, INPUT);
  pinMode(T2_BTN_FIR, INPUT_PULLUP);

  // Interruptions
  lastCLK1 = digitalRead(T1_ENC_CLK);
  lastCLK2 = digitalRead(T2_ENC_CLK);
  attachInterrupt(digitalPinToInterrupt(T1_ENC_CLK), updateEnc1, CHANGE);
  attachInterrupt(digitalPinToInterrupt(T2_ENC_CLK), updateEnc2, CHANGE);
}

float getDist(int trig, int echo) {
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long duration = pulseIn(echo, HIGH, 25000); // Timeout court pour fluidité
  if (duration == 0) return 999;
  int dist = duration * 0.034 / 2;
  return map(dist, 0, 30, 0, 10);
}

void loop() {
  // Création de l'objet JSON racine
  JSONVar root;
  
  // Création du tableau "tanks"
  JSONVar tanks;

  // --- DONNÉES TANK 1 ---
  JSONVar tank1;
  tank1["distG"] = getDist(T1_TRIG_G, T1_ECHO_G);
  tank1["distD"] = getDist(T1_TRIG_D, T1_ECHO_D);
  tank1["pressure"] = (map(analogRead(T1_PRESS),1023,0,5,1020));
  tank1["directionSwitch"] = (int)!digitalRead(T1_SW_DIR);
  tank1["angleEncoder"] = counter1;
  tank1["shootButton"] = (int)!digitalRead(T1_BTN_FIR);
  
  tanks[0] = tank1; // Ajout au tableau

  delay(10); // Pause entre les deux lectures ultrasons

  // --- DONNÉES TANK 2 ---
  JSONVar tank2;
  tank2["distG"] = getDist(T2_TRIG_G, T2_ECHO_G);
  tank2["distD"] = getDist(T2_TRIG_D, T2_ECHO_D);
  tank2["pressure"] = (map(analogRead(T2_PRESS),1023,0,5,1020));
  tank2["directionSwitch"] = (int)!digitalRead(T2_SW_DIR);
  tank2["angleEncoder"] = counter2;
  tank2["shootButton"] = (int)!digitalRead(T2_BTN_FIR);
  
  tanks[1] = tank2; // Ajout au tableau

  // Assigner le tableau à l'objet racine
  root["tanks"] = tanks;

  // Sérialisation et envoi
  String jsonString = JSON.stringify(root);
  Serial.println(jsonString);

  delay(30); 
}

void updateEnc1() {
  if (digitalRead(T1_ENC_CLK) != digitalRead(T1_ENC_DT)) counter1++; else counter1--;
}

void updateEnc2() {
  if (digitalRead(T2_ENC_CLK) != digitalRead(T2_ENC_DT)) counter2++; else counter2--;
}