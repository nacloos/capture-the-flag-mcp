class Combat {
    constructor() {
        this.attackRange = 40;
        this.attackDamage = 1;
        this.attackCooldown = 1000; // 1 second
        this.knockbackForce = 15;
        this.invincibilityTime = 500; // 0.5 seconds
        this.attackEffects = [];
    }
    
    update() {
        // Update attack effects
        for (let i = this.attackEffects.length - 1; i >= 0; i--) {
            let effect = this.attackEffects[i];
            effect.progress += 0.1;
            
            if (effect.progress >= 1) {
                this.attackEffects.splice(i, 1);
            }
        }
    }
    
    performAttack(attacker, targets) {
        if (!attacker.canAttack()) return false;
        
        let hitTargets = [];
        
        for (let target of targets) {
            if (target.team === attacker.team) continue;
            if (target.health <= 0) continue;
            if (target.isInvincible()) continue;
            
            let distance = dist(attacker.x, attacker.y, target.x, target.y);
            
            if (distance <= this.attackRange) {
                this.dealDamage(attacker, target);
                hitTargets.push(target);
            }
        }
        
        attacker.attack();
        
        // Add attack effect
        this.attackEffects.push({
            x: attacker.x,
            y: attacker.y,
            size: this.attackRange * 2,
            progress: 0
        });
        
        return hitTargets.length > 0;
    }
    
    dealDamage(attacker, target) {
        target.takeDamage(this.attackDamage);
        
        // Apply knockback
        let angle = atan2(target.y - attacker.y, target.x - attacker.x);
        target.velocity.x += cos(angle) * this.knockbackForce;
        target.velocity.y += sin(angle) * this.knockbackForce;
        
        // Make target invincible briefly
        target.makeInvincible(this.invincibilityTime);
    }
    
    drawAttackEffects() {
        for (let effect of this.attackEffects) {
            graphics.drawAttackEffect(effect.x, effect.y, effect.size, effect.progress);
        }
    }
    
    drawAttackRange(player) {
        if (player.showAttackRange) {
            push();
            stroke(255, 0, 0, 100);
            strokeWeight(2);
            noFill();
            ellipse(player.x, player.y, this.attackRange * 2);
            pop();
        }
    }
}