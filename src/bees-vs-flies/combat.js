class Combat {
    constructor() {
        this.attackRange = 40;
        this.attackCooldown = 1000; // 1 second
        this.invincibilityTime = 500; // 0.5 seconds
        this.knockbackForce = 15;
    }
    
    canAttack(player) {
        return millis() - player.lastAttack > this.attackCooldown;
    }
    
    attack(attacker, players) {
        if (!this.canAttack(attacker)) return false;
        
        attacker.lastAttack = millis();
        attacker.isAttacking = true;
        
        // Find enemies in range
        for (let player of players) {
            if (player.team !== attacker.team && player.health > 0) {
                const distance = dist(attacker.x, attacker.y, player.x, player.y);
                if (distance <= this.attackRange) {
                    this.damagePlayer(player, attacker);
                }
            }
        }
        
        return true;
    }
    
    damagePlayer(player, attacker) {
        if (millis() - player.lastHit < this.invincibilityTime) return;
        
        player.health -= 1;
        player.lastHit = millis();
        
        // Apply knockback
        const angle = atan2(player.y - attacker.y, player.x - attacker.x);
        player.knockbackX = cos(angle) * this.knockbackForce;
        player.knockbackY = sin(angle) * this.knockbackForce;
        
        // Check if player is eliminated
        if (player.health <= 0) {
            this.eliminatePlayer(player);
        }
    }
    
    eliminatePlayer(player) {
        player.isDead = true;
        player.respawnTime = millis() + 3000; // 3 second respawn
        
        // Drop flag if carrying one
        if (player.hasFlag) {
            player.hasFlag = false;
            const flag = player.team === 'bee' ? game.flyFlag : game.beeFlag;
            flag.x = player.x;
            flag.y = player.y;
            flag.isAtBase = false;
            flag.isCarried = false;
            flag.dropTime = millis();
        }
    }
    
    isInvincible(player) {
        return millis() - player.lastHit < this.invincibilityTime;
    }
}