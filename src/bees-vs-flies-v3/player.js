class Player {
    constructor(x, y, team) {
        this.x = x;
        this.y = y;
        this.team = team;
        this.velocity = { x: 0, y: 0 };
        this.speed = 2;
        this.maxSpeed = 4;
        this.friction = 0.85;
        this.acceleration = 0.3;
        this.size = 24;
        this.health = 3;
        this.maxHealth = 3;
        this.lastAttackTime = 0;
        this.attackCooldown = 1000;
        this.invincibleUntil = 0;
        this.respawnTime = 3000;
        this.deathTime = 0;
        this.isDead = false;
        this.hasFlag = false;
        this.carriedFlag = null;
        this.showAttackRange = false;
        this.spawnX = x;
        this.spawnY = y;
        
        
        // Input state
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            attack: false
        };
    }
    
    update() {
        if (this.isDead) {
            if (millis() - this.deathTime > this.respawnTime) {
                this.respawn();
            }
            return;
        }
        
        this.handleInput();
        this.updateMovement();
        this.checkBoundaries();
    }
    
    handleInput() {
        let inputX = 0;
        let inputY = 0;
        
        if (this.keys.up) inputY -= 1;
        if (this.keys.down) inputY += 1;
        if (this.keys.left) inputX -= 1;
        if (this.keys.right) inputX += 1;
        
        // Normalize diagonal movement
        if (inputX !== 0 && inputY !== 0) {
            inputX *= 0.707;
            inputY *= 0.707;
        }
        
        // Apply acceleration
        this.velocity.x += inputX * this.acceleration;
        this.velocity.y += inputY * this.acceleration;
        
        // Limit speed
        let speed = sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }
    }
    
    updateMovement() {
        // Store old position
        let oldX = this.x;
        let oldY = this.y;
        
        // Update position
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        
        // Check for collisions
        if (gameMap.checkCollision(this.x, this.y, this.size / 2)) {
            this.x = oldX;
            this.y = oldY;
            this.velocity.x = 0;
            this.velocity.y = 0;
        }
        
        // Apply friction
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        
        // Stop very small movements
        if (abs(this.velocity.x) < 0.1) this.velocity.x = 0;
        if (abs(this.velocity.y) < 0.1) this.velocity.y = 0;
    }
    
    checkBoundaries() {
        let bounds = gameMap.getBounds();
        let radius = this.size / 2;
        
        if (this.x - radius < bounds.left) {
            this.x = bounds.left + radius;
            this.velocity.x = 0;
        }
        if (this.x + radius > bounds.right) {
            this.x = bounds.right - radius;
            this.velocity.x = 0;
        }
        if (this.y - radius < bounds.top) {
            this.y = bounds.top + radius;
            this.velocity.y = 0;
        }
        if (this.y + radius > bounds.bottom) {
            this.y = bounds.bottom - radius;
            this.velocity.y = 0;
        }
    }
    
    draw() {
        if (this.isDead) return;
        
        push();
        
        // Flash when invincible
        if (this.isInvincible() && millis() % 200 < 100) {
            tint(255, 100);
        }
        
        if (this.team === 'bee') {
            graphics.drawBee(this.x, this.y, this.size, this.health, this.maxHealth);
        } else {
            graphics.drawFly(this.x, this.y, this.size, this.health, this.maxHealth);
        }
        
        pop();
    }
    
    canAttack() {
        return !this.isDead && millis() - this.lastAttackTime > this.attackCooldown;
    }
    
    attack() {
        this.lastAttackTime = millis();
    }
    
    takeDamage(damage) {
        if (this.isInvincible() || this.isDead) return;
        
        this.health -= damage;
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true;
        this.deathTime = millis();
        this.health = 0;
        
        // Drop flag if carrying one
        if (this.hasFlag && this.carriedFlag) {
            this.carriedFlag.drop();
        }
    }
    
    respawn() {
        this.isDead = false;
        this.health = this.maxHealth;
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.invincibleUntil = millis() + 2000; // 2 seconds of invincibility
    }
    
    makeInvincible(duration) {
        this.invincibleUntil = millis() + duration;
    }
    
    isInvincible() {
        return millis() < this.invincibleUntil;
    }
    
    isInOwnBase() {
        return gameMap.isInBase(this.x, this.y, this.team);
    }
    
    setKeyState(key, state) {
        switch(key) {
            case 'w':
            case 'W':
                this.keys.up = state;
                break;
            case 's':
            case 'S':
                this.keys.down = state;
                break;
            case 'a':
            case 'A':
                this.keys.left = state;
                break;
            case 'd':
            case 'D':
                this.keys.right = state;
                break;
            case ' ':
                this.keys.attack = state;
                break;
        }
    }
    
    getAttackCooldownPercent() {
        let timeSinceAttack = millis() - this.lastAttackTime;
        return constrain(timeSinceAttack / this.attackCooldown, 0, 1);
    }
}