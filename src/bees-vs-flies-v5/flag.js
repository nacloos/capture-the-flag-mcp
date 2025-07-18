class Flag {
    constructor(team, x, y) {
        this.team = team;
        this.x = x;
        this.y = y;
        this.homeX = x;
        this.homeY = y;
        this.size = 20;
        this.isCarried = false;
        this.carrier = null;
        this.returnTimer = 0;
        this.returnDelay = 300; // 5 seconds at 60fps
        
        // Animation
        this.animationPhase = 0;
        this.pulsePhase = 0;
        
        // Drop mechanics
        this.dropTimer = 0;
        this.isDropped = false;
    }
    
    update() {
        this.animationPhase += 0.05;
        this.pulsePhase += 0.1;
        
        if (this.isDropped) {
            this.returnTimer--;
            if (this.returnTimer <= 0) {
                this.returnToBase();
            }
        }
        
        // Check for pickup
        if (!this.isCarried && !this.isDropped) {
            this.checkForPickup();
        }
        
        // Check for capture
        if (this.isCarried) {
            this.checkForCapture();
        }
    }
    
    checkForPickup() {
        for (let player of game.players) {
            if (player.health > 0 && player.team !== this.team) {
                let distance = dist(this.x, this.y, player.x, player.y);
                if (distance < this.size + player.size) {
                    this.pickUp(player);
                    break;
                }
            }
        }
    }
    
    checkForCapture() {
        if (!this.carrier) return;
        
        let base = this.carrier.team === 'bee' ? gameMap.beeBase : gameMap.flyBase;
        
        if (gameMap.isInBase(this.carrier.x, this.carrier.y, this.carrier.team)) {
            // Check if player's own flag is at home
            let ownFlag = this.carrier.team === 'bee' ? game.beeFlag : game.flyFlag;
            if (ownFlag.isAtHome()) {
                this.capture();
            }
        }
    }
    
    pickUp(player) {
        this.isCarried = true;
        this.carrier = player;
        player.carryingFlag = this;
        this.isDropped = false;
        this.returnTimer = 0;
        
        eventLogger.logFlagPickup(this, player);
        
        // Visual feedback
        camera.shake(5);
        
        // HUD message
        hud.addMessage(`${player.team.toUpperCase()} team picked up the ${this.team} flag!`, 
                       player.team === 'bee' ? color(255, 215, 0) : color(80, 50, 30));
    }
    
    drop() {
        if (!this.isCarried) return;
        
        eventLogger.logFlagDrop(this, 'PLAYER_DEATH');
        
        this.isCarried = false;
        this.carrier.carryingFlag = null;
        this.carrier = null;
        this.isDropped = true;
        this.returnTimer = this.returnDelay;
        
        // Visual feedback
        camera.shake(3);
        
        // HUD message
        hud.addMessage(`${this.team.toUpperCase()} flag dropped!`, 
                       this.team === 'bee' ? color(255, 215, 0) : color(80, 50, 30));
    }
    
    capture() {
        if (!this.isCarried) return;
        
        let capturingTeam = this.carrier.team;
        
        // Award points
        if (capturingTeam === 'bee') {
            game.beeScore++;
        } else {
            game.flyScore++;
        }
        
        eventLogger.logFlagCapture(this, this.carrier, {bee: game.beeScore, fly: game.flyScore});
        
        // Return flag to base
        this.returnToBase();
        
        // Visual feedback
        camera.shake(10);
        
        // HUD message
        hud.addMessage(`${capturingTeam.toUpperCase()} team captured the flag!`, 
                       capturingTeam === 'bee' ? color(255, 215, 0) : color(80, 50, 30));
        
        // Check for game end
        game.checkGameEnd();
    }
    
    returnToBase() {
        this.x = this.homeX;
        this.y = this.homeY;
        this.isCarried = false;
        this.isDropped = false;
        this.returnTimer = 0;
        
        if (this.carrier) {
            this.carrier.carryingFlag = null;
            this.carrier = null;
        }
        
        eventLogger.logFlagReturn(this, 'AUTO_RETURN');
        
        // HUD message
        hud.addMessage(`${this.team.toUpperCase()} flag returned to base!`, 
                       this.team === 'bee' ? color(255, 215, 0) : color(80, 50, 30));
    }
    
    isAtHome() {
        return !this.isCarried && !this.isDropped && 
               this.x === this.homeX && this.y === this.homeY;
    }
    
    draw() {
        push();
        translate(this.x, this.y);
        
        // Flag pole
        stroke(100, 50, 0);
        strokeWeight(3);
        line(0, 0, 0, -30);
        
        // Flag animation
        let wave = sin(this.animationPhase * 4) * 3;
        
        // Flag fabric
        fill(this.team === 'bee' ? color(255, 215, 0) : color(80, 50, 30));
        stroke(this.team === 'bee' ? color(200, 165, 0) : color(60, 30, 10));
        strokeWeight(1);
        
        beginShape();
        vertex(0, -30);
        vertex(25 + wave, -25);
        vertex(25 + wave * 0.7, -20);
        vertex(25 + wave * 0.5, -15);
        vertex(0, -10);
        endShape(CLOSE);
        
        // Glow effect if dropped
        if (this.isDropped) {
            stroke(255, 255, 0);
            strokeWeight(2);
            noFill();
            circle(0, -20, 40 + sin(this.pulsePhase) * 5);
        }
        
        // Team symbol on flag
        fill(255);
        noStroke();
        if (this.team === 'bee') {
            // Draw bee symbol
            ellipse(12, -22, 6, 4);
            fill(0);
            ellipse(10, -22, 1, 1);
            ellipse(14, -22, 1, 1);
        } else {
            // Draw fly symbol
            ellipse(12, -22, 4, 3);
            fill(255, 0, 0);
            ellipse(10, -22, 1, 1);
            ellipse(14, -22, 1, 1);
        }
        
        pop();
        
        // Return timer indicator
        if (this.isDropped && this.returnTimer > 0) {
            this.drawReturnTimer();
        }
    }
    
    drawReturnTimer() {
        let progress = this.returnTimer / this.returnDelay;
        let radius = 25;
        
        push();
        translate(this.x, this.y);
        
        // Background circle
        stroke(100);
        strokeWeight(3);
        noFill();
        circle(0, 0, radius * 2);
        
        // Progress arc
        stroke(255, 255, 0);
        strokeWeight(4);
        noFill();
        arc(0, 0, radius * 2, radius * 2, 
            -PI/2, -PI/2 + TWO_PI * (1 - progress));
        
        // Timer text
        fill(255);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(10);
        text(Math.ceil(this.returnTimer / 60), 0, 0);
        
        pop();
    }
}