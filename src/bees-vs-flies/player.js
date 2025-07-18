class Player {
    constructor(team, x, y, isPlayer = false) {
        this.team = team;
        this.x = x;
        this.y = y;
        this.size = 15;
        this.speed = 2;
        this.health = 3;
        this.maxHealth = 3;
        this.hasFlag = false;
        this.isDead = false;
        this.isPlayer = isPlayer;
        
        // Movement
        this.vx = 0;
        this.vy = 0;
        this.acceleration = 0.3;
        this.friction = 0.8;
        
        // Combat
        this.lastAttack = 0;
        this.lastHit = 0;
        this.isAttacking = false;
        this.knockbackX = 0;
        this.knockbackY = 0;
        
        // Respawn
        this.respawnTime = 0;
        this.spawnX = x;
        this.spawnY = y;
        
        // Input
        this.keys = {};
    }
    
    update() {
        if (this.isDead) {
            if (millis() > this.respawnTime) {
                this.respawn();
            }
            return;
        }
        
        // Handle input for player
        if (this.isPlayer) {
            this.handleInput();
        }
        
        // Apply knockback
        if (abs(this.knockbackX) > 0.1 || abs(this.knockbackY) > 0.1) {
            this.vx += this.knockbackX;
            this.vy += this.knockbackY;
            this.knockbackX *= 0.8;
            this.knockbackY *= 0.8;
        }
        
        // Apply friction
        this.vx *= this.friction;
        this.vy *= this.friction;
        
        // Move
        const newX = this.x + this.vx;
        const newY = this.y + this.vy;
        
        // Check collisions
        if (!gameMap.checkCollision(newX - this.size, newY - this.size, this.size * 2, this.size * 2)) {
            this.x = newX;
            this.y = newY;
        }
        
        // Reset attack animation
        if (millis() - this.lastAttack > 200) {
            this.isAttacking = false;
        }
        
        // Check flag pickup
        this.checkFlagPickup();
        
        // Check flag capture
        this.checkFlagCapture();
    }
    
    handleInput() {
        // Movement
        if (this.keys['w'] || this.keys['ArrowUp']) {
            this.vy -= this.acceleration;
        }
        if (this.keys['s'] || this.keys['ArrowDown']) {
            this.vy += this.acceleration;
        }
        if (this.keys['a'] || this.keys['ArrowLeft']) {
            this.vx -= this.acceleration;
        }
        if (this.keys['d'] || this.keys['ArrowRight']) {
            this.vx += this.acceleration;
        }
        
        // Limit speed
        const speed = sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > this.speed) {
            this.vx = (this.vx / speed) * this.speed;
            this.vy = (this.vy / speed) * this.speed;
        }
    }
    
    attack() {
        if (this.isDead) return false;
        return game.combat.attack(this, game.players);
    }
    
    checkFlagPickup() {
        if (this.hasFlag) return;
        
        const enemyFlag = this.team === 'bee' ? game.flyFlag : game.beeFlag;
        if (enemyFlag.canBePickedUp(this)) {
            enemyFlag.pickUp(this);
        }
    }
    
    checkFlagCapture() {
        if (!this.hasFlag) return;
        
        // Check if in own base
        if (gameMap.isInBase(this.x, this.y, this.team)) {
            // Check if own flag is at base
            const ownFlag = this.team === 'bee' ? game.beeFlag : game.flyFlag;
            if (ownFlag.isAtBase) {
                // Score!
                this.hasFlag = false;
                const enemyFlag = this.team === 'bee' ? game.flyFlag : game.beeFlag;
                enemyFlag.returnToBase();
                game.score(this.team);
            }
        }
    }
    
    respawn() {
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.health = this.maxHealth;
        this.isDead = false;
        this.vx = 0;
        this.vy = 0;
        this.knockbackX = 0;
        this.knockbackY = 0;
        this.lastHit = 0;
    }
    
    draw() {
        if (this.isDead) return;
        
        push();
        translate(this.x, this.y);
        
        // Draw invincibility effect
        if (game.combat.isInvincible(this)) {
            const alpha = 100 + sin(millis() * 0.02) * 100;
            fill(255, 255, 255, alpha);
            ellipse(0, 0, this.size * 3, this.size * 3);
        }
        
        // Draw attack range when attacking
        if (this.isAttacking) {
            fill(255, 0, 0, 50);
            ellipse(0, 0, game.combat.attackRange * 2, game.combat.attackRange * 2);
        }
        
        // Draw player
        graphics.drawPlayer(this);
        
        // Draw flag if carrying
        if (this.hasFlag) {
            push();
            translate(0, -this.size - 15);
            const flagTeam = this.team === 'bee' ? 'fly' : 'bee';
            
            // Flag pole
            stroke(139, 69, 19);
            strokeWeight(2);
            line(0, 0, 0, -20);
            
            // Flag
            fill(flagTeam === 'bee' ? color(255, 215, 0) : color(139, 69, 19));
            stroke(0);
            strokeWeight(1);
            triangle(0, -20, 15, -17, 0, -14);
            pop();
        }
        
        // Draw health bar
        this.drawHealthBar();
        
        pop();
    }
    
    drawHealthBar() {
        if (this.health === this.maxHealth) return;
        
        push();
        translate(0, -this.size - 25);
        
        // Background
        fill(255, 0, 0);
        rect(-10, -3, 20, 6);
        
        // Health
        fill(0, 255, 0);
        rect(-10, -3, (this.health / this.maxHealth) * 20, 6);
        
        // Border
        stroke(0);
        strokeWeight(1);
        noFill();
        rect(-10, -3, 20, 6);
        
        pop();
    }
}