// Game variables
let gameState = 'playing'; // 'playing', 'gameOver'
let score = 0;
let lives = 3;
let player;
let bullets = [];
let enemies = [];
let particles = [];
let powerUps = [];
let stars = [];
let gameSpeed = 1;
let enemySpawnTimer = 0;
let powerUpSpawnTimer = 0;

// Weapon system
let currentWeapon = 'basic';
let weaponAmmo = {
    basic: Infinity,
    spread: 50,
    rapid: 100,
    laser: 30,
    homing: 20
};
let weaponTimer = 0;

// Colors
const COLORS = {
    player: '#00ffff',
    bullet: '#ffff00',
    bulletSpread: '#ff8800',
    bulletRapid: '#ff00ff',
    bulletLaser: '#00ff00',
    bulletHoming: '#ff0000',
    enemy: '#ff0066',
    enemy2: '#ff6600',
    powerUp: '#00ff00',
    weaponPowerUp: '#ffff00',
    particle: '#ffffff',
    star: '#888888'
};

// Weapon definitions
const WEAPONS = {
    basic: {
        name: 'Basic',
        fireRate: 10,
        damage: 1,
        bulletSpeed: 8,
        color: COLORS.bullet
    },
    spread: {
        name: 'Spread Shot',
        fireRate: 15,
        damage: 1,
        bulletSpeed: 7,
        color: COLORS.bulletSpread
    },
    rapid: {
        name: 'Rapid Fire',
        fireRate: 3,
        damage: 1,
        bulletSpeed: 10,
        color: COLORS.bulletRapid
    },
    laser: {
        name: 'Laser Beam',
        fireRate: 30,
        damage: 3,
        bulletSpeed: 15,
        color: COLORS.bulletLaser
    },
    homing: {
        name: 'Homing Missiles',
        fireRate: 20,
        damage: 2,
        bulletSpeed: 5,
        color: COLORS.bulletHoming
    }
};

function setup() {
    let canvas = createCanvas(800, 600);
    canvas.parent('game-canvas');
    
    // Initialize player
    player = {
        x: width / 2,
        y: height - 50,
        size: 20,
        speed: 5,
        shootTimer: 0,
        invulnerable: 0
    };
    
    // Create starfield
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: random(width),
            y: random(height),
            size: random(1, 3),
            speed: random(0.5, 2)
        });
    }
    
    updateUI();
}

function draw() {
    background(0);
    
    if (gameState === 'playing') {
        updateGame();
        drawGame();
    } else if (gameState === 'gameOver') {
        drawGameOver();
    }
}

function updateGame() {
    updateStars();
    updatePlayer();
    updateBullets();
    updateEnemies();
    updatePowerUps();
    updateParticles();
    
    spawnEnemies();
    spawnPowerUps();
    
    checkCollisions();
    
    // Increase difficulty over time
    gameSpeed += 0.001;
}

function updateStars() {
    for (let star of stars) {
        star.y += star.speed;
        if (star.y > height) {
            star.y = 0;
            star.x = random(width);
        }
    }
}

function updatePlayer() {
    // Movement
    if (keyIsDown(LEFT_ARROW) && player.x > player.size) {
        player.x -= player.speed;
    }
    if (keyIsDown(RIGHT_ARROW) && player.x < width - player.size) {
        player.x += player.speed;
    }
    if (keyIsDown(UP_ARROW) && player.y > player.size) {
        player.y -= player.speed;
    }
    if (keyIsDown(DOWN_ARROW) && player.y < height - player.size) {
        player.y += player.speed;
    }
    
    // Shooting
    if (keyIsDown(32) && player.shootTimer <= 0) { // Spacebar
        if (weaponAmmo[currentWeapon] > 0) {
            fireWeapon();
            if (weaponAmmo[currentWeapon] !== Infinity) {
                weaponAmmo[currentWeapon]--;
            }
            player.shootTimer = WEAPONS[currentWeapon].fireRate;
        }
    }
    
    if (player.shootTimer > 0) player.shootTimer--;
    if (player.invulnerable > 0) player.invulnerable--;
    if (weaponTimer > 0) weaponTimer--;
}

function fireWeapon() {
    let weapon = WEAPONS[currentWeapon];
    let startX = player.x;
    let startY = player.y - player.size;
    
    switch (currentWeapon) {
        case 'basic':
            bullets.push({
                x: startX,
                y: startY,
                vx: 0,
                vy: -weapon.bulletSpeed,
                size: 4,
                type: 'basic',
                damage: weapon.damage,
                color: weapon.color
            });
            break;
            
        case 'spread':
            for (let i = -2; i <= 2; i++) {
                bullets.push({
                    x: startX,
                    y: startY,
                    vx: i * 1.5,
                    vy: -weapon.bulletSpeed,
                    size: 3,
                    type: 'spread',
                    damage: weapon.damage,
                    color: weapon.color
                });
            }
            break;
            
        case 'rapid':
            bullets.push({
                x: startX + random(-2, 2),
                y: startY,
                vx: 0,
                vy: -weapon.bulletSpeed,
                size: 2,
                type: 'rapid',
                damage: weapon.damage,
                color: weapon.color
            });
            break;
            
        case 'laser':
            bullets.push({
                x: startX,
                y: startY,
                vx: 0,
                vy: -weapon.bulletSpeed,
                size: 8,
                type: 'laser',
                damage: weapon.damage,
                color: weapon.color,
                length: 40
            });
            break;
            
        case 'homing':
            bullets.push({
                x: startX,
                y: startY,
                vx: 0,
                vy: -weapon.bulletSpeed,
                size: 6,
                type: 'homing',
                damage: weapon.damage,
                color: weapon.color,
                target: null
            });
            break;
    }
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        let bullet = bullets[i];
        
        // Homing behavior
        if (bullet.type === 'homing') {
            if (!bullet.target || bullet.target.destroyed) {
                // Find nearest enemy
                let nearestDist = Infinity;
                for (let enemy of enemies) {
                    let dist = distance(bullet.x, bullet.y, enemy.x, enemy.y);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        bullet.target = enemy;
                    }
                }
            }
            
            if (bullet.target) {
                let angle = atan2(bullet.target.y - bullet.y, bullet.target.x - bullet.x);
                bullet.vx = cos(angle) * WEAPONS.homing.bulletSpeed;
                bullet.vy = sin(angle) * WEAPONS.homing.bulletSpeed;
            }
        }
        
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        
        if (bullet.y < -bullet.size || bullet.x < -bullet.size || bullet.x > width + bullet.size) {
            bullets.splice(i, 1);
        }
    }
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        let enemy = enemies[i];
        enemy.y += enemy.speed * gameSpeed;
        
        // Zigzag movement for some enemies
        if (enemy.type === 'zigzag') {
            enemy.x += sin(enemy.y * 0.02) * 2;
        }
        
        if (enemy.y > height + enemy.size) {
            enemies.splice(i, 1);
        }
    }
}

function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        let powerUp = powerUps[i];
        powerUp.y += powerUp.speed;
        powerUp.rotation += 0.1;
        
        if (powerUp.y > height + powerUp.size) {
            powerUps.splice(i, 1);
        }
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life--;
        
        if (particle.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function spawnEnemies() {
    enemySpawnTimer++;
    if (enemySpawnTimer > 60 - (gameSpeed * 10)) {
        let enemyType = random() < 0.7 ? 'normal' : 'zigzag';
        let enemy = {
            x: random(30, width - 30),
            y: -30,
            size: enemyType === 'normal' ? 20 : 25,
            speed: enemyType === 'normal' ? random(1, 3) : random(0.5, 2),
            type: enemyType,
            health: enemyType === 'normal' ? 1 : 2,
            color: enemyType === 'normal' ? COLORS.enemy : COLORS.enemy2,
            destroyed: false
        };
        enemies.push(enemy);
        enemySpawnTimer = 0;
    }
}

function spawnPowerUps() {
    powerUpSpawnTimer++;
    if (powerUpSpawnTimer > 800) { // Spawn every ~13 seconds
        let powerUpType = random() < 0.6 ? 'health' : 'weapon';
        let powerUp = {
            x: random(50, width - 50),
            y: -30,
            size: 15,
            speed: 2,
            rotation: 0,
            type: powerUpType
        };
        powerUps.push(powerUp);
        powerUpSpawnTimer = 0;
    }
}

function checkCollisions() {
    // Bullets vs Enemies
    for (let i = bullets.length - 1; i >= 0; i--) {
        let bullet = bullets[i];
        for (let j = enemies.length - 1; j >= 0; j--) {
            let enemy = enemies[j];
            if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < bullet.size + enemy.size) {
                // Hit enemy
                enemy.health -= bullet.damage;
                bullets.splice(i, 1);
                
                if (enemy.health <= 0) {
                    score += enemy.type === 'normal' ? 10 : 25;
                    enemy.destroyed = true;
                    createExplosion(enemy.x, enemy.y, enemy.color);
                    enemies.splice(j, 1);
                } else {
                    createHitEffect(enemy.x, enemy.y);
                }
                updateUI();
                break;
            }
        }
    }
    
    // Player vs Enemies
    if (player.invulnerable <= 0) {
        for (let i = enemies.length - 1; i >= 0; i--) {
            let enemy = enemies[i];
            if (distance(player.x, player.y, enemy.x, enemy.y) < player.size + enemy.size) {
                lives--;
                player.invulnerable = 120; // 2 seconds of invulnerability
                createExplosion(enemy.x, enemy.y, enemy.color);
                enemies.splice(i, 1);
                updateUI();
                
                if (lives <= 0) {
                    gameState = 'gameOver';
                }
                break;
            }
        }
    }
    
    // Player vs Power-ups
    for (let i = powerUps.length - 1; i >= 0; i--) {
        let powerUp = powerUps[i];
        if (distance(player.x, player.y, powerUp.x, powerUp.y) < player.size + powerUp.size) {
            if (powerUp.type === 'health') {
                lives = min(lives + 1, 5);
                createPickupEffect(powerUp.x, powerUp.y, COLORS.powerUp);
            } else if (powerUp.type === 'weapon') {
                // Cycle through weapons
                let weaponKeys = Object.keys(WEAPONS);
                let currentIndex = weaponKeys.indexOf(currentWeapon);
                let nextIndex = (currentIndex + 1) % weaponKeys.length;
                currentWeapon = weaponKeys[nextIndex];
                
                // Refill ammo for new weapon
                weaponAmmo[currentWeapon] = getMaxAmmo(currentWeapon);
                weaponTimer = 300; // 5 seconds weapon indicator
                
                createPickupEffect(powerUp.x, powerUp.y, COLORS.weaponPowerUp);
            }
            powerUps.splice(i, 1);
            updateUI();
        }
    }
}

function getMaxAmmo(weapon) {
    switch (weapon) {
        case 'basic': return Infinity;
        case 'spread': return 50;
        case 'rapid': return 100;
        case 'laser': return 30;
        case 'homing': return 20;
        default: return 50;
    }
}

function distance(x1, y1, x2, y2) {
    return sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x,
            y: y,
            vx: random(-4, 4),
            vy: random(-4, 4),
            life: 30,
            color: color,
            size: random(2, 6)
        });
    }
}

function createHitEffect(x, y) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x,
            y: y,
            vx: random(-2, 2),
            vy: random(-2, 2),
            life: 15,
            color: COLORS.particle,
            size: random(1, 3)
        });
    }
}

function createPickupEffect(x, y, color) {
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: x,
            y: y,
            vx: random(-3, 3),
            vy: random(-3, 3),
            life: 25,
            color: color,
            size: random(2, 4)
        });
    }
}

function drawGame() {
    // Draw stars
    fill(COLORS.star);
    noStroke();
    for (let star of stars) {
        ellipse(star.x, star.y, star.size);
    }
    
    // Draw player
    fill(COLORS.player);
    stroke(COLORS.player);
    strokeWeight(2);
    if (player.invulnerable > 0 && player.invulnerable % 10 < 5) {
        // Flashing effect when invulnerable
        fill(255, 100);
    }
    
    // Draw player as a triangle spaceship
    push();
    translate(player.x, player.y);
    beginShape();
    vertex(0, -player.size);
    vertex(-player.size * 0.6, player.size * 0.6);
    vertex(0, player.size * 0.3);
    vertex(player.size * 0.6, player.size * 0.6);
    endShape(CLOSE);
    pop();
    
    // Draw bullets
    noStroke();
    for (let bullet of bullets) {
        fill(bullet.color);
        
        if (bullet.type === 'laser') {
            // Draw laser as a line
            stroke(bullet.color);
            strokeWeight(bullet.size);
            line(bullet.x, bullet.y, bullet.x, bullet.y - bullet.length);
            noStroke();
        } else if (bullet.type === 'homing') {
            // Draw homing missile with trail
            push();
            translate(bullet.x, bullet.y);
            rotate(atan2(bullet.vy, bullet.vx) + PI/2);
            beginShape();
            vertex(0, -bullet.size);
            vertex(-bullet.size * 0.3, bullet.size);
            vertex(0, bullet.size * 0.5);
            vertex(bullet.size * 0.3, bullet.size);
            endShape(CLOSE);
            pop();
        } else {
            ellipse(bullet.x, bullet.y, bullet.size * 2);
        }
    }
    
    // Draw enemies
    strokeWeight(2);
    for (let enemy of enemies) {
        fill(enemy.color);
        stroke(enemy.color);
        
        if (enemy.type === 'normal') {
            // Draw as octagon
            push();
            translate(enemy.x, enemy.y);
            beginShape();
            for (let i = 0; i < 8; i++) {
                let angle = (i * TWO_PI) / 8;
                let x = cos(angle) * enemy.size;
                let y = sin(angle) * enemy.size;
                vertex(x, y);
            }
            endShape(CLOSE);
            pop();
        } else {
            // Draw zigzag enemy as diamond
            push();
            translate(enemy.x, enemy.y);
            rotate(frameCount * 0.02);
            beginShape();
            vertex(0, -enemy.size);
            vertex(enemy.size, 0);
            vertex(0, enemy.size);
            vertex(-enemy.size, 0);
            endShape(CLOSE);
            pop();
        }
    }
    
    // Draw power-ups
    strokeWeight(2);
    for (let powerUp of powerUps) {
        push();
        translate(powerUp.x, powerUp.y);
        rotate(powerUp.rotation);
        
        if (powerUp.type === 'health') {
            fill(COLORS.powerUp);
            stroke(COLORS.powerUp);
            // Draw as cross/plus sign
            rectMode(CENTER);
            rect(0, 0, powerUp.size * 2, powerUp.size * 0.5);
            rect(0, 0, powerUp.size * 0.5, powerUp.size * 2);
        } else if (powerUp.type === 'weapon') {
            fill(COLORS.weaponPowerUp);
            stroke(COLORS.weaponPowerUp);
            // Draw as star
            beginShape();
            for (let i = 0; i < 10; i++) {
                let angle = (i * TWO_PI) / 10;
                let radius = i % 2 === 0 ? powerUp.size : powerUp.size * 0.5;
                let x = cos(angle) * radius;
                let y = sin(angle) * radius;
                vertex(x, y);
            }
            endShape(CLOSE);
        }
        pop();
    }
    
    // Draw particles
    noStroke();
    for (let particle of particles) {
        fill(particle.color);
        let alpha = map(particle.life, 0, 30, 0, 255);
        fill(red(particle.color), green(particle.color), blue(particle.color), alpha);
        ellipse(particle.x, particle.y, particle.size);
    }
    
    // Draw weapon indicator
    if (weaponTimer > 0) {
        fill(255, 255, 0);
        textAlign(CENTER, CENTER);
        textSize(16);
        text(`Weapon: ${WEAPONS[currentWeapon].name}`, width/2, 50);
        
        // Draw weapon timer bar
        let barWidth = 200;
        let barHeight = 8;
        let barX = (width - barWidth) / 2;
        let barY = 65;
        
        fill(50);
        rect(barX, barY, barWidth, barHeight);
        
        fill(255, 255, 0);
        let timerProgress = weaponTimer / 300;
        rect(barX, barY, barWidth * timerProgress, barHeight);
    }
}

function drawGameOver() {
    fill(255, 0, 0);
    textAlign(CENTER, CENTER);
    textSize(48);
    text("GAME OVER", width / 2, height / 2 - 50);
    
    fill(255);
    textSize(24);
    text(`Final Score: ${score}`, width / 2, height / 2 + 10);
    text("Press R to Restart", width / 2, height / 2 + 50);
}

function keyPressed() {
    if (gameState === 'gameOver' && (key === 'r' || key === 'R')) {
        restartGame();
    }
    
    // Weapon switching with number keys
    if (gameState === 'playing') {
        if (key === '1') currentWeapon = 'basic';
        else if (key === '2' && weaponAmmo.spread > 0) currentWeapon = 'spread';
        else if (key === '3' && weaponAmmo.rapid > 0) currentWeapon = 'rapid';
        else if (key === '4' && weaponAmmo.laser > 0) currentWeapon = 'laser';
        else if (key === '5' && weaponAmmo.homing > 0) currentWeapon = 'homing';
        updateUI();
    }
}

function restartGame() {
    gameState = 'playing';
    score = 0;
    lives = 3;
    gameSpeed = 1;
    currentWeapon = 'basic';
    weaponTimer = 0;
    
    // Reset weapon ammo
    weaponAmmo = {
        basic: Infinity,
        spread: 50,
        rapid: 100,
        laser: 30,
        homing: 20
    };
    
    player.x = width / 2;
    player.y = height - 50;
    player.invulnerable = 0;
    
    bullets = [];
    enemies = [];
    particles = [];
    powerUps = [];
    enemySpawnTimer = 0;
    powerUpSpawnTimer = 0;
    
    updateUI();
}

function updateUI() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('lives').textContent = `Lives: ${lives}`;
    
    // Update weapon display
    let weaponDisplay = `${WEAPONS[currentWeapon].name}`;
    if (weaponAmmo[currentWeapon] !== Infinity) {
        weaponDisplay += ` (${weaponAmmo[currentWeapon]})`;
    }
    
    // Update or create weapon info element
    let weaponInfo = document.getElementById('weapon-info');
    if (!weaponInfo) {
        weaponInfo = document.createElement('span');
        weaponInfo.id = 'weapon-info';
        document.querySelector('.score-display').appendChild(weaponInfo);
    }
    weaponInfo.textContent = `Weapon: ${weaponDisplay}`;
} 