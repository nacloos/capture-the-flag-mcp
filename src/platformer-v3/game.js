let player;
let camera;
let world;
let platforms = [];
let particles = [];
let collectibles = [];
let enemies = [];
let gameTime = 0;
let score = 0;
let keys = {};
let lastEventTime = 0;
let gameState = 'playing'; // 'playing', 'won', 'lost'
let totalCollectibles = 0;
let winCondition = 'collect_all'; // 'collect_all', 'survive_time', 'reach_end'
let gates = []; // Barriers that require collections to pass

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 1200;
const GRAVITY = 0.5;
const PLAYER_SPEED = 6;
const JUMP_FORCE = -12;
const EVENT_THROTTLE_MS = 100;

function sendGameEvent(eventType, data) {
    const now = Date.now();
    if (now - lastEventTime < EVENT_THROTTLE_MS && 
        (eventType === 'player_move' || eventType === 'player_position')) {
        return;
    }
    lastEventTime = now;
    
    const event = {
        type: 'GAME_EVENT',
        event: {
            timestamp: new Date().toISOString(),
            eventType: eventType,
            data: data
        }
    };
    
    if (window.parent !== window) {
        window.parent.postMessage(event, '*');
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = 20;
        this.height = 30;
        this.grounded = false;
        this.health = 100;
        this.trail = [];
        this.dashCooldown = 0;
        this.invincibilityFrames = 0;
    }

    update() {
        this.handleInput();
        this.physics();
        this.updateTrail();
        this.dashCooldown = max(0, this.dashCooldown - 1);
        this.invincibilityFrames = max(0, this.invincibilityFrames - 1);
    }

    handleInput() {
        if (keys['a'] || keys['ArrowLeft']) {
            this.vx = -PLAYER_SPEED;
        } else if (keys['d'] || keys['ArrowRight']) {
            this.vx = PLAYER_SPEED;
        } else {
            this.vx *= 0.8;
            // Fix floating point precision issues
            if (abs(this.vx) < 0.001) this.vx = 0;
        }

        if ((keys['w'] || keys['ArrowUp'] || keys[' ']) && this.grounded) {
            this.vy = JUMP_FORCE;
            this.grounded = false;
            this.createJumpParticles();
            sendGameEvent('player_jump', {
                x: this.x,
                y: this.y,
                velocity: this.vy
            });
        }

        if ((keys['Shift'] || keys['s']) && this.dashCooldown <= 0) {
            this.vx *= 2;
            this.dashCooldown = 60;
            this.createDashParticles();
            sendGameEvent('player_dash', {
                x: this.x,
                y: this.y,
                velocity: this.vx
            });
        }
    }

    physics() {
        this.vy += GRAVITY;
        this.x += this.vx;
        this.y += this.vy;

        this.grounded = false;
        this.collideWithPlatforms();
        this.collideWithGates();
        this.collectItems();
        this.checkEnemies();

        if (this.y > WORLD_HEIGHT) {
            this.respawn();
        }
    }

    collideWithPlatforms() {
        for (let platform of platforms) {
            if (this.x < platform.x + platform.width &&
                this.x + this.width > platform.x &&
                this.y < platform.y + platform.height &&
                this.y + this.height > platform.y) {
                
                let overlapX = min(this.x + this.width - platform.x, platform.x + platform.width - this.x);
                let overlapY = min(this.y + this.height - platform.y, platform.y + platform.height - this.y);
                
                if (overlapX < overlapY) {
                    if (this.x < platform.x) {
                        this.x = platform.x - this.width;
                    } else {
                        this.x = platform.x + platform.width;
                    }
                    this.vx = 0;
                } else {
                    if (this.y < platform.y) {
                        this.y = platform.y - this.height;
                        this.vy = 0;
                        this.grounded = true;
                    } else {
                        this.y = platform.y + platform.height;
                        this.vy = 0;
                    }
                }
            }
        }
    }

    collideWithGates() {
        for (let gate of gates) {
            if (gate.blocksPlayer(this)) {
                // Push player back
                this.x = gate.x - this.width - 1;
                this.vx = 0;
                
                // Send event about gate blocking
                sendGameEvent('gate_blocked', {
                    playerX: this.x,
                    playerY: this.y,
                    gateX: gate.x,
                    required: gate.requiredCollections,
                    collected: totalCollectibles - collectibles.length
                });
                break;
            }
        }
    }

    collectItems() {
        for (let i = collectibles.length - 1; i >= 0; i--) {
            let item = collectibles[i];
            if (dist(this.x + this.width/2, this.y + this.height/2, item.x, item.y) < 20) {
                score += 10;
                collectibles.splice(i, 1);
                this.createCollectParticles(item.x, item.y);
                sendGameEvent('item_collected', {
                    itemX: item.x,
                    itemY: item.y,
                    playerX: this.x,
                    playerY: this.y,
                    newScore: score,
                    remaining: collectibles.length
                });
                
                // Check win condition
                if (collectibles.length === 0 && winCondition === 'collect_all') {
                    gameState = 'won';
                    sendGameEvent('game_victory', {
                        winCondition: 'collect_all',
                        finalScore: score,
                        timeToComplete: gameTime,
                        finalHealth: this.health
                    });
                }
            }
        }
    }

    checkEnemies() {
        if (this.invincibilityFrames > 0) return; // Skip damage during invincibility
        
        for (let enemy of enemies) {
            if (dist(this.x + this.width/2, this.y + this.height/2, enemy.x, enemy.y) < 25) {
                this.health -= 1;
                this.invincibilityFrames = 60; // 1 second of invincibility
                sendGameEvent('player_damage', {
                    playerX: this.x,
                    playerY: this.y,
                    enemyX: enemy.x,
                    enemyY: enemy.y,
                    newHealth: this.health
                });
                
                // Add knockback to prevent getting stuck
                let knockbackX = this.x - enemy.x;
                let knockbackY = this.y - enemy.y;
                let knockbackMag = sqrt(knockbackX * knockbackX + knockbackY * knockbackY);
                if (knockbackMag > 0) {
                    knockbackX /= knockbackMag;
                    knockbackY /= knockbackMag;
                    this.vx += knockbackX * 8;
                    this.vy += knockbackY * 4;
                }
                
                if (this.health <= 0) {
                    this.respawn();
                }
                break; // Only take damage from one enemy per frame
            }
        }
    }

    respawn() {
        this.x = 100;
        this.y = 100;
        this.vx = 0;
        this.vy = 0;
        this.health = 100;
        sendGameEvent('player_respawn', {
            x: this.x,
            y: this.y,
            health: this.health
        });
    }

    updateTrail() {
        this.trail.push({x: this.x + this.width/2, y: this.y + this.height/2});
        if (this.trail.length > 10) {
            this.trail.shift();
        }
    }

    createJumpParticles() {
        for (let i = 0; i < 5; i++) {
            particles.push(new Particle(this.x + this.width/2, this.y + this.height, 0, random(-2, 2), color(0, 255, 255, 150)));
        }
    }

    createDashParticles() {
        for (let i = 0; i < 8; i++) {
            particles.push(new Particle(this.x + this.width/2, this.y + this.height/2, random(-3, 3), random(-3, 3), color(255, 0, 255, 200)));
        }
    }

    createCollectParticles(x, y) {
        for (let i = 0; i < 10; i++) {
            particles.push(new Particle(x, y, random(-4, 4), random(-4, 4), color(255, 255, 0, 200)));
        }
    }

    draw() {
        push();
        translate(-camera.x, -camera.y);
        
        // Draw trail
        stroke(0, 255, 255, 100);
        strokeWeight(3);
        noFill();
        beginShape();
        for (let point of this.trail) {
            vertex(point.x, point.y);
        }
        endShape();
        
        // Draw player with glow effect (flashing if invincible)
        if (this.invincibilityFrames > 0 && this.invincibilityFrames % 8 < 4) {
            fill(255, 255, 255, 100); // Flashing white
        } else {
            fill(0, 255, 255);
        }
        stroke(255);
        strokeWeight(2);
        rect(this.x, this.y, this.width, this.height, 5);
        
        // Draw eyes
        fill(255, 0, 255);
        noStroke();
        ellipse(this.x + 5, this.y + 8, 4, 4);
        ellipse(this.x + 15, this.y + 8, 4, 4);
        
        pop();
    }
}

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
    }

    update() {
        this.targetX = player.x - width/2;
        this.targetY = player.y - height/2;
        
        this.x = lerp(this.x, this.targetX, 0.1);
        this.y = lerp(this.y, this.targetY, 0.1);
        
        this.x = constrain(this.x, 0, WORLD_WIDTH - width);
        this.y = constrain(this.y, 0, WORLD_HEIGHT - height);
    }
}

class Platform {
    constructor(x, y, w, h, type = 'normal') {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.type = type;
        this.glow = 0;
    }

    update() {
        this.glow = sin(gameTime * 0.1) * 20 + 30;
    }

    draw() {
        push();
        translate(-camera.x, -camera.y);
        
        if (this.type === 'cyber') {
            fill(0, 100, 200, 150);
            stroke(0, 255, 255, this.glow);
            strokeWeight(2);
        } else {
            fill(50, 50, 80);
            stroke(100, 100, 150);
            strokeWeight(1);
        }
        
        rect(this.x, this.y, this.width, this.height, 3);
        
        // Add grid pattern for cyber platforms
        if (this.type === 'cyber') {
            stroke(0, 255, 255, 50);
            strokeWeight(1);
            for (let i = this.x; i < this.x + this.width; i += 20) {
                line(i, this.y, i, this.y + this.height);
            }
            for (let i = this.y; i < this.y + this.height; i += 20) {
                line(this.x, i, this.x + this.width, i);
            }
        }
        
        pop();
    }
}

class Particle {
    constructor(x, y, vx, vy, col) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = 255;
        this.color = col;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1;
        this.life -= 5;
    }

    draw() {
        if (this.life > 0) {
            push();
            translate(-camera.x, -camera.y);
            fill(red(this.color), green(this.color), blue(this.color), this.life);
            noStroke();
            ellipse(this.x, this.y, 6, 6);
            pop();
        }
    }

    isDead() {
        return this.life <= 0;
    }
}

class Collectible {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.pulse = 0;
    }

    update() {
        this.angle += 0.1;
        this.pulse = sin(gameTime * 0.2) * 10 + 15;
    }

    draw() {
        push();
        translate(-camera.x, -camera.y);
        translate(this.x, this.y);
        rotate(this.angle);
        
        fill(255, 255, 0, 200);
        stroke(255, 255, 0, this.pulse);
        strokeWeight(3);
        
        beginShape();
        for (let i = 0; i < 6; i++) {
            let angle = i * PI / 3;
            let radius = i % 2 === 0 ? 12 : 6;
            vertex(cos(angle) * radius, sin(angle) * radius);
        }
        endShape(CLOSE);
        
        pop();
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = random(-2, 2);
        this.vy = 0;
        this.pulse = 0;
        this.patrolStart = x;
        this.patrolEnd = x + random(100, 200);
        this.direction = 1;
    }

    update() {
        this.pulse = sin(gameTime * 0.3) * 50 + 100;
        
        if (this.x <= this.patrolStart || this.x >= this.patrolEnd) {
            this.direction *= -1;
        }
        
        this.x += this.direction * 1;
        
        // Simple gravity
        this.vy += 0.3;
        this.y += this.vy;
        
        // Ground collision
        for (let platform of platforms) {
            if (this.x > platform.x && this.x < platform.x + platform.width &&
                this.y > platform.y - 15 && this.y < platform.y + 5) {
                this.y = platform.y - 15;
                this.vy = 0;
            }
        }
    }

    draw() {
        push();
        translate(-camera.x, -camera.y);
        
        fill(255, 0, 0, this.pulse);
        stroke(255, 100, 100);
        strokeWeight(2);
        
        ellipse(this.x, this.y, 20, 20);
        
        // Glowing eyes
        fill(255, 255, 0);
        noStroke();
        ellipse(this.x - 4, this.y - 2, 3, 3);
        ellipse(this.x + 4, this.y - 2, 3, 3);
        
        pop();
    }
}

function setup() {
    let canvas = createCanvas(800, 600);
    
    player = new Player(100, 100);
    camera = new Camera();
    
    generateWorld();
    totalCollectibles = collectibles.length;
    
    sendGameEvent('game_start', {
        playerX: player.x,
        playerY: player.y,
        worldWidth: WORLD_WIDTH,
        worldHeight: WORLD_HEIGHT,
        totalCollectibles: totalCollectibles,
        totalEnemies: enemies.length,
        winCondition: winCondition
    });
}

class Gate {
    constructor(x, y, requiredCollections) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 200;
        this.requiredCollections = requiredCollections;
        this.isOpen = false;
        this.glow = 0;
    }

    update() {
        this.glow = sin(gameTime * 0.1) * 30 + 50;
        let collected = totalCollectibles - collectibles.length;
        this.isOpen = collected >= this.requiredCollections;
    }

    draw() {
        push();
        translate(-camera.x, -camera.y);
        
        if (this.isOpen) {
            // Open gate - just visual markers
            fill(0, 255, 0, 100);
            stroke(0, 255, 0, this.glow);
        } else {
            // Closed gate - solid barrier
            fill(255, 0, 0, 150);
            stroke(255, 0, 0, this.glow);
        }
        
        strokeWeight(3);
        rect(this.x, this.y, this.width, this.height);
        
        // Display requirement
        fill(255, 255, 255);
        textAlign(CENTER);
        textSize(12);
        let collected = totalCollectibles - collectibles.length;
        text(`${collected}/${this.requiredCollections}`, this.x + this.width/2, this.y - 10);
        textAlign(LEFT);
        
        pop();
    }

    blocksPlayer(player) {
        if (this.isOpen) return false;
        
        return player.x < this.x + this.width &&
               player.x + player.width > this.x &&
               player.y < this.y + this.height &&
               player.y + player.height > this.y;
    }
}

function checkWinConditions() {
    // Only allow reaching end if all gates are open (requires collecting items)
    if (player.x >= WORLD_WIDTH - 100 && gates.every(gate => gate.isOpen)) {
        gameState = 'won';
        sendGameEvent('game_victory', {
            winCondition: 'reach_end',
            finalScore: score,
            timeToComplete: gameTime,
            finalHealth: player.health
        });
    }
    
    // Survival time (2 minutes) - only if significant progress made
    if (gameTime >= 7200 && (totalCollectibles - collectibles.length) >= 25) {
        gameState = 'won';
        sendGameEvent('game_victory', {
            winCondition: 'survive_time',
            finalScore: score,
            timeToComplete: gameTime,
            finalHealth: player.health
        });
    }
}

function generateWorld() {
    // Ground platforms
    for (let i = 0; i < WORLD_WIDTH; i += 200) {
        platforms.push(new Platform(i, WORLD_HEIGHT - 50, 200, 50, 'cyber'));
    }
    
    // Floating platforms
    for (let i = 0; i < 30; i++) {
        let x = random(200, WORLD_WIDTH - 200);
        let y = random(200, WORLD_HEIGHT - 200);
        let w = random(100, 300);
        let h = random(20, 40);
        platforms.push(new Platform(x, y, w, h, random() > 0.5 ? 'cyber' : 'normal'));
    }
    
    // Collectibles
    for (let i = 0; i < 50; i++) {
        let x = random(100, WORLD_WIDTH - 100);
        let y = random(100, WORLD_HEIGHT - 100);
        collectibles.push(new Collectible(x, y));
    }
    
    // Enemies - place strategically near gates and critical paths
    let criticalPositions = [
        {x: 600, y: WORLD_HEIGHT - 150}, // Before first gate
        {x: 1000, y: WORLD_HEIGHT - 150}, // After first gate
        {x: 1400, y: WORLD_HEIGHT - 150}, // Before second gate
        {x: 1800, y: WORLD_HEIGHT - 150}, // After second gate
        {x: 2200, y: WORLD_HEIGHT - 150}, // Before third gate
        {x: 2600, y: WORLD_HEIGHT - 150}, // After third gate
    ];
    
    // Place enemies at critical positions
    for (let pos of criticalPositions) {
        enemies.push(new Enemy(pos.x, pos.y));
    }
    
    // Add some random enemies
    for (let i = 0; i < 9; i++) {
        let x = random(200, WORLD_WIDTH - 200);
        let y = random(200, WORLD_HEIGHT - 200);
        enemies.push(new Enemy(x, y));
    }
    
    // Gates that require collections to pass
    gates.push(new Gate(800, WORLD_HEIGHT - 250, 10));  // Need 10 stars
    gates.push(new Gate(1600, WORLD_HEIGHT - 250, 25)); // Need 25 stars
    gates.push(new Gate(2400, WORLD_HEIGHT - 250, 40)); // Need 40 stars
}

function draw() {
    background(5, 5, 20);
    gameTime++;
    
    // Only update game if still playing
    if (gameState === 'playing') {
        // Update
        player.update();
        camera.update();
        
        // Check additional win conditions
        checkWinConditions();
        
        // Send periodic position updates (throttled)
        if (gameTime % 60 === 0) {
            sendGameEvent('player_position', {
                x: player.x,
                y: player.y,
                vx: player.vx,
                vy: player.vy,
                health: player.health,
                score: score,
                gameTime: gameTime,
                collectiblesRemaining: collectibles.length
            });
        }
    }
    
    for (let platform of platforms) {
        platform.update();
    }
    
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }
    
    for (let collectible of collectibles) {
        collectible.update();
    }
    
    for (let enemy of enemies) {
        enemy.update();
    }
    
    for (let gate of gates) {
        gate.update();
    }
    
    // Draw world
    drawBackground();
    
    for (let platform of platforms) {
        platform.draw();
    }
    
    for (let particle of particles) {
        particle.draw();
    }
    
    for (let collectible of collectibles) {
        collectible.draw();
    }
    
    for (let enemy of enemies) {
        enemy.draw();
    }
    
    for (let gate of gates) {
        gate.draw();
    }
    
    player.draw();
    
    // Draw HUD
    drawHUD();
}

function drawBackground() {
    // Parallax stars
    fill(255, 255, 255, 100);
    noStroke();
    for (let i = 0; i < 100; i++) {
        let starX = (i * 123) % WORLD_WIDTH;
        let starY = (i * 456) % WORLD_HEIGHT;
        let parallaxX = starX - camera.x * 0.1;
        let parallaxY = starY - camera.y * 0.1;
        
        if (parallaxX > -10 && parallaxX < width + 10 && parallaxY > -10 && parallaxY < height + 10) {
            ellipse(parallaxX, parallaxY, 2, 2);
        }
    }
    
    // Grid lines
    stroke(0, 255, 255, 20);
    strokeWeight(1);
    for (let i = -camera.x % 50; i < width; i += 50) {
        line(i, 0, i, height);
    }
    for (let i = -camera.y % 50; i < height; i += 50) {
        line(0, i, width, i);
    }
}

function drawHUD() {
    // Health bar
    fill(255, 0, 0);
    rect(20, 20, 200, 20);
    fill(0, 255, 0);
    rect(20, 20, (player.health / 100) * 200, 20);
    
    // Score and progress
    fill(0, 255, 255);
    textSize(20);
    text(`Score: ${score}`, 20, 60);
    
    // Progress indicators
    fill(255, 255, 0);
    textSize(16);
    text(`Stars: ${totalCollectibles - collectibles.length}/${totalCollectibles}`, 20, 85);
    
    // Time
    let minutes = Math.floor(gameTime / 3600);
    let seconds = Math.floor((gameTime % 3600) / 60);
    text(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, 20, 110);
    
    // Win conditions
    fill(255, 255, 255, 180);
    textSize(14);
    text("WIN CONDITIONS:", 20, height - 120);
    text("• Collect all 50 stars", 20, height - 100);
    text("• Reach the end of the world", 20, height - 80);
    text("• Survive for 2 minutes", 20, height - 60);
    
    // Next gate info
    let nextGate = null;
    let collected = totalCollectibles - collectibles.length;
    for (let gate of gates) {
        if (!gate.isOpen) {
            nextGate = gate;
            break;
        }
    }
    
    if (nextGate) {
        fill(255, 255, 0);
        textSize(16);
        text(`Next Gate: ${collected}/${nextGate.requiredCollections} stars`, 20, 135);
    }
    
    // Controls
    fill(255, 255, 255, 150);
    textSize(12);
    text("WASD/Arrow Keys: Move & Jump | Shift/S: Dash", 20, height - 20);
    
    // Victory message
    if (gameState === 'won') {
        fill(0, 255, 0, 200);
        rect(width/2 - 150, height/2 - 50, 300, 100);
        fill(255, 255, 255);
        textAlign(CENTER);
        textSize(24);
        text("VICTORY!", width/2, height/2 - 20);
        textSize(16);
        text(`Final Score: ${score}`, width/2, height/2 + 10);
        text(`Time: ${Math.floor(gameTime/3600)}:${Math.floor((gameTime%3600)/60).toString().padStart(2,'0')}`, width/2, height/2 + 30);
        textAlign(LEFT);
    }
    
    // Dash cooldown indicator
    if (player.dashCooldown > 0) {
        fill(255, 0, 255, 150);
        rect(250, 20, 100, 20);
        fill(255, 0, 255);
        rect(250, 20, (player.dashCooldown / 60) * 100, 20);
        fill(255);
        textSize(12);
        text("DASH", 280, 35);
    }
}

function keyPressed() {
    keys[key] = true;
    keys[keyCode] = true;
}

function keyReleased() {
    keys[key] = false;
    keys[keyCode] = false;
}