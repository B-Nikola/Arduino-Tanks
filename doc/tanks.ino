#include <Adafruit_NeoPixel.h>
#include <ArduinoJson.h>

// --- CONFIGURATION DES PINS ---
#define LED_PIN       8
#define LED_COUNT     8
#define trigPinG      10  // Ultrason Gauche
#define echoPinG      9
#define trigPinD      6   // Ultrason Droit
#define echoPinD      5
#define pressurePin   A0  // Capteur de pression (FSR)
#define switchPin     7   // Switch de direction (Marche AR/AV)
#define pin_clk       2   // Encodeur CLK (Pin Interrupt)
#define pin_dt        3   // Encodeur DT
#define button_pin    11  // Bouton de tir (sur l'encodeur)

// --- VARIABLES GLOBALES ---
Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

volatile int counter = 0;    // Position de la tourelle
volatile int lastStateCLK;
int switchState = 0;
int pressureValue = 0;
int shootButton = 0;
float distanceG = 0;
float distanceD = 0;

void setup() {
  Serial.begin(9600);   

  // Initialisation des LEDs
  strip.begin();
  strip.show(); 
  strip.setBrightness(100);

  // Configuration des pins
  pinMode(trigPinG, OUTPUT);
  pinMode(echoPinG, INPUT);
  pinMode(trigPinD, OUTPUT);
  pinMode(echoPinD, INPUT);
  pinMode(pressurePin, INPUT);
  pinMode(switchPin, INPUT_PULLUP);
  pinMode(pin_clk, INPUT);
  pinMode(pin_dt, INPUT);
  pinMode(button_pin, INPUT_PULLUP);

  // Initialisation de l'encodeur
  lastStateCLK = digitalRead(pin_clk);
  // Utilisation de l'interruption sur la pin 2 pour une lecture précise
  attachInterrupt(digitalPinToInterrupt(pin_clk), updateEncoder, CHANGE);
}

void loop() {
  // 1. --- LECTURE DES CAPTEURS ---

  // États logiques (Inversés à cause du mode PULLUP)
  switchState = !digitalRead(switchPin); 
  shootButton = !digitalRead(button_pin);
  pressureValue = analogRead(pressurePin);

  // Mesure Ultrason Gauche
  digitalWrite(trigPinG, LOW); delayMicroseconds(2);
  digitalWrite(trigPinG, HIGH); delayMicroseconds(10);
  digitalWrite(trigPinG, LOW);
  distanceG = (pulseIn(echoPinG, HIGH) * 0.034 / 2);

  delay(10); // Petit délai pour éviter les interférences entre capteurs

  // Mesure Ultrason Droit
  digitalWrite(trigPinD, LOW); delayMicroseconds(2);
  digitalWrite(trigPinD, HIGH); delayMicroseconds(10);
  digitalWrite(trigPinD, LOW);
  distanceD = (pulseIn(echoPinD, HIGH) * 0.034 / 2);

  // 2. --- CONSTRUCTION DU JSON ---
  // Taille calculée pour l'objet racine + le tableau + l'objet tank
  StaticJsonDocument<300> doc;
  
  // Création de la structure : { "tanks": [ { ... } ] }
  JsonArray tanks = doc.createNestedArray("tanks");
  JsonObject tank1 = tanks.createNestedObject();
  
  tank1["distG"] = distanceG;
  tank1["distD"] = distanceD;
  tank1["pressure"] = pressureValue;
  tank1["directionSwitch"] = switchState;
  tank1["angleEncoder"] = counter;
  tank1["shootButton"] = shootButton;

  // 3. --- ENVOI ---
  serializeJson(doc, Serial);
  Serial.println(); // Signal de fin de message pour p5.js

  // 4. --- FEEDBACK VISUEL (Facultatif) ---
  // Si assez de pression pour tirer, LEDs en vert, sinon rouge
  if (pressureValue > 300) {
    for(int i=0; i<LED_COUNT; i++) strip.setPixelColor(i, strip.Color(0, 255, 0));
  } else {
    for(int i=0; i<LED_COUNT; i++) strip.setPixelColor(i, strip.Color(255, 0, 0));
  }
  strip.show();

  delay(40); // Fréquence d'environ 25 images/seconde pour la fluidité
}

// Fonction d'interruption pour l'encodeur rotatif
void updateEncoder() {
  int currentStateCLK = digitalRead(pin_clk);
  if (currentStateCLK != lastStateCLK) {
    if (digitalRead(pin_dt) != currentStateCLK) {
      counter++;
    } else {
      counter--;
    }
  }
  lastStateCLK = currentStateCLK;
}