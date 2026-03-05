let serial;
let portName = "COM5";

// Variables Arduino - Tank 2 (JSON index 1)
let distG = 0, distD = 0, pressure = 0, directionSwitch = 0, encoder = 0;
let prevEncoder = 0; // Previous encoder value for Tank 2

// Variables Arduino - Tank 1 (JSON index 0)
let distG1 = 0, distD1 = 0, pressure1 = 0, directionSwitch1 = 0, encoder1 = 0;
let prevEncoder1 = 0; // Previous encoder value for Tank 1

// Variables de position et angles - Tank 2
let x, y;
let angleChar = 0;    // Rotation du châssis
let angleTourelle = 0; // Rotation du canon (via encodeur)
let lives2 = 3;       // Vies Tank 2

// Variables de position et angles - Tank 1
let x1, y1;
let angleChar1 = 0;    // Rotation du châssis
let angleTourelle1 = 0; // Rotation du canon (via encodeur)
let lives1 = 3;       // Vies Tank 1

let bullets = [];
const SEUIL_MUNITION = 300; // Si pressure < 300, pas de tir

// Wall system
let walls = [];

function setup() {
  createCanvas(windowWidth, windowHeight);
  x = width / 1.1;
  y = height / 1.2;
  x1 = width / 5.5;
  y1 = height / 5;

  // Initialize walls
  initializeWalls();

  serial = new p5.SerialPort();
  serial.on("data", serialEvent);
  serial.on("open", () => console.log("Arduino connecté"));
  serial.open(portName);
}

function serialEvent() {
  let data = serial.readLine();
  if (data.length > 0) {
    try {
      // Parse JSON data from ArduinoJSON library
      let jsonData = JSON.parse(data);
      
      
      
      // Check if tanks array exists and has at least 2 tanks
      if (jsonData.tanks && jsonData.tanks.length >= 2) {
        // Tank 1 (JSON index 0)
        let tank1 = jsonData.tanks[0];
        
        if (tank1.distG !== undefined) distG1 = float(tank1.distG);
        if (tank1.distD !== undefined) distD1 = float(tank1.distD);
        if (tank1.pressure !== undefined) pressure1 = int(tank1.pressure);
        if (tank1.directionSwitch !== undefined) directionSwitch1 = int(tank1.directionSwitch);
        if (tank1.angleEncoder !== undefined) encoder1 = int(tank1.angleEncoder);
        
        if (tank1.shootButton !== undefined && tank1.shootButton === 1) {
          fire1();
        }
        
        // Tank 2 (JSON index 1)
        let tank = jsonData.tanks[1]; // Use the second tank (index 1)
        
        
        // Extract values from the second tank
        if (tank.distG !== undefined) distG = float(tank.distG);   // Ultrason 1 -> Chenille Gauche
        if (tank.distD !== undefined) distD = float(tank.distD);   // Ultrason 2 -> Chenille Droite
        if (tank.pressure !== undefined) pressure = int(tank.pressure);  // Force -> Munitions
        if (tank.directionSwitch !== undefined) directionSwitch = int(tank.directionSwitch);// Direction Switch -> Avant/Arrière
        if (tank.angleEncoder !== undefined) encoder = int(tank.angleEncoder);   // Angle Encoder -> Tourelle
        
        // Handle shoot button (trigger fire function if button pressed)
        if (tank.shootButton !== undefined && tank.shootButton === 1) {
          fire();
        }
        
        
      } else {
        console.warn("Expected tanks array with at least 2 tanks, but received:", jsonData);
      }
      
    } catch (error) {
      console.error("Error parsing JSON:", error);
      console.log("Raw data received:", data);
    }
  }
}

function draw() {
  background(50, 60, 50);

  // Draw walls around the screen edges
  stroke(150, 100, 50);
  strokeWeight(8);
  noFill();
  rect(4, 4, width - 8, height - 8);

  // 1. --- LOGIQUE DE MOUVEMENT TANK 1 (CHÂSSIS) ---
  
  let vitesseLineaire1 = 0; // Default value
    let tankSize = 40;
  
  if (lives1 > 0) {
    // Calcul de la puissance de chaque chenille pour Tank 1
    let pG1 = distG1; 
    let pD1 = distD1;

    // Rotation du châssis Tank 1
    let rotationVitesse1 = (pG1 - pD1) * 0.0075;
    angleChar1 += rotationVitesse1;

    // Avancement Tank 1
    let puissanceAvance1 = (pG1 + pD1) / 5.5;
    let multiplicateurDirection1 = (directionSwitch1 === 1) ? 1 : -1;
    vitesseLineaire1 = puissanceAvance1 * multiplicateurDirection1;

    // Mise à jour de la position Tank 1 with wall collision
    let newX1 = x1 + cos(angleChar1) * vitesseLineaire1;
    let newY1 = y1 + sin(angleChar1) * vitesseLineaire1;
    
    // Keep tank 1 within screen bounds
    newX1 = constrain(newX1, tankSize, width - tankSize);
    newY1 = constrain(newY1, tankSize, height - tankSize);
    
    // Check wall collisions before moving
    if (!checkTankWallCollision(newX1, newY1, tankSize)) {
      x1 = newX1;
      y1 = newY1;
    }

    // Logique tourelle Tank 1 - Fixed increment rotation based on encoder direction
    if (encoder1 !== prevEncoder1) {
      if (encoder1 > prevEncoder1) {
        angleTourelle1 += 15 * (PI / 180); // Rotate 1 degree clockwise
      } else {
        angleTourelle1 -= 15 * (PI / 180); // Rotate 1 degree counter-clockwise
      }
      prevEncoder1 = encoder1;
    }
  }

  // 2. --- LOGIQUE DE MOUVEMENT TANK 2 (CHÂSSIS) ---
  
  let vitesseLineaire = 0; // Default value
  
  if (lives2 > 0) {
    // Calcul de la puissance de chaque chenille (Inversé : plus la main est proche, plus c'est fort)
    // On considère qu'au delà de 25cm, il n'y a pas de main
    let pG = map(distG, 2, 25, 2, 0, true); 
    let pD = map(distD, 2, 25, 2, 0, true);

    // Rotation du châssis : la différence entre gauche et droite
    let rotationVitesse = (pG - pD) * 0.02;
    angleChar += rotationVitesse;

    // Avancement : basé sur la puissance minimale des deux mains pour garantir que les deux sont là
    let puissanceAvance = (pG + pD) / 2;
    
    // Application du Switch (1 avance, 0 recule)
    let multiplicateurDirection = (directionSwitch === 1) ? 1 : -1;
    
    vitesseLineaire = puissanceAvance * multiplicateurDirection;

    // Mise à jour de la position with wall collision
    let newX = x + cos(angleChar) * vitesseLineaire;
    let newY = y + sin(angleChar) * vitesseLineaire;
    
    // Keep tank within screen bounds (walls at screen edges)
    newX = constrain(newX, tankSize, width - tankSize);
    newY = constrain(newY, tankSize, height - tankSize);
    
    // Check wall collisions before moving
    if (!checkTankWallCollision(newX, newY, tankSize)) {
      x = newX;
      y = newY;
    }

    // 3. --- LOGIQUE TOURELLE TANK 2 - Fixed increment rotation based on encoder direction ---
    if (encoder !== prevEncoder) {
      if (encoder > prevEncoder) {
        angleTourelle += 15 * (PI / 180); // Rotate 1 degree clockwise
      } else {
        angleTourelle -= 15 * (PI / 180); // Rotate 1 degree counter-clockwise
      }
      prevEncoder = encoder;
    }
  }

  // 4. --- DESSIN DES MURS ---
  drawWalls();
  
  // 5. --- DESSIN DES TANKS ---
  
  // DESSIN TANK 1 (Blue tank) - Only if alive
  if (lives1 > 0) {
    push();
      translate(x1, y1);
      rotate(angleChar1);
      
      // CORPS (Châssis) - Blue color scheme
      rectMode(CENTER);
      fill(60, 70, 90); // Blue tint
      stroke(0);
      strokeWeight(2);
      rect(0, 0, 80, 50);
    
    // Chenilles
    fill(20);
    rect(0, -30, 85, 12); 
    rect(0, 30, 85, 12);

    // TOURELLE (Indépendante)
    push();
      rotate(angleTourelle1);
      
      // Base de la tourelle
      fill(80, 90, 110); // Blue tint
      ellipse(0, 0, 40, 40);
      
      // Canon
      fill(40, 50, 70); // Blue tint
      rect(25, 0, 50, 12);
      
      // Voyant Munitions
      if (pressure1 > SEUIL_MUNITION) fill(0, 255, 0); else fill(255, 0, 0);
      noStroke();
      ellipse(0, 0, 10, 10);
    pop();
  pop();
  } // End Tank 1 alive check
  
  // DESSIN TANK 2 (Green tank) - Only if alive
  if (lives2 > 0) {
    push();
      translate(x, y);
      rotate(angleChar); // On tourne le châssis
      
      // CORPS (Châssis) - Original green color
    rectMode(CENTER);
    fill(70, 80, 60);
    stroke(0);
    strokeWeight(2);
    rect(0, 0, 80, 50); // Base
    
    // Chenilles
    fill(20);
    rect(0, -30, 85, 12); 
    rect(0, 30, 85, 12);

    // TOURELLE (Indépendante)
    push();
      rotate(angleTourelle); // Rotation locale de la tourelle
      
      // Base de la tourelle
      fill(90, 100, 80);
      ellipse(0, 0, 40, 40);
      
      // Canon
      fill(50, 60, 40);
      rect(25, 0, 50, 12); // Sort vers la droite (0 radian)
      
      // Voyant Munitions
      if (pressure > SEUIL_MUNITION) fill(0, 255, 0); else fill(255, 0, 0);
      noStroke();
      ellipse(0, 0, 10, 10);
    pop();
  pop();
  } // End Tank 2 alive check

  // 6. --- SYSTÈME DE TIR ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    
    // Check if bullet has expired (2 seconds = 2000ms)
    if (millis() - bullets[i].creationTime > 2000) {
      bullets.splice(i, 1);
      continue;
    }
    
    // Check wall collision for bullets
    if (checkBulletWallCollision(bullets[i])) {
      bullets.splice(i, 1);
      continue;
    }
    
    // Check collision with tanks
    let hit = false;
    
    // Check collision with Tank 1 (only if Tank 1 is alive and bullet is from Tank 2)
    if (lives1 > 0 && bullets[i].owner === 2) {
      let d1 = dist(bullets[i].pos.x, bullets[i].pos.y, x1, y1);
      if (d1 < 40) { // Tank collision radius
        lives1--;
        hit = true;
        console.log("Tank 1 hit! Lives remaining: " + lives1);
      }
    }
    
    // Check collision with Tank 2 (only if Tank 2 is alive and bullet is from Tank 1)
    if (lives2 > 0 && bullets[i].owner === 1) {
      let d2 = dist(bullets[i].pos.x, bullets[i].pos.y, x, y);
      if (d2 < 40) { // Tank collision radius
        lives2--;
        hit = true;
        console.log("Tank 2 hit! Lives remaining: " + lives2);
      }
    }
    
    // Remove bullet if it hit something or went offscreen
    if (hit || bullets[i].offscreen()) {
      bullets.splice(i, 1);
    } else {
      bullets[i].show();
    }
  }

  drawUI(vitesseLineaire, vitesseLineaire1);
}

function fire1() {
  if (pressure1 > SEUIL_MUNITION && lives1 > 0 && bullets.length < 3) {
    // La balle doit partir avec l'angle cumulé (Châssis + Tourelle) pour Tank 1
    bullets.push(new Bullet(x1, y1, angleChar1 + angleTourelle1, 1));
    console.log("Tank 1 fired! Active projectiles: " + bullets.length);
  }
}

// Pour tirer, on utilise le clic de souris (qui simulera le bouton de l'encodeur)
function mousePressed() {
  fire();
}

function fire() {
  if (pressure > SEUIL_MUNITION && lives2 > 0 && bullets.length < 3) {
    // La balle doit partir avec l'angle cumulé (Châssis + Tourelle)
    bullets.push(new Bullet(x, y, angleChar + angleTourelle, 2));
    console.log("Tank 2 fired! Active projectiles: " + bullets.length);
  }
}

function drawUI(v, v1) {
  fill(255);
  noStroke();
  textSize(14);
  
  // Tank 1 (Blue) info
  text("TANK 1 (BLUE):", 20, 25);
  text("Lives: " + lives1, 20, 45);
  text("Direction: " + (directionSwitch1 === 1 ? "AVANT" : "ARRIÈRE"), 20, 65);
  text("Vitesse: " + nf(v1, 1, 2), 20, 85);
  text("Munitions: " + pressure1, 20, 105);
  if (pressure1 < SEUIL_MUNITION) {
    fill(255, 50, 50);
    text("PRESSION INSUFFISANTE", 20, 125);
    fill(255);
  }
  if (lives1 <= 0) {
    fill(255, 0, 0);
    text("TANK 1 DESTROYED!", 20, 145);
    fill(255);
  }
  
  // Tank 2 (Green) info
  text("TANK 2 (GREEN):", 20, 175);
  text("Lives: " + lives2, 20, 195);
  text("Direction: " + (directionSwitch === 1 ? "AVANT" : "ARRIÈRE"), 20, 215);
  text("Vitesse: " + nf(v, 1, 2), 20, 235);
  text("Munitions: " + pressure, 20, 255);
  if (pressure < SEUIL_MUNITION) {
    fill(255, 50, 50);
    text("PRESSION INSUFFISANTE", 20, 275);
    fill(255);
  }
  if (lives2 <= 0) {
    fill(255, 0, 0);
    text("TANK 2 DESTROYED!", 20, 295);
    fill(255);
  }
  
  // Global projectile info
  text("ACTIVE PROJECTILES: " + bullets.length + "/3", 20, 325);
  if (bullets.length >= 3) {
    fill(255, 200, 0);
    text("MAX PROJECTILES ACTIVE!", 20, 345);
    fill(255);
  }
}

// Wall initialization function
function initializeWalls() {
  walls = [];
  
  // Horizontal walls
  walls.push({x: width * 0.3, y: height * 0.3, w: width * 0.4, h: 20});
  walls.push({x: width * 0.1, y: height * 0.7, w: width * 0.3, h: 20});
  walls.push({x: width * 0.6, y: height * 0.8, w: width * 0.3, h: 20});
  
  // Vertical walls
  walls.push({x: width * 0.2, y: height * 0.1, w: 20, h: height * 0.15});
  walls.push({x: width * 0.8, y: height * 0.4, w: 20, h: height * 0.3});
  walls.push({x: width * 0.5, y: height * 0.5, w: 20, h: height * 0.25});
  
  // Corner walls for more interesting layout
  walls.push({x: width * 0.05, y: height * 0.05, w: 80, h: 80});
  walls.push({x: width * 0.85, y: height * 0.05, w: 80, h: 80});
}

// Draw all walls
function drawWalls() {
  fill(100, 70, 40);
  stroke(80, 50, 20);
  strokeWeight(2);
  
  for (let wall of walls) {
    rect(wall.x, wall.y, wall.w, wall.h);
  }
}

// Check if tank collides with any wall
function checkTankWallCollision(tankX, tankY, tankSize) {
  for (let wall of walls) {
    // Check if tank (circular) intersects with wall (rectangular)
    let closestX = constrain(tankX, wall.x, wall.x + wall.w);
    let closestY = constrain(tankY, wall.y, wall.y + wall.h);
    
    let distance = dist(tankX, tankY, closestX, closestY);
    
    if (distance < tankSize / 2) {
      return true; // Collision detected
    }
  }
  return false; // No collision
}

// Check if bullet collides with any wall
function checkBulletWallCollision(bullet) {
  for (let wall of walls) {
    if (bullet.pos.x >= wall.x && bullet.pos.x <= wall.x + wall.w &&
        bullet.pos.y >= wall.y && bullet.pos.y <= wall.y + wall.h) {
      return true; // Collision detected
    }
  }
  return false; // No collision
}

class Bullet {
  constructor(x, y, a, owner) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.fromAngle(a);
    this.vel.mult(7);
    this.owner = owner; // 1 for Tank 1, 2 for Tank 2
    this.creationTime = millis(); // Time when bullet was created
  }
  update() { this.pos.add(this.vel); }
  show() {
    // Different colors for different tank bullets
    if (this.owner === 1) {
      fill(100, 150, 255); // Blue bullets for Tank 1
    } else {
      fill(255, 255, 0); // Yellow bullets for Tank 2
    }
    noStroke();
    ellipse(this.pos.x, this.pos.y, 10, 10);
  }
  offscreen() {
    return (this.pos.x < 0 || this.pos.x > width || this.pos.y < 0 || this.pos.y > height);
  }
}