let serial;
let portName = "COM3"; 

// Variables pour multiple tanks
let tanks = [];
let bullets = [];

const SEUIL_MUNITION = 200;
const MAX_BULLETS_PER_TANK = 3;
const BULLET_LIFETIME = 10000; // 10 secondes en millisecondes 

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  serial = new p5.SerialPort();
  serial.on("data", serialEvent);
  serial.open(portName);
}

function serialEvent() {
  let data = serial.readLine();
  if (data.length > 0) {
    try {
      // Essayer de parser comme JSON pour multiple tanks
      let jsonData = JSON.parse(data);
      
      if (jsonData.tanks && Array.isArray(jsonData.tanks)) {
        // Mettre à jour ou créer les tanks
        for (let i = 0; i < jsonData.tanks.length; i++) {
          let tankData = jsonData.tanks[i];
          
          if (tanks[i]) {
            // Mettre à jour tank existant
            tanks[i].update(tankData);
          } else {
            // Créer nouveau tank
            tanks[i] = new Tank(tankData, i);
          }
        }
      }
    } catch (e) {
      // Si ce n'est pas du JSON, traiter comme données simples (compatible ancien format)
      let values = data.split(',');
      
      if (values.length >= 6) {
        let tankData = {
          distG: float(values[0]),
          distD: float(values[1]),
          pressure: int(values[2]),
          directionSwitch: int(values[3]),
          angleEncoder: int(values[4]),
          shootButton: int(values[5])
        };
        
        if (tanks[0]) {
          tanks[0].update(tankData);
        } else {
          tanks[0] = new Tank(tankData, 0);
        }
      }
    }
  }
}

function draw() {
  background(50, 60, 50);

  // Mettre à jour et dessiner tous les tanks
  for (let tank of tanks) {
    tank.move();
    tank.draw();
  }

  // Système de tir - mettre à jour toutes les balles
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    bullets[i].show();
    if (bullets[i].offscreen() || bullets[i].expired()) {
      bullets.splice(i, 1);
    }
  }

  drawUI();
}

// Pour tirer, on utilise le clic de souris (qui simulera le bouton de l'encodeur)
function mousePressed() {
  if (tanks[0]) {
    tanks[0].fire();
  }
}

function drawUI() {
  fill(255);
  noStroke();
  textSize(16);
  
  for (let i = 0; i < tanks.length; i++) {
    let tank = tanks[i];
    let yPos = 30 + i * 100;
    
    text("TANK " + (i + 1), 20, yPos);
    text("DIRECTION : " + (tank.directionSwitch === 1 ? "AVANT" : "ARRIÈRE"), 20, yPos + 20);
    text("VITESSE : " + nf(tank.vitesseLineaire, 1, 2), 20, yPos + 40);
    text("MUNITIONS : " + tank.pressure, 20, yPos + 60);
    text("BALLES : " + tank.bulletCount + "/" + MAX_BULLETS_PER_TANK, 20, yPos + 80);
    
    if (tank.pressure < SEUIL_MUNITION) {
      fill(255, 50, 50);
      text("PRESSION INSUFFISANTE", 200, yPos + 60);
      fill(255);
    }
  }
}

class Bullet {
  constructor(x, y, a, pressure, tankId) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.fromAngle(a);
    
    // Vitesse inversement proportionnelle à la pression
    // Plus la pression est faible, plus la balle va vite
    let speed = map(pressure, 0, 1023, 15, 5); // Min speed 5, max speed 15
    this.vel.mult(speed);
    
    this.tankId = tankId;
    this.creationTime = millis(); // Temps de création
  }
  
  update() { 
    this.pos.add(this.vel); 
  }
  
  show() {
    // Faire clignoter la balle quand elle approche de la fin de vie
    let age = millis() - this.creationTime;
    let alpha = 255;
    
    if (age > BULLET_LIFETIME * 0.8) { // Commencer à clignoter à 80% de la durée de vie
      alpha = map(sin(millis() * 0.02), -1, 1, 100, 255);
    }
    
    fill(255, 255, 0, alpha);
    noStroke();
    ellipse(this.pos.x, this.pos.y, 8, 8);
  }
  
  offscreen() {
    return (this.pos.x < 0 || this.pos.x > width || this.pos.y < 0 || this.pos.y > height);
  }
  
  expired() {
    return millis() - this.creationTime > BULLET_LIFETIME;
  }
}

class Tank {
  constructor(data, id) {
    this.id = id;
    this.x = width / 2 + id * 100; // Positionner les tanks côte à côte
    this.y = height / 2;
    this.angleChar = 0;
    this.angleTourelle = 0;
    this.vitesseLineaire = 0;
    this.bulletCount = 0;
    this.lastFireTime = 0; // Dernière fois qu'on a tiré
    
    // Couleurs différentes pour chaque tank
    this.colors = [
      [70, 80, 60],   // Vert
      [80, 60, 70],   // Rouge-brun
      [60, 70, 80],   // Bleu-gris
      [80, 70, 60]    // Marron
    ];
    
    this.lastShootState = 0;
    this.update(data);
  }
  
  update(data) {
    this.distG = data.distG;
    this.distD = data.distD;
    this.pressure = data.pressure;
    this.directionSwitch = data.directionSwitch;
    this.angleEncoder = data.angleEncoder;
    
    // Détection du bouton de tir
    let currentShootState = data.shootButton;
    if (currentShootState === 1 && this.lastShootState === 0) {
      this.fire();
    }
    this.lastShootState = currentShootState;
  }
  
  move() {
    // Calcul de la puissance de chaque chenille
    let pG = map(this.distG, 2, 25, 4, 0, true);
    let pD = map(this.distD, 2, 25, 4, 0, true);
    
    // Rotation du châssis
    let rotationVitesse = (pG - pD) * 0.015;
    this.angleChar += rotationVitesse;
    
    // Avancement
    let puissanceAvance = (pG + pD) / 6;
    let multiplicateurDirection = (this.directionSwitch === 1) ? 1 : -1;
    this.vitesseLineaire = puissanceAvance * multiplicateurDirection;
    
    // Mise à jour de la position
    this.x += cos(this.angleChar) * this.vitesseLineaire;
    this.y += sin(this.angleChar) * this.vitesseLineaire;
    
    // Logique tourelle
    this.angleTourelle = radians(this.angleEncoder);
  }
  
  draw() {
    push();
      translate(this.x, this.y);
      rotate(this.angleChar);
      
      // Couleur du tank selon son ID
      let color = this.colors[this.id % this.colors.length];
      
      // Corps (Châssis)
      rectMode(CENTER);
      fill(color[0], color[1], color[2]);
      stroke(0);
      strokeWeight(2);
      rect(0, 0, 80, 50);
      
      // Chenilles
      fill(20);
      rect(0, -30, 85, 12);
      rect(0, 30, 85, 12);
      
      // Tourelle
      push();
        rotate(this.angleTourelle);
        
        // Base de la tourelle
        fill(color[0] + 20, color[1] + 20, color[2] + 20);
        ellipse(0, 0, 40, 40);
        
        // Canon
        fill(color[0] - 20, color[1] - 10, color[2] - 10);
        rect(25, 0, 50, 12);
        
        // Voyant munitions
        if (this.pressure > SEUIL_MUNITION) fill(0, 255, 0);
        else fill(255, 0, 0);
        noStroke();
        ellipse(0, 0, 10, 10);
      pop();
    pop();
  }
  
  fire() {
    // Calculer le délai de tir basé sur la pression (pression faible = tir plus rapide)
    let fireDelay = map(this.pressure, 0, 1023, 200, 1000); // 200ms à 1000ms entre les tirs
    let currentTime = millis();
    
    if (this.pressure > SEUIL_MUNITION && 
        this.bulletCount < MAX_BULLETS_PER_TANK && 
        currentTime - this.lastFireTime > fireDelay) {
      
      // Créer une nouvelle balle avec vitesse basée sur la pression
      bullets.push(new Bullet(this.x, this.y, this.angleChar + this.angleTourelle, this.pressure, this.id));
      this.bulletCount++;
      this.lastFireTime = currentTime;
      
      // Nettoyer les balles hors écran de ce tank
      this.cleanupBullets();
    }
  }
  
  cleanupBullets() {
    // Compter les balles actuelles de ce tank
    this.bulletCount = 0;
    for (let bullet of bullets) {
      if (bullet.tankId === this.id) {
        this.bulletCount++;
      }
    }
  }
}