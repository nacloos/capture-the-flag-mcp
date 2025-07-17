// Game variables
let bees = [];
let flies = [];
let honeyDrops = [];
let particles = [];
let score = 0;
let lives = 3;
let level = 1;
let gameState = 'playing'; // 'playing', 'gameOver', 'levelComplete'
let flySpawnTimer = 0;
let flySpawnRate = 120; // frames between spawns
let powerUps = [];

// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const BEE_SIZE = 30;
const FLY_SIZE = 25;
const HONEY_SIZE = 8;
const BEE_SPEED = 4;
const FLY_SPEED = 2;
const HONEY_SPEED = 6;

// Controls
let keys = {};

function setup() {
    let canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
    canvas.parent('gameCanvas');
    
    // Create initial bees
    for (let i = 0; i < 3; i++) {
        bees.push(new Bee(100 + i * 50, height / 2));
    }
    
    // Spawn initial flies
    spawnFlies(5);
}

function draw() {
    // Sky blue background
    background(135, 206, 235);
    
    // Draw clouds
    drawClouds();
    
    if (gameState === 'playing') {
        updateGame();
        drawGame();
    } else if (gameState === 'gameOver') {
        drawGameOver();
    } else if (gameState === 'levelComplete') {
        drawLevelComplete();
    }
    
    // Draw UI
    drawUI();
}

function updateGame() {
    // Update bees
    for (let i = bees.length - 1; i >= 0; i--) {
        bees[i].update();
        if (bees[i].health <= 0) {
            createDeathParticles(bees[i].x, bees[i].y, color(255, 215, 0));
            bees.splice(i, 1);
            lives--;
        }
    }
    
    // Update flies
    for (let i = flies.length - 1; i >= 0; i--) {
        flies[i].update();
        if (flies[i].health <= 0) {
            createDeathParticles(flies[i].x, flies[i].y, color(100, 50, 0));
            flies.splice(i, 1);
            score += 10;
        }
    }
    
    // Update honey drops
    for (let i = honeyDrops.length - 1; i >= 0; i--) {
        honeyDrops[i].update();
        if (honeyDrops[i].x > width || honeyDrops[i].y < 0 || honeyDrops[i].y > height) {
            honeyDrops.splice(i, 1);
        }
    }
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }
    
    // Update power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].update();
        if (powerUps[i].collected || powerUps[i].timer <= 0) {
            powerUps.splice(i, 1);
        }
    }
    
    // Check collisions
    checkCollisions();
    
    // Spawn flies
    flySpawnTimer++;
    if (flySpawnTimer >= flySpawnRate) {
        spawnFlies(1);
        flySpawnTimer = 0;
        flySpawnRate = max(60, flySpawnRate - 1); // Increase spawn rate
    }
    
    // Check game over
    if (bees.length === 0) {
        gameState = 'gameOver';
    }
    
    // Check level complete
    if (score >= level * 100) {
        gameState = 'levelComplete';
    }
}

function drawGame() {
    // Draw bees
    for (let bee of bees) {
        bee.draw();
    }
    
    // Draw flies
    for (let fly of flies) {
        fly.draw();
    }
    
    // Draw honey drops
    for (let drop of honeyDrops) {
        drop.draw();
    }
    
    // Draw particles
    for (let particle of particles) {
        particle.draw();
    }
    
    // Draw power-ups
    for (let powerUp of powerUps) {
        powerUp.draw();
    }
}

function drawUI() {
    // Score
    fill(255);
    stroke(0);
    strokeWeight(2);
    textAlign(LEFT);
    textSize(20);
    text(`Score: ${score}`, 20, 30);
    
    // Lives
    text(`Lives: ${lives}`, 20, 55);
    
    // Level
    text(`Level: ${level}`, 20, 80);
    
    // Instructions
    textAlign(CENTER);
    textSize(14);
    text("WASD/Arrow Keys: Move | Space: Shoot | R: Restart", width/2, height - 10);
}

function drawClouds() {
    fill(255, 255, 255, 100);
    noStroke();
    
    // Simple cloud shapes
    for (let i = 0; i < 5; i++) {
        let x = (frameCount * 0.5 + i * 150) % (width + 100) - 50;
        let y = 50 + i * 30;
        ellipse(x, y, 60, 40);
        ellipse(x + 30, y, 80, 50);
        ellipse(x + 60, y, 60, 40);
    }
}

function drawGameOver() {
    fill(0, 0, 0, 150);
    rect(0, 0, width, height);
    
    fill(255, 0, 0);
    textAlign(CENTER);
    textSize(48);
    text("GAME OVER", width/2, height/2 - 50);
    
    fill(255);
    textSize(24);
    text(`Final Score: ${score}`, width/2, height/2);
    text("Press R to restart", width/2, height/2 + 50);
}

function drawLevelComplete() {
    fill(0, 0, 0, 150);
    rect(0, 0, width, height);
    
    fill(255, 215, 0);
    textAlign(CENTER);
    textSize(48);
    text("LEVEL COMPLETE!", width/2, height/2 - 50);
    
    fill(255);
    textSize(24);
    text(`Score: ${score}`, width/2, height/2);
    text("Press SPACE to continue", width/2, height/2 + 50);
}

class Bee {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.health = 3;
        this.maxHealth = 3;
        this.shootCooldown = 0;
        this.size = BEE_SIZE;
        this.wingOffset = 0;
    }
    
    update() {
        // Movement
        if (keys['w'] || keys['ArrowUp']) this.y -= BEE_SPEED;
        if (keys['s'] || keys['ArrowDown']) this.y += BEE_SPEED;
        if (keys['a'] || keys['ArrowLeft']) this.x -= BEE_SPEED;
        if (keys['d'] || keys['ArrowRight']) this.x += BEE_SPEED;
        
        // Keep bee in bounds
        this.x = constrain(this.x, this.size/2, width - this.size/2);
        this.y = constrain(this.y, this.size/2, height - this.size/2);
        
        // Shooting
        if (this.shootCooldown > 0) {
            this.shootCooldown--;
        }
        
        if (keys[' '] && this.shootCooldown === 0) {
            honeyDrops.push(new HoneyDrop(this.x + this.size/2, this.y));
            this.shootCooldown = 20;
        }
        
        // Wing animation
        this.wingOffset += 0.3;
    }
    
    draw() {
        push();
        translate(this.x, this.y);
        
        // Wings
        fill(200, 200, 255, 100);
        stroke(150, 150, 255);
        strokeWeight(1);
        
        // Wing flapping animation
        let wingFlap = sin(this.wingOffset) * 5;
        ellipse(-8, -8 + wingFlap, 15, 8);
        ellipse(8, -8 + wingFlap, 15, 8);
        
        // Body
        fill(255, 215, 0);
        stroke(0);
        strokeWeight(2);
        ellipse(0, 0, this.size, this.size * 0.8);
        
        // Stripes
        stroke(0);
        strokeWeight(3);
        for (let i = -8; i <= 8; i += 6) {
            line(i, -10, i, 10);
        }
        
        // Eyes
        fill(0);
        ellipse(-6, -8, 4, 4);
        ellipse(6, -8, 4, 4);
        
        // Smile
        noFill();
        stroke(0);
        strokeWeight(2);
        arc(0, -2, 12, 8, 0, PI);
        
        pop();
        
        // Health bar
        this.drawHealthBar();
    }
    
    drawHealthBar() {
        let barWidth = 40;
        let barHeight = 6;
        let barX = this.x - barWidth/2;
        let barY = this.y - this.size/2 - 15;
        
        // Background
        fill(255, 0, 0);
        noStroke();
        rect(barX, barY, barWidth, barHeight);
        
        // Health
        fill(0, 255, 0);
        rect(barX, barY, (this.health / this.maxHealth) * barWidth, barHeight);
        
        // Border
        noFill();
        stroke(0);
        strokeWeight(1);
        rect(barX, barY, barWidth, barHeight);
    }
}

class Fly {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.health = 1;
        this.vx = random(-FLY_SPEED, FLY_SPEED);
        this.vy = random(-FLY_SPEED, FLY_SPEED);
        this.size = FLY_SIZE;
        this.wingOffset = 0;
        this.attackCooldown = 0;
    }
    
    update() {
        // Erratic movement
        this.x += this.vx;
        this.y += this.vy;
        
        // Random direction changes
        if (random() < 0.02) {
            this.vx = random(-FLY_SPEED, FLY_SPEED);
            this.vy = random(-FLY_SPEED, FLY_SPEED);
        }
        
        // Bounce off walls
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
        
        // Keep in bounds
        this.x = constrain(this.x, 0, width);
        this.y = constrain(this.y, 0, height);
        
        // Wing animation
        this.wingOffset += 0.5;
        
        // Attack nearby bees
        if (this.attackCooldown > 0) {
            this.attackCooldown--;
        }
        
        for (let bee of bees) {
            let distance = dist(this.x, this.y, bee.x, bee.y);
            if (distance < 40 && this.attackCooldown === 0) {
                bee.health--;
                this.attackCooldown = 60;
                createHitParticles(bee.x, bee.y);
            }
        }
    }
    
    draw() {
        push();
        translate(this.x, this.y);
        
        // Wings
        fill(100, 100, 100, 150);
        stroke(50);
        strokeWeight(1);
        
        // Wing buzzing animation
        let wingFlap = sin(this.wingOffset) * 8;
        ellipse(-10, -5 + wingFlap, 12, 6);
        ellipse(10, -5 + wingFlap, 12, 6);
        
        // Body
        fill(60, 30, 0);
        stroke(0);
        strokeWeight(2);
        ellipse(0, 0, this.size, this.size * 0.6);
        
        // Ugly features
        fill(255, 0, 0);
        ellipse(-4, -6, 3, 3); // Red eyes
        ellipse(4, -6, 3, 3);
        
        // Frown
        noFill();
        stroke(0);
        strokeWeight(2);
        arc(0, 2, 8, 6, PI, TWO_PI);
        
        pop();
    }
}

class HoneyDrop {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = HONEY_SIZE;
    }
    
    update() {
        this.x += HONEY_SPEED;
    }
    
    draw() {
        fill(255, 215, 0);
        stroke(255, 165, 0);
        strokeWeight(1);
        ellipse(this.x, this.y, this.size, this.size);
        
        // Honey glow
        fill(255, 215, 0, 100);
        noStroke();
        ellipse(this.x, this.y, this.size * 1.5, this.size * 1.5);
    }
}

class Particle {
    constructor(x, y, color, size) {
        this.x = x;
        this.y = y;
        this.vx = random(-3, 3);
        this.vy = random(-3, 3);
        this.color = color;
        this.size = size;
        this.alpha = 255;
        this.fade = random(3, 8);
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.fade;
        this.size *= 0.98;
    }
    
    draw() {
        push();
        this.color.setAlpha(this.alpha);
        fill(this.color);
        noStroke();
        ellipse(this.x, this.y, this.size, this.size);
        pop();
    }
}

function checkCollisions() {
    // Honey drops vs flies
    for (let i = honeyDrops.length - 1; i >= 0; i--) {
        for (let j = flies.length - 1; j >= 0; j--) {
            let distance = dist(honeyDrops[i].x, honeyDrops[i].y, flies[j].x, flies[j].y);
            if (distance < flies[j].size / 2 + honeyDrops[i].size / 2) {
                flies[j].health--;
                createHitParticles(flies[j].x, flies[j].y);
                honeyDrops.splice(i, 1);
                break;
            }
        }
    }
}

function createDeathParticles(x, y, particleColor) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, particleColor, random(5, 15)));
    }
}

function createHitParticles(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push(new Particle(x, y, color(255, 0, 0), random(3, 8)));
    }
}

function spawnFlies(count) {
    for (let i = 0; i < count; i++) {
        let side = floor(random(4));
        let x, y;
        
        switch (side) {
            case 0: // Top
                x = random(width);
                y = -50;
                break;
            case 1: // Right
                x = width + 50;
                y = random(height);
                break;
            case 2: // Bottom
                x = random(width);
                y = height + 50;
                break;
            case 3: // Left
                x = -50;
                y = random(height);
                break;
        }
        
        flies.push(new Fly(x, y));
    }
}

function keyPressed() {
    keys[key] = true;
    
    if (key === 'r' || key === 'R') {
        restartGame();
    }
    
    if (key === ' ' && gameState === 'levelComplete') {
        nextLevel();
    }
}

function keyReleased() {
    keys[key] = false;
}

function restartGame() {
    bees = [];
    flies = [];
    honeyDrops = [];
    particles = [];
    powerUps = [];
    score = 0;
    lives = 3;
    level = 1;
    gameState = 'playing';
    flySpawnTimer = 0;
    flySpawnRate = 120;
    
    // Create initial bees
    for (let i = 0; i < 3; i++) {
        bees.push(new Bee(100 + i * 50, height / 2));
    }
    
    spawnFlies(5);
}

function nextLevel() {
    level++;
    gameState = 'playing';
    flySpawnRate = max(30, flySpawnRate - 20);
    
    // Add more bees for higher levels
    if (level % 3 === 0) {
        bees.push(new Bee(100, height / 2));
    }
    
    // Clear existing flies and spawn new ones
    flies = [];
    spawnFlies(5 + level * 2);
} 