class Player {
    constructor(team, x, y, isPlayer = false) {
        this.team = team;
        this.x = x;
        this.y = y;
        this.size = 15;
        this.speed = isPlayer ? 3 : 2.8;
        this.health = 100;
        this.maxHealth = 100;
        this.isPlayer = isPlayer;
        this.angle = 0;
        this.targetAngle = 0;
        
        // Combat
        this.attackDamage = 25;
        this.attackRange = 40;
        this.attackCooldown = 0;
        this.attackCooldownMax = isPlayer ? 60 : 45;
        
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
        
        // Stuck detection and recovery
        this.positionHistory = [];
        this.stuckTimer = 0;
        this.unstuckAttempts = 0;
        this.lastValidPosition = {x: x, y: y};
    }
    
    update() {
        this.spawnProtection = max(0, this.spawnProtection - 1);
        this.attackCooldown = max(0, this.attackCooldown - 1);
        this.hurtTimer = max(0, this.hurtTimer - 1);
        this.collisionCooldown = max(0, this.collisionCooldown - 1);
        
        // Update stuck detection
        this.updateStuckDetection();
        
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
        
        // Find nearest enemy and flag
        let nearestEnemy = this.findNearestEnemy();
        let nearestFlag = this.findNearestFlag();
        let teamMates = this.findTeamMates();
        
        let oldState = this.aiState;
        
        // Enhanced AI decision making with team coordination
        switch (this.aiState) {
            case 'idle':
                // Priority 1: Defend if enemy has our flag
                if (this.shouldDefend()) {
                    this.aiState = 'defend';
                    this.aiTarget = nearestEnemy;
                }
                // Priority 2: Attack nearby enemies
                else if (nearestEnemy && dist(this.x, this.y, nearestEnemy.x, nearestEnemy.y) < 120) {
                    this.aiState = 'combat';
                    this.aiTarget = nearestEnemy;
                }
                // Priority 3: Capture flag if available
                else if (nearestFlag && !this.carryingFlag && this.shouldCapture(teamMates)) {
                    this.aiState = 'capture';
                    this.aiTarget = nearestFlag;
                }
                // Priority 4: Return flag if carrying
                else if (this.carryingFlag) {
                    this.aiState = 'return';
                }
                // Priority 5: Patrol or hunt
                else {
                    this.aiState = 'patrol';
                }
                break;
                
            case 'combat':
                if (!nearestEnemy || dist(this.x, this.y, nearestEnemy.x, nearestEnemy.y) > 180) {
                    this.aiState = 'idle';
                    this.aiTarget = null;
                } else {
                    this.moveTowards(nearestEnemy.x, nearestEnemy.y);
                    if (dist(this.x, this.y, nearestEnemy.x, nearestEnemy.y) < this.attackRange) {
                        this.attack();
                    }
                }
                break;
                
            case 'defend':
                if (!nearestEnemy || !this.shouldDefend()) {
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
                
            case 'patrol':
                if (nearestEnemy && dist(this.x, this.y, nearestEnemy.x, nearestEnemy.y) < 150) {
                    this.aiState = 'combat';
                    this.aiTarget = nearestEnemy;
                } else {
                    this.patrol();
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
        if (this.aiState === 'defend') return 'DEFENDING_FLAG';
        if (this.aiState === 'capture' && nearestFlag) return 'FLAG_FOUND';
        if (this.aiState === 'return' && this.carryingFlag) return 'FLAG_PICKED_UP';
        if (this.aiState === 'patrol') return 'PATROLLING';
        if (this.aiState === 'idle' && oldState === 'combat') return 'ENEMY_LOST';
        if (this.aiState === 'idle' && oldState === 'return') return 'FLAG_DELIVERED';
        return 'UNKNOWN';
    }
    
    moveTowards(targetX, targetY) {
        let direction = createVector(targetX - this.x, targetY - this.y);
        
        // Check if we need to find alternative path
        if (this.stuckTimer > 180) { // 3 seconds
            direction = this.findAlternativePath(targetX, targetY);
        }
        
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
    
    findTeamMates() {
        return game.players.filter(p => p.team === this.team && p !== this && p.health > 0);
    }
    
    shouldDefend() {
        // Check if enemy has our flag
        let ourFlag = this.team === 'bee' ? game.beeFlag : game.flyFlag;
        if (ourFlag && ourFlag.isCarried) {
            // Find flag carrier
            let flagCarrier = game.players.find(p => p.carryingFlag === ourFlag);
            if (flagCarrier && flagCarrier.team !== this.team) {
                return true;
            }
        }
        return false;
    }
    
    shouldCapture(teamMates) {
        // Don't send all team members to capture - leave some to defend
        let capturingTeamMates = teamMates.filter(tm => tm.aiState === 'capture');
        return capturingTeamMates.length < 2; // Maximum 2 team members capturing
    }
    
    patrol() {
        // Patrol around strategic areas
        if (!this.patrolTarget || dist(this.x, this.y, this.patrolTarget.x, this.patrolTarget.y) < 50) {
            this.selectNewPatrolTarget();
        }
        
        if (this.patrolTarget) {
            this.moveTowards(this.patrolTarget.x, this.patrolTarget.y);
        }
    }
    
    selectNewPatrolTarget() {
        let patrolPoints = [
            // Around enemy base
            {x: this.team === 'bee' ? gameMap.flyBase.x : gameMap.beeBase.x, 
             y: this.team === 'bee' ? gameMap.flyBase.y : gameMap.beeBase.y},
            // Center of map
            {x: gameMap.width / 2, y: gameMap.height / 2},
            // Around our base
            {x: this.team === 'bee' ? gameMap.beeBase.x : gameMap.flyBase.x, 
             y: this.team === 'bee' ? gameMap.beeBase.y : gameMap.flyBase.y},
            // Random strategic points
            {x: gameMap.width / 4, y: gameMap.height / 4},
            {x: gameMap.width * 3/4, y: gameMap.height * 3/4}
        ];
        
        this.patrolTarget = patrolPoints[Math.floor(Math.random() * patrolPoints.length)];
        
        // Add some randomness to avoid predictable behavior
        this.patrolTarget.x += random(-100, 100);
        this.patrolTarget.y += random(-100, 100);
        
        // Ensure patrol target is within bounds
        this.patrolTarget.x = constrain(this.patrolTarget.x, 50, gameMap.width - 50);
        this.patrolTarget.y = constrain(this.patrolTarget.y, 50, gameMap.height - 50);
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
        
        // Handle collision with bounce-back and recovery
        if (collisionOccurred) {
            this.handleCollisionRecovery();
            
            // Log collision only if cooldown has passed
            if (this.collisionCooldown <= 0) {
                eventLogger.logCollision(this, 'OBSTACLE', {x: this.x, y: this.y});
                this.collisionCooldown = 300; // 5 seconds at 60fps
            }
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
        
        // Draw stuck indicator for debugging
        if (this.stuckTimer > 120) {
            stroke(255, 255, 0);
            strokeWeight(3);
            noFill();
            circle(this.x, this.y, this.size * 3);
        }
    }
    
    updateStuckDetection() {
        // Track position history
        this.positionHistory.push({x: this.x, y: this.y, time: frameCount});
        
        // Keep only last 3 seconds of history
        this.positionHistory = this.positionHistory.filter(pos => frameCount - pos.time < 180);
        
        // Check if stuck (not moving much)
        if (this.positionHistory.length > 60) { // 1 second
            let oldPos = this.positionHistory[0];
            let distMoved = dist(this.x, this.y, oldPos.x, oldPos.y);
            
            if (distMoved < 5) {
                this.stuckTimer++;
            } else {
                this.stuckTimer = 0;
                this.unstuckAttempts = 0;
                this.lastValidPosition = {x: this.x, y: this.y};
            }
        }
        
        // Handle stuck situations
        if (this.stuckTimer > 300) { // 5 seconds
            this.handleStuckRecovery();
        }
    }
    
    handleCollisionRecovery() {
        // Bounce back slightly
        this.velocity.mult(-0.3);
        
        // Add small random offset to break collision loops
        let randomOffset = createVector(random(-2, 2), random(-2, 2));
        this.x += randomOffset.x;
        this.y += randomOffset.y;
        
        // Ensure we don't go out of bounds
        this.x = constrain(this.x, 20, gameMap.width - 20);
        this.y = constrain(this.y, 20, gameMap.height - 20);
    }
    
    findAlternativePath(targetX, targetY) {
        // Try different angles to find a path around obstacles
        let baseDirection = createVector(targetX - this.x, targetY - this.y);
        baseDirection.normalize();
        
        let angles = [-PI/2, PI/2, -PI/4, PI/4, -3*PI/4, 3*PI/4];
        
        for (let angle of angles) {
            let testDirection = baseDirection.copy();
            testDirection.rotate(angle);
            
            let testX = this.x + testDirection.x * 30;
            let testY = this.y + testDirection.y * 30;
            
            if (!gameMap.checkCollision(testX, testY, this.size)) {
                return testDirection;
            }
        }
        
        // If no clear path, try random direction
        return createVector(random(-1, 1), random(-1, 1));
    }
    
    handleStuckRecovery() {
        this.unstuckAttempts++;
        
        if (this.unstuckAttempts < 3) {
            // Try to move to a nearby clear position
            let attempts = 0;
            let found = false;
            
            while (attempts < 20 && !found) {
                let newX = this.x + random(-50, 50);
                let newY = this.y + random(-50, 50);
                
                if (!gameMap.checkCollision(newX, newY, this.size)) {
                    this.x = newX;
                    this.y = newY;
                    found = true;
                }
                attempts++;
            }
        } else {
            // Last resort: teleport to last valid position or base
            if (this.lastValidPosition) {
                this.x = this.lastValidPosition.x;
                this.y = this.lastValidPosition.y;
            } else {
                let base = this.team === 'bee' ? gameMap.beeBase : gameMap.flyBase;
                this.x = base.x + base.width/2 + random(-20, 20);
                this.y = base.y + base.height/2 + random(-20, 20);
            }
        }
        
        this.stuckTimer = 0;
        this.velocity.mult(0);
        this.aiState = 'idle';
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