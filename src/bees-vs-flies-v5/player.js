class Player {
    constructor(team, x, y, isPlayer = false) {
        this.team = team;
        this.x = x;
        this.y = y;
        this.size = 15;
        this.speed = isPlayer ? 3 : 2.5;
        this.health = 100;
        this.maxHealth = 100;
        this.isPlayer = isPlayer;
        this.angle = 0;
        this.targetAngle = 0;
        
        // Combat
        this.attackDamage = 25;
        this.attackRange = 40;
        this.attackCooldown = 0;
        this.attackCooldownMax = 60;
        
        // Movement
        this.velocity = createVector(0, 0);
        this.acceleration = createVector(0, 0);
        this.maxSpeed = this.speed;
        this.friction = 0.9;
        
        // Flag carrying
        this.carryingFlag = null;
        this.flagOffset = createVector(0, -25);
        
        // AI properties
        this.aiState = 'idle';
        this.aiTarget = null;
        this.aiStateTimer = 0;
        this.lastAttackTime = 0;
        
        // Animation
        this.animationPhase = random(TWO_PI);
        this.hurtTimer = 0;
        
        // Spawn protection
        this.spawnProtection = 120;
        
        // Collision logging throttle
        this.collisionCooldown = 0;
    }
    
    update() {
        this.spawnProtection = max(0, this.spawnProtection - 1);
        this.attackCooldown = max(0, this.attackCooldown - 1);
        this.hurtTimer = max(0, this.hurtTimer - 1);
        this.collisionCooldown = max(0, this.collisionCooldown - 1);
        
        if (this.isPlayer) {
            this.handlePlayerInput();
        } else {
            this.handleAI();
        }
        
        this.updateMovement();
        this.updateFlag();
        this.animationPhase += 0.1;
    }
    
    handlePlayerInput() {
        let input = createVector(0, 0);
        
        if (keyIsDown(87) || keyIsDown(UP_ARROW)) input.y = -1;
        if (keyIsDown(83) || keyIsDown(DOWN_ARROW)) input.y = 1;
        if (keyIsDown(65) || keyIsDown(LEFT_ARROW)) input.x = -1;
        if (keyIsDown(68) || keyIsDown(RIGHT_ARROW)) input.x = 1;
        
        if (input.mag() > 0) {
            input.normalize();
            this.acceleration = input.mult(0.5);
            this.targetAngle = atan2(input.y, input.x);
        } else {
            this.acceleration.mult(0);
        }
        
        // Attack
        if (keyIsDown(32) && this.attackCooldown <= 0) {
            this.attack();
        }
    }
    
    handleAI() {
        this.aiStateTimer--;
        
        // Find nearest enemy
        let nearestEnemy = this.findNearestEnemy();
        let nearestFlag = this.findNearestFlag();
        
        let oldState = this.aiState;
        
        // State machine
        switch (this.aiState) {
            case 'idle':
                if (nearestEnemy && dist(this.x, this.y, nearestEnemy.x, nearestEnemy.y) < 100) {
                    this.aiState = 'combat';
                    this.aiTarget = nearestEnemy;
                } else if (nearestFlag && !this.carryingFlag) {
                    this.aiState = 'capture';
                    this.aiTarget = nearestFlag;
                } else if (this.carryingFlag) {
                    this.aiState = 'return';
                }
                break;
                
            case 'combat':
                if (!nearestEnemy || dist(this.x, this.y, nearestEnemy.x, nearestEnemy.y) > 150) {
                    this.aiState = 'idle';
                    this.aiTarget = null;
                } else {
                    this.moveTowards(nearestEnemy.x, nearestEnemy.y);
                    if (dist(this.x, this.y, nearestEnemy.x, nearestEnemy.y) < this.attackRange) {
                        this.attack();
                    }
                }
                break;
                
            case 'capture':
                if (this.carryingFlag) {
                    this.aiState = 'return';
                } else if (nearestFlag) {
                    this.moveTowards(nearestFlag.x, nearestFlag.y);
                } else {
                    this.aiState = 'idle';
                }
                break;
                
            case 'return':
                if (!this.carryingFlag) {
                    this.aiState = 'idle';
                } else {
                    let base = this.team === 'bee' ? gameMap.beeBase : gameMap.flyBase;
                    this.moveTowards(base.x + base.width/2, base.y + base.height/2);
                }
                break;
        }
        
        // Log AI state changes
        if (oldState !== this.aiState) {
            eventLogger.logAIStateChange(this, oldState, this.aiState, this.getStateChangeReason(oldState, nearestEnemy, nearestFlag));
        }
    }
    
    getStateChangeReason(oldState, nearestEnemy, nearestFlag) {
        if (this.aiState === 'combat' && nearestEnemy) return 'ENEMY_DETECTED';
        if (this.aiState === 'capture' && nearestFlag) return 'FLAG_FOUND';
        if (this.aiState === 'return' && this.carryingFlag) return 'FLAG_PICKED_UP';
        if (this.aiState === 'idle' && oldState === 'combat') return 'ENEMY_LOST';
        if (this.aiState === 'idle' && oldState === 'return') return 'FLAG_DELIVERED';
        return 'UNKNOWN';
    }
    
    moveTowards(targetX, targetY) {
        let direction = createVector(targetX - this.x, targetY - this.y);
        if (direction.mag() > 5) {
            direction.normalize();
            this.acceleration = direction.mult(0.4);
            this.targetAngle = atan2(direction.y, direction.x);
        }
    }
    
    findNearestEnemy() {
        let nearest = null;
        let minDist = Infinity;
        
        for (let player of game.players) {
            if (player.team !== this.team && player.health > 0) {
                let d = dist(this.x, this.y, player.x, player.y);
                if (d < minDist) {
                    minDist = d;
                    nearest = player;
                }
            }
        }
        
        return nearest;
    }
    
    findNearestFlag() {
        let enemyFlag = this.team === 'bee' ? game.flyFlag : game.beeFlag;
        if (enemyFlag && !enemyFlag.isCarried) {
            return enemyFlag;
        }
        return null;
    }
    
    updateMovement() {
        // Apply acceleration
        this.velocity.add(this.acceleration);
        this.velocity.limit(this.maxSpeed);
        
        // Calculate new position
        let newX = this.x + this.velocity.x;
        let newY = this.y + this.velocity.y;
        
        // Check collision
        let collisionOccurred = false;
        
        if (!gameMap.checkCollision(newX, this.y, this.size)) {
            this.x = newX;
        } else {
            this.velocity.x = 0;
            collisionOccurred = true;
        }
        
        if (!gameMap.checkCollision(this.x, newY, this.size)) {
            this.y = newY;
        } else {
            this.velocity.y = 0;
            collisionOccurred = true;
        }
        
        // Log collision only if cooldown has passed
        if (collisionOccurred && this.collisionCooldown <= 0) {
            eventLogger.logCollision(this, 'OBSTACLE', {x: this.x, y: this.y});
            this.collisionCooldown = 300; // 5 seconds at 60fps
        }
        
        // Apply friction
        this.velocity.mult(this.friction);
        
        // Update angle smoothly
        this.angle = lerp(this.angle, this.targetAngle, 0.1);
    }
    
    updateFlag() {
        if (this.carryingFlag) {
            this.carryingFlag.x = this.x + this.flagOffset.x;
            this.carryingFlag.y = this.y + this.flagOffset.y;
        }
    }
    
    attack() {
        if (this.attackCooldown > 0) return;
        
        this.attackCooldown = this.attackCooldownMax;
        
        // Find targets in range
        for (let player of game.players) {
            if (player.team !== this.team && player.health > 0) {
                let distance = dist(this.x, this.y, player.x, player.y);
                if (distance < this.attackRange) {
                    player.takeDamage(this.attackDamage);
                    eventLogger.logAttack(this, player, this.attackDamage, player.health);
                    camera.shake(3);
                }
            }
        }
    }
    
    takeDamage(damage) {
        if (this.spawnProtection > 0) return;
        
        this.health -= damage;
        this.hurtTimer = 30;
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.health = 0;
        
        eventLogger.logPlayerDeath(this, !!this.carryingFlag);
        
        // Drop flag if carrying
        if (this.carryingFlag) {
            this.carryingFlag.drop();
            this.carryingFlag = null;
        }
        
        // Respawn after delay
        setTimeout(() => {
            this.respawn();
        }, 3000);
    }
    
    respawn() {
        let base = this.team === 'bee' ? gameMap.beeBase : gameMap.flyBase;
        this.x = base.x + base.width/2 + random(-30, 30);
        this.y = base.y + base.height/2 + random(-30, 30);
        this.health = this.maxHealth;
        this.spawnProtection = 120;
        this.velocity.mult(0);
        this.aiState = 'idle';
        
        eventLogger.logPlayerRespawn(this);
    }
    
    draw() {
        if (this.health <= 0) return;
        
        push();
        translate(this.x, this.y);
        rotate(this.angle);
        
        // Hurt effect
        if (this.hurtTimer > 0) {
            tint(255, 100, 100);
        }
        
        // Spawn protection effect
        if (this.spawnProtection > 0) {
            tint(255, 255, 255, 150);
        }
        
        // Draw body
        if (this.team === 'bee') {
            this.drawBee();
        } else {
            this.drawFly();
        }
        
        pop();
        
        // Draw health bar
        this.drawHealthBar();
        
        // Draw attack indicator
        if (this.attackCooldown > 0) {
            stroke(255, 0, 0);
            strokeWeight(2);
            noFill();
            circle(this.x, this.y, this.attackRange * 2);
        }
    }
    
    drawBee() {
        // Body
        fill(255, 215, 0);
        stroke(200, 165, 0);
        strokeWeight(2);
        ellipse(0, 0, this.size * 1.5, this.size);
        
        // Stripes
        fill(0);
        for (let i = 0; i < 3; i++) {
            let x = -this.size/2 + i * (this.size/3);
            ellipse(x, 0, 3, this.size);
        }
        
        // Wings
        fill(255, 255, 255, 150);
        stroke(200, 200, 200);
        strokeWeight(1);
        push();
        rotate(sin(this.animationPhase * 2) * 0.3);
        ellipse(-this.size/2, -this.size/2, this.size/2, this.size);
        ellipse(-this.size/2, this.size/2, this.size/2, this.size);
        pop();
        
        // Face
        fill(255, 215, 0);
        stroke(200, 165, 0);
        strokeWeight(2);
        ellipse(this.size/2, 0, this.size/2, this.size/2);
        
        // Eyes
        fill(0);
        noStroke();
        ellipse(this.size/2 + 3, -2, 3, 3);
        ellipse(this.size/2 + 3, 2, 3, 3);
    }
    
    drawFly() {
        // Body
        fill(80, 50, 30);
        stroke(60, 30, 10);
        strokeWeight(2);
        ellipse(0, 0, this.size * 1.2, this.size);
        
        // Wings
        fill(100, 100, 100, 100);
        stroke(70, 70, 70);
        strokeWeight(1);
        push();
        rotate(sin(this.animationPhase * 3) * 0.4);
        ellipse(-this.size/3, -this.size/3, this.size/3, this.size/2);
        ellipse(-this.size/3, this.size/3, this.size/3, this.size/2);
        pop();
        
        // Head
        fill(60, 40, 20);
        stroke(40, 20, 0);
        strokeWeight(2);
        ellipse(this.size/2, 0, this.size/3, this.size/3);
        
        // Eyes
        fill(255, 0, 0);
        noStroke();
        ellipse(this.size/2 + 2, -1, 2, 2);
        ellipse(this.size/2 + 2, 1, 2, 2);
    }
    
    drawHealthBar() {
        if (this.health >= this.maxHealth) return;
        
        let barWidth = 30;
        let barHeight = 4;
        let x = this.x - barWidth/2;
        let y = this.y - this.size - 10;
        
        // Background
        fill(255, 0, 0);
        noStroke();
        rect(x, y, barWidth, barHeight);
        
        // Health
        fill(0, 255, 0);
        rect(x, y, barWidth * (this.health / this.maxHealth), barHeight);
        
        // Border
        stroke(0);
        strokeWeight(1);
        noFill();
        rect(x, y, barWidth, barHeight);
    }
}