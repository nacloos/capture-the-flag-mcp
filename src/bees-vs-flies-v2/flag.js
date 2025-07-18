class Flag {
    constructor(team, homeX, homeY) {
        this.team = team;
        this.homeX = homeX;
        this.homeY = homeY;
        this.x = homeX;
        this.y = homeY;
        this.state = 'home'; // 'home', 'carried', 'dropped'
        this.carrier = null;
        this.dropTime = 0;
        this.returnTime = 30000; // 30 seconds
        this.size = 40;
        this.bobOffset = 0;
        this.bobSpeed = 0.05;
    }
    
    update() {
        this.bobOffset += this.bobSpeed;
        
        if (this.state === 'carried' && this.carrier) {
            this.x = this.carrier.x;
            this.y = this.carrier.y - 30;
        } else if (this.state === 'dropped') {
            // Check if flag should return to base
            if (millis() - this.dropTime > this.returnTime) {
                this.returnToBase();
            }
        }
    }
    
    draw() {
        let drawY = this.y + sin(this.bobOffset) * 3;
        graphics.drawFlag(this.x, drawY, this.team, this.size);
        
        // Draw pickup indicator for enemy team
        if (this.state !== 'carried') {
            push();
            stroke(255, 255, 0, 150);
            strokeWeight(2);
            noFill();
            ellipse(this.x, this.y, 60);
            pop();
        }
    }
    
    canPickup(player) {
        if (this.state === 'carried') return false;
        if (player.team === this.team) return false;
        if (player.hasFlag) return false;
        
        let distance = dist(player.x, player.y, this.x, this.y);
        return distance < 30;
    }
    
    pickup(player) {
        if (!this.canPickup(player)) return false;
        
        this.state = 'carried';
        this.carrier = player;
        player.hasFlag = true;
        player.carriedFlag = this;
        
        return true;
    }
    
    drop() {
        if (this.state !== 'carried') return;
        
        this.state = 'dropped';
        this.dropTime = millis();
        this.carrier.hasFlag = false;
        this.carrier.carriedFlag = null;
        this.carrier = null;
    }
    
    returnToBase() {
        this.state = 'home';
        this.x = this.homeX;
        this.y = this.homeY;
        this.dropTime = 0;
        
        if (this.carrier) {
            this.carrier.hasFlag = false;
            this.carrier.carriedFlag = null;
            this.carrier = null;
        }
    }
    
    isAtHome() {
        return this.state === 'home';
    }
    
    isCarried() {
        return this.state === 'carried';
    }
    
    isDropped() {
        return this.state === 'dropped';
    }
    
    getTimeUntilReturn() {
        if (this.state !== 'dropped') return 0;
        return Math.max(0, this.returnTime - (millis() - this.dropTime));
    }
}