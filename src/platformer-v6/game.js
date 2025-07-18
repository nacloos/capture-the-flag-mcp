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
let gameState = 'tutorial'; // 'tutorial', 'playing', 'won', 'lost'
let totalCollectibles = 0;
let winCondition = 'collect_all'; // 'collect_all', 'survive_time', 'reach_end'
let gates = []; // Barriers that require collections to pass
let tutorialStep = 0;
let tutorialPrompts = [];
let screenShake = 0;
let lastCheckpoint = {x: 100, y: 100};
let audioContext = null;
let sounds = {};

// Game settings - accessibility options
let gameSettings = {
    difficulty: 'normal', // 'easy', 'normal', 'hard'
    colorBlindMode: false,
    reducedMotion: false,
    showHints: true,
    autoJump: false,
    showFPS: false,
    particleCount: 1.0 // 0.5 = half particles, 1.0 = normal, 2.0 = double
};

// Performance tracking
let frameCount = 0;
let lastFPSUpdate = 0;
let currentFPS = 60;

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 1200;
const GRAVITY = 0.5;
const PLAYER_SPEED = 6;
const JUMP_FORCE = -12;
const EVENT_THROTTLE_MS = 100;

// Movement polish constants
const COYOTE_TIME = 6; // frames player can jump after leaving ground
const JUMP_BUFFER_TIME = 8; // frames jump input is remembered
const VARIABLE_JUMP_MULTIPLIER = 0.5; // how much holding jump extends it
const TUTORIAL_STEPS = [
    {text: "Use A/D or Arrow Keys to move", trigger: "move", x: 150, y: 1050},
    {text: "Press W, Space, or Up Arrow to jump", trigger: "jump", x: 350, y: 1050},
    {text: "Press Shift or S to dash across gaps", trigger: "dash", x: 550, y: 1050}
];

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
        this.animFrame = 0;
        this.animTimer = 0;
        this.landingParticles = 0;
        this.wasGrounded = false;
        
        // Movement polish variables
        this.coyoteTime = 0;
        this.jumpBufferTime = 0;
        this.jumpHeld = false;
        this.jumpReleased = false;
        this.lastDirection = 1;
    }

    update() {
        this.handleInput();
        this.physics();
        this.updateTrail();
        this.updateAnimation();
        this.dashCooldown = max(0, this.dashCooldown - 1);
        this.invincibilityFrames = max(0, this.invincibilityFrames - 1);
        this.landingParticles = max(0, this.landingParticles - 1);
        
        // Update movement polish timers
        this.coyoteTime = max(0, this.coyoteTime - 1);
        this.jumpBufferTime = max(0, this.jumpBufferTime - 1);
        
        // Check for landing
        if (this.grounded && !this.wasGrounded) {
            this.createLandingParticles();
            screenShake = gameSettings.reducedMotion ? 2 : 8;
            playSound('land');
        }
        
        // Update coyote time
        if (this.wasGrounded && !this.grounded) {
            this.coyoteTime = COYOTE_TIME;
        }
        
        this.wasGrounded = this.grounded;
    }

    handleInput() {
        // Horizontal movement with acceleration
        let targetVx = 0;
        if (keys['a'] || keys['ArrowLeft']) {
            targetVx = -PLAYER_SPEED;
            this.lastDirection = -1;
        } else if (keys['d'] || keys['ArrowRight']) {
            targetVx = PLAYER_SPEED;
            this.lastDirection = 1;
        }
        
        // Smooth acceleration/deceleration
        if (targetVx !== 0) {
            this.vx = lerp(this.vx, targetVx, this.grounded ? 0.3 : 0.1);
        } else {
            this.vx *= this.grounded ? 0.8 : 0.95;
            if (abs(this.vx) < 0.001) this.vx = 0;
        }
        
        // Tutorial movement trigger
        if (gameState === 'tutorial' && tutorialStep === 0 && abs(this.vx) > 0.1) {
            tutorialStep = 1;
        }

        // Jump input detection
        let jumpPressed = keys['w'] || keys['ArrowUp'] || keys[' '];
        let jumpJustPressed = jumpPressed && !this.jumpHeld;
        this.jumpHeld = jumpPressed;
        
        if (jumpJustPressed) {
            this.jumpBufferTime = JUMP_BUFFER_TIME;
        }
        
        // Jump execution with coyote time and buffering
        if (this.jumpBufferTime > 0 && (this.grounded || this.coyoteTime > 0)) {
            this.vy = JUMP_FORCE * (gameSettings.difficulty === 'easy' ? 1.2 : 1.0);
            this.grounded = false;
            this.coyoteTime = 0;
            this.jumpBufferTime = 0;
            this.jumpReleased = false;
            this.createJumpParticles();
            playSound('jump');
            if (gameState === 'tutorial' && tutorialStep === 1) {
                tutorialStep = 2;
            }
            sendGameEvent('player_jump', {
                x: this.x,
                y: this.y,
                velocity: this.vy
            });
        }
        
        // Variable jump height
        if (!jumpPressed && !this.jumpReleased && this.vy < 0) {
            this.vy *= VARIABLE_JUMP_MULTIPLIER;
            this.jumpReleased = true;
        }

        if ((keys['Shift'] || keys['s']) && this.dashCooldown <= 0) {
            // Give dash a minimum speed in movement direction
            let dashDirection = 0;
            if (keys['a'] || keys['ArrowLeft']) dashDirection = -1;
            else if (keys['d'] || keys['ArrowRight']) dashDirection = 1;
            else dashDirection = this.vx > 0 ? 1 : -1; // Use last direction
            
            this.vx = dashDirection * 15; // Fixed dash speed
            this.dashCooldown = gameSettings.difficulty === 'easy' ? 40 : 60;
            this.createDashParticles();
            playSound('dash');
            if (gameState === 'tutorial' && tutorialStep === 2) {
                gameState = 'playing';
                tutorialStep = 3;
            }
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
            
            // Collectible magnetism - slight pull when close
            let pullDistance = 30;
            if (dist(this.x + this.width/2, this.y + this.height/2, item.x, item.y) < pullDistance) {
                let pullX = (this.x + this.width/2) - item.x;
                let pullY = (this.y + this.height/2) - item.y;
                item.x += pullX * 0.1;
                item.y += pullY * 0.1;
            }
            
            if (dist(this.x + this.width/2, this.y + this.height/2, item.x, item.y) < 20) {
                score += 10;
                collectibles.splice(i, 1);
                this.createCollectParticles(item.x, item.y);
                screenShake = 6;
                playSound('collect');
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
                let damage = gameSettings.difficulty === 'easy' ? 0.25 : 0.5;
                this.health -= damage;
                this.invincibilityFrames = gameSettings.difficulty === 'easy' ? 180 : 120;
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
                    // Easy mode: don't die, just reset health
                    if (gameSettings.difficulty === 'easy') {
                        this.health = 25;
                        playSound('respawn');
                    } else {
                        this.respawn();
                    }
                }
                break; // Only take damage from one enemy per frame
            }
        }
    }

    respawn() {
        this.x = lastCheckpoint.x;
        this.y = lastCheckpoint.y;
        this.vx = 0;
        this.vy = 0;
        this.health = 100;
        playSound('respawn');
        sendGameEvent('player_respawn', {
            x: this.x,
            y: this.y,
            health: this.health
        });
    }
    
    updateAnimation() {
        this.animTimer++;
        if (this.animTimer > 10) {
            this.animFrame = (this.animFrame + 1) % 4;
            this.animTimer = 0;
        }
    }
    
    createLandingParticles() {
        let particleCount = Math.floor(8 * gameSettings.particleCount);
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle(
                this.x + this.width/2 + random(-10, 10), 
                this.y + this.height, 
                random(-2, 2), 
                random(-1, 1), 
                color(200, 200, 200, 150)
            ));
        }
    }

    updateTrail() {
        this.trail.push({x: this.x + this.width/2, y: this.y + this.height/2});
        if (this.trail.length > 10) {
            this.trail.shift();
        }
    }

    createJumpParticles() {
        let particleCount = Math.floor(8 * gameSettings.particleCount);
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle(
                this.x + this.width/2 + random(-5, 5), 
                this.y + this.height, 
                random(-3, 3), 
                random(-2, 0), 
                color(0, 255, 255, 200)
            ));
        }
    }

    createDashParticles() {
        let particleCount = Math.floor(12 * gameSettings.particleCount);
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle(
                this.x + this.width/2 + random(-10, 10), 
                this.y + this.height/2 + random(-10, 10), 
                random(-5, 5), 
                random(-3, 3), 
                color(255, 0, 255, 220)
            ));
        }
    }

    createCollectParticles(x, y) {
        let particleCount = Math.floor(15 * gameSettings.particleCount);
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle(
                x + random(-5, 5), 
                y + random(-5, 5), 
                random(-6, 6), 
                random(-6, 6), 
                color(255, 255, 0, 255)
            ));
        }
    }

    draw() {
        push();
        translate(-camera.x, -camera.y);
        
        // Draw enhanced trail with gradient
        noFill();
        for (let i = 0; i < this.trail.length - 1; i++) {
            let alpha = map(i, 0, this.trail.length - 1, 0, 150);
            stroke(0, 255, 255, alpha);
            strokeWeight(map(i, 0, this.trail.length - 1, 1, 4));
            if (i < this.trail.length - 1) {
                line(this.trail[i].x, this.trail[i].y, this.trail[i + 1].x, this.trail[i + 1].y);
            }
        }
        
        // Player glow effect
        fill(0, 255, 255, 50);
        noStroke();
        ellipse(this.x + this.width/2, this.y + this.height/2, this.width + 10, this.height + 10);
        
        // Draw player with animation and glow effect
        if (this.invincibilityFrames > 0 && this.invincibilityFrames % 8 < 4) {
            fill(255, 255, 255, 180); // Flashing white
        } else {
            fill(0, 255, 255);
        }
        stroke(255);
        strokeWeight(2);
        
        // Simple animation - slightly change size based on movement
        let animOffset = sin(this.animFrame * 0.5) * 1;
        rect(this.x - animOffset/2, this.y - animOffset/2, this.width + animOffset, this.height + animOffset, 5);
        
        // Draw animated eyes
        fill(255, 0, 255);
        noStroke();
        let eyeOffset = this.grounded ? 0 : -1;
        ellipse(this.x + 5, this.y + 8 + eyeOffset, 4, 4);
        ellipse(this.x + 15, this.y + 8 + eyeOffset, 4, 4);
        
        pop();
    }
}

class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.shakeX = 0;
        this.shakeY = 0;
    }

    update() {
        // Lookahead camera - anticipate player movement
        let lookaheadX = player.vx * 15;
        let lookaheadY = player.vy * 5;
        
        this.targetX = player.x - width/2 + lookaheadX;
        this.targetY = player.y - height/2 + lookaheadY;
        
        this.x = lerp(this.x, this.targetX, 0.1);
        this.y = lerp(this.y, this.targetY, 0.1);
        
        // Screen shake
        if (screenShake > 0) {
            this.shakeX = random(-screenShake, screenShake);
            this.shakeY = random(-screenShake, screenShake);
            screenShake *= 0.8;
            if (screenShake < 0.1) screenShake = 0;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }
        
        this.x = constrain(this.x, 0, WORLD_WIDTH - width) + this.shakeX;
        this.y = constrain(this.y, 0, WORLD_HEIGHT - height) + this.shakeY;
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
        
        // Distance-based glow intensity
        let distToPlayer = dist(this.x, this.y, player.x + player.width/2, player.y + player.height/2);
        let glowIntensity = map(distToPlayer, 0, 200, 100, 20);
        glowIntensity = constrain(glowIntensity, 20, 100);
        
        // Adaptive glow based on colorblind mode
        let glowColor = gameSettings.colorBlindMode ? 
            color(255, 255, 255, glowIntensity) : 
            color(255, 255, 0, glowIntensity);
        
        fill(glowColor);
        noStroke();
        ellipse(this.x, this.y, 40, 40);
        
        translate(this.x, this.y);
        rotate(this.angle);
        
        // Main collectible with accessibility colors
        if (gameSettings.colorBlindMode) {
            fill(255, 255, 255, 220);
            stroke(200, 200, 200, this.pulse);
        } else {
            fill(255, 255, 0, 200);
            stroke(255, 255, 0, this.pulse);
        }
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
    
    // Initialize audio
    initializeAudio();
    
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
    // Update checkpoints at gates
    for (let gate of gates) {
        if (gate.isOpen && player.x > gate.x + 50) {
            lastCheckpoint = {x: gate.x + 50, y: gate.y};
        }
    }
    
    // Only allow reaching end if all gates are open (requires collecting items)
    if (player.x >= WORLD_WIDTH - 100 && gates.every(gate => gate.isOpen)) {
        gameState = 'won';
        playSound('victory');
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
        playSound('victory');
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
    
    // Create logical platform paths
    generatePlatformPath();
    
    // Place collectibles on platforms
    placeCollectiblesOnPlatforms();
    
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
    
    // Gates that require collections to pass - balanced requirements
    gates.push(new Gate(800, WORLD_HEIGHT - 250, 3));   // Need 3 stars
    gates.push(new Gate(1600, WORLD_HEIGHT - 250, 8));  // Need 8 stars
    gates.push(new Gate(2400, WORLD_HEIGHT - 250, 15)); // Need 15 stars
}

function generatePlatformPath() {
    let currentX = 200;
    let currentY = WORLD_HEIGHT - 200;
    
    for (let i = 0; i < 30; i++) {
        let width = random(100, 250);
        let height = random(20, 40);
        platforms.push(new Platform(currentX, currentY, width, height, random() > 0.5 ? 'cyber' : 'normal'));
        
        // Next platform within jump range
        currentX += random(80, 200); // Jumpable distance
        currentY += random(-100, 50); // Varied height
        currentY = constrain(currentY, 200, WORLD_HEIGHT - 100);
    }
}

function placeCollectiblesOnPlatforms() {
    for (let platform of platforms) {
        if (random() < 0.6) { // 60% chance per platform
            let x = platform.x + random(20, platform.width - 20);
            let y = platform.y - 25; // Above platform
            collectibles.push(new Collectible(x, y));
        }
    }
}

function draw() {
    background(5, 5, 20);
    gameTime++;
    
    // Update FPS tracking
    updateFPS();
    
    // Auto-adjust particle count based on performance
    if (currentFPS < 45 && gameSettings.particleCount > 0.5) {
        gameSettings.particleCount -= 0.1;
    } else if (currentFPS > 55 && gameSettings.particleCount < 1.0) {
        gameSettings.particleCount += 0.05;
    }
    
    // Update game if playing or in tutorial
    if (gameState === 'playing' || gameState === 'tutorial') {
        // Update
        player.update();
        camera.update();
        
        // Check additional win conditions
        if (gameState === 'playing') {
            checkWinConditions();
        }
        
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
                collectiblesRemaining: collectibles.length,
                difficulty: gameSettings.difficulty
            });
        }
    }
    
    // Always update visual effects even when paused
    updateParticlesAndEffects();
    
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
    
    // Draw tutorial overlay
    drawTutorial();
    
    // Draw guidance hints
    drawGuidanceHints();
    
    // Draw HUD
    drawHUD();
    
    // Draw settings menu
    drawSettings();
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
    // Modern health bar with background
    fill(0, 0, 0, 100);
    rect(18, 18, 204, 24, 12);
    fill(255, 0, 0, 150);
    rect(20, 20, 200, 20, 10);
    fill(0, 255, 0);
    rect(20, 20, (player.health / 100) * 200, 20, 10);
    
    // Health text
    fill(255, 255, 255);
    textSize(12);
    text(`Health: ${Math.round(player.health)}%`, 230, 35);
    
    // Score with better styling
    fill(0, 255, 255);
    textSize(18);
    text(`Score: ${score}`, 20, 65);
    
    // Progress indicators with icons
    fill(255, 255, 0);
    textSize(16);
    text(`⭐ ${totalCollectibles - collectibles.length}/${totalCollectibles}`, 20, 90);
    
    // Time
    let minutes = Math.floor(gameTime / 3600);
    let seconds = Math.floor((gameTime % 3600) / 60);
    text(`Time: ${minutes}:${seconds.toString().padStart(2, '0')}`, 20, 110);
    
    // Win conditions
    fill(255, 255, 255, 180);
    textSize(14);
    text("WIN CONDITIONS:", 20, height - 120);
    text(`• Collect all ${totalCollectibles} stars`, 20, height - 100);
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
    
    // Controls with better formatting
    fill(255, 255, 255, 200);
    textSize(11);
    text("🎮 WASD/Arrows: Move & Jump | Shift/S: Dash", 20, height - 20);
    
    // Game state indicator
    if (gameState === 'tutorial') {
        fill(255, 255, 0, 150);
        textSize(14);
        text(`Tutorial Step ${tutorialStep + 1}/3`, width - 150, 30);
    }
    
    // Settings access hint
    if (gameState === 'playing') {
        fill(255, 255, 255, 100);
        textSize(10);
        text("Press TAB for settings", width - 120, height - 10);
    }
    
    // Difficulty indicator
    if (gameSettings.difficulty !== 'normal') {
        fill(gameSettings.difficulty === 'easy' ? color(0, 255, 0) : color(255, 100, 100));
        textSize(12);
        text(gameSettings.difficulty.toUpperCase(), width - 60, 50);
    }
    
    // Performance indicator
    if (gameSettings.showFPS) {
        fill(currentFPS < 45 ? color(255, 100, 100) : color(100, 255, 100));
        textSize(12);
        text(`FPS: ${currentFPS}`, width - 60, 70);
        
        if (particles.length > 100) {
            fill(255, 150, 100);
            text(`Particles: ${particles.length}`, width - 80, 90);
        }
    }
    
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
    
    // Settings menu toggle
    if (key === 'Tab' || keyCode === 9) {
        if (gameState === 'playing') {
            gameState = 'settings';
        } else if (gameState === 'settings') {
            gameState = 'playing';
        }
    }
    
    // Settings menu controls
    if (gameState === 'settings') {
        if (key === '1') gameSettings.difficulty = 'easy';
        if (key === '2') gameSettings.difficulty = 'normal';
        if (key === '3') gameSettings.difficulty = 'hard';
        if (key === 'c' || key === 'C') gameSettings.colorBlindMode = !gameSettings.colorBlindMode;
        if (key === 'h' || key === 'H') gameSettings.showHints = !gameSettings.showHints;
        if (key === 'f' || key === 'F') gameSettings.showFPS = !gameSettings.showFPS;
        if (key === 'p' || key === 'P') {
            gameSettings.particleCount = gameSettings.particleCount === 1.0 ? 0.5 : 
                                         gameSettings.particleCount === 0.5 ? 2.0 : 1.0;
        }
        if (key === 'Escape' || keyCode === 27) gameState = 'playing';
    }
    
    // Prevent default tab behavior
    if (keyCode === 9) {
        return false;
    }
}

function keyReleased() {
    keys[key] = false;
    keys[keyCode] = false;
}

// Audio System
function initializeAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        createSounds();
    } catch (e) {
        console.log('Audio not supported');
    }
}

function createSounds() {
    if (!audioContext) return;
    
    // Simple sound effects using oscillators
    sounds = {
        jump: createTone(220, 0.1, 'sine'),
        dash: createTone(440, 0.15, 'square'),
        collect: createTone(880, 0.2, 'sine'),
        land: createTone(110, 0.1, 'triangle'),
        respawn: createTone(330, 0.3, 'sine'),
        victory: createTone(660, 0.5, 'sine')
    };
}

function createTone(frequency, duration, type) {
    return {
        frequency: frequency,
        duration: duration,
        type: type
    };
}

function playSound(soundName) {
    if (!audioContext || !sounds[soundName]) return;
    
    const sound = sounds[soundName];
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = sound.frequency;
    oscillator.type = sound.type;
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + sound.duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + sound.duration);
}

// Tutorial System
function drawTutorial() {
    if (gameState !== 'tutorial') return;
    
    let currentStep = TUTORIAL_STEPS[tutorialStep];
    if (!currentStep) return;
    
    // Draw tutorial prompt with better accessibility
    fill(0, 0, 0, 200);
    stroke(gameSettings.colorBlindMode ? 255 : color(255, 255, 0));
    strokeWeight(2);
    rect(currentStep.x - camera.x - 100, currentStep.y - camera.y - 60, 200, 40, 10);
    
    fill(255, 255, 255);
    textAlign(CENTER);
    textSize(14);
    text(currentStep.text, currentStep.x - camera.x, currentStep.y - camera.y - 40);
    
    // Draw arrow pointing to relevant area
    fill(gameSettings.colorBlindMode ? 255 : color(255, 255, 0));
    noStroke();
    triangle(
        currentStep.x - camera.x - 5, currentStep.y - camera.y - 20,
        currentStep.x - camera.x + 5, currentStep.y - camera.y - 20,
        currentStep.x - camera.x, currentStep.y - camera.y - 10
    );
    
    textAlign(LEFT);
}

// Visual Guidance System
function drawGuidanceHints() {
    if (!gameSettings.showHints || gameState !== 'playing') return;
    
    // Find nearest collectible
    let nearestCollectible = null;
    let nearestDistance = Infinity;
    
    for (let collectible of collectibles) {
        let distance = dist(player.x, player.y, collectible.x, collectible.y);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestCollectible = collectible;
        }
    }
    
    // Draw subtle arrow to nearest collectible if it's far
    if (nearestCollectible && nearestDistance > 300) {
        let arrowX = width - 60;
        let arrowY = 60;
        let angle = atan2(nearestCollectible.y - player.y, nearestCollectible.x - player.x);
        
        push();
        translate(arrowX, arrowY);
        rotate(angle);
        fill(gameSettings.colorBlindMode ? 255 : color(255, 255, 0), 150);
        noStroke();
        triangle(0, 0, -15, -5, -15, 5);
        pop();
        
        // Distance indicator
        fill(255, 255, 255, 150);
        textAlign(CENTER);
        textSize(12);
        text(`${Math.round(nearestDistance/10)}m`, arrowX, arrowY + 20);
    }
    
    // Show next gate requirements
    for (let gate of gates) {
        if (!gate.isOpen && gate.x - player.x < 400 && gate.x - player.x > -100) {
            let collected = totalCollectibles - collectibles.length;
            let needed = gate.requiredCollections - collected;
            
            if (needed > 0) {
                fill(255, 255, 255, 200);
                textAlign(CENTER);
                textSize(16);
                text(`Need ${needed} more stars`, gate.x - camera.x, gate.y - camera.y - 30);
            }
        }
    }
    
    textAlign(LEFT);
}

// Settings Menu
function drawSettings() {
    if (gameState !== 'settings') return;
    
    // Semi-transparent background
    fill(0, 0, 0, 180);
    rect(0, 0, width, height);
    
    // Settings panel
    fill(40, 40, 60);
    stroke(gameSettings.colorBlindMode ? 255 : color(0, 255, 255));
    strokeWeight(2);
    rect(width/2 - 200, height/2 - 150, 400, 300, 10);
    
    // Title
    fill(255, 255, 255);
    textAlign(CENTER);
    textSize(24);
    text("Settings", width/2, height/2 - 110);
    
    // Settings options
    textSize(16);
    let startY = height/2 - 60;
    
    // Difficulty
    text("Difficulty:", width/2 - 150, startY);
    fill(gameSettings.difficulty === 'easy' ? color(0, 255, 0) : 150);
    text("Easy", width/2 - 50, startY);
    fill(gameSettings.difficulty === 'normal' ? color(0, 255, 0) : 150);
    text("Normal", width/2, startY);
    fill(gameSettings.difficulty === 'hard' ? color(0, 255, 0) : 150);
    text("Hard", width/2 + 50, startY);
    
    // Color blind mode
    fill(255, 255, 255);
    text("Color Blind Mode:", width/2 - 150, startY + 40);
    fill(gameSettings.colorBlindMode ? color(0, 255, 0) : 150);
    text(gameSettings.colorBlindMode ? "ON" : "OFF", width/2 + 50, startY + 40);
    
    // Show hints
    fill(255, 255, 255);
    text("Show Hints:", width/2 - 150, startY + 80);
    fill(gameSettings.showHints ? color(0, 255, 0) : 150);
    text(gameSettings.showHints ? "ON" : "OFF", width/2 + 50, startY + 80);
    
    // Performance settings
    fill(255, 255, 255);
    text("Show FPS:", width/2 - 150, startY + 120);
    fill(gameSettings.showFPS ? color(0, 255, 0) : 150);
    text(gameSettings.showFPS ? "ON" : "OFF", width/2 + 50, startY + 120);
    
    fill(255, 255, 255);
    text("Particle Effects:", width/2 - 150, startY + 160);
    fill(gameSettings.particleCount === 0.5 ? color(255, 150, 100) : 
         gameSettings.particleCount === 1.0 ? color(0, 255, 0) : 
         color(255, 255, 100));
    text(gameSettings.particleCount === 0.5 ? "LOW" : 
         gameSettings.particleCount === 1.0 ? "NORMAL" : "HIGH", width/2 + 50, startY + 160);
    
    // Instructions
    fill(255, 255, 255, 150);
    textSize(11);
    text("1-3: Difficulty | C: Color Blind Mode | H: Hints", width/2, startY + 200);
    text("F: Show FPS | P: Particle Effects | ESC: Return", width/2, startY + 220);
    
    textAlign(LEFT);
}

// Helper function to update visual effects
function updateParticlesAndEffects() {
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }
    
    // Update collectibles
    for (let collectible of collectibles) {
        collectible.update();
    }
    
    // Update enemies
    for (let enemy of enemies) {
        enemy.update();
    }
    
    // Update gates
    for (let gate of gates) {
        gate.update();
    }
    
    // Update platforms
    for (let platform of platforms) {
        platform.update();
    }
    
    // Update screen shake
    if (screenShake > 0) {
        screenShake *= 0.8;
        if (screenShake < 0.1) screenShake = 0;
    }
}

// Performance tracking
function updateFPS() {
    frameCount++;
    let now = millis();
    
    if (now - lastFPSUpdate >= 1000) {
        currentFPS = Math.round(frameCount * 1000 / (now - lastFPSUpdate));
        frameCount = 0;
        lastFPSUpdate = now;
    }
}