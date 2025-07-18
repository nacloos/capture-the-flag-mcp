class Flag {
    constructor(team, x, y) {
        this.team = team;
        this.homeX = x;
        this.homeY = y;
        this.x = x;
        this.y = y;
        this.isAtBase = true;
        this.isCarried = false;
        this.dropTime = 0;
        this.returnTime = 30000; // 30 seconds to return
        this.size = 20;
    }
    
    update() {
        // Auto-return flag if dropped for too long
        if (!this.isAtBase && !this.isCarried && millis() - this.dropTime > this.returnTime) {
            this.returnToBase();
        }
    }
    
    returnToBase() {
        this.x = this.homeX;
        this.y = this.homeY;
        this.isAtBase = true;
        this.isCarried = false;
        this.dropTime = 0;
    }
    
    canBePickedUp(player) {
        // Can't pick up own flag
        if (player.team === this.team) return false;
        
        // Can't pick up if already carrying a flag
        if (player.hasFlag) return false;
        
        // Check if close enough
        const distance = dist(player.x, player.y, this.x, this.y);
        return distance <= this.size + player.size;
    }
    
    pickUp(player) {
        if (!this.canBePickedUp(player)) return false;
        
        this.isCarried = true;
        this.isAtBase = false;
        player.hasFlag = true;
        return true;
    }
    
    drop(x, y) {
        this.x = x;
        this.y = y;
        this.isCarried = false;
        this.isAtBase = false;
        this.dropTime = millis();
    }
    
    draw() {
        if (this.isCarried) return;
        
        push();
        translate(this.x, this.y);
        
        // Flag pole
        stroke(139, 69, 19);
        strokeWeight(3);
        line(0, 0, 0, -30);
        
        // Flag
        fill(this.team === 'bee' ? color(255, 215, 0) : color(139, 69, 19));
        stroke(0);
        strokeWeight(1);
        triangle(0, -30, 20, -25, 0, -20);
        
        // Pulsing effect if dropped
        if (!this.isAtBase) {
            const pulseAlpha = 100 + sin(millis() * 0.01) * 50;
            fill(255, 0, 0, pulseAlpha);
            ellipse(0, 0, this.size * 2, this.size * 2);
        }
        
        pop();
    }
}