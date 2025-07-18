class Game {
    constructor() {
        this.players = [];
        this.flags = {};
        this.combat = new Combat();
        this.gameState = 'playing'; // 'playing', 'ended'
        this.scores = { bee: 0, fly: 0 };
        this.maxScore = 3;
        this.gameTime = 600000; // 10 minutes
        this.startTime = 0;
        this.winner = null;
        this.currentPlayer = null;
        this.enemyAI = null;
        this.aiDifficulty = 'medium';
    }
    
    init() {
        this.startTime = millis();
        
        // Create bases
        let beeBase = gameMap.getBase('bee');
        let flyBase = gameMap.getBase('fly');
        
        // Create flags
        this.flags.bee = new Flag('bee', beeBase.x, beeBase.y);
        this.flags.fly = new Flag('fly', flyBase.x, flyBase.y);
        
        // Create player
        this.currentPlayer = new Player(beeBase.x, beeBase.y, 'bee');
        this.players.push(this.currentPlayer);
        
        // Create AI enemy
        this.enemyAI = new Player(flyBase.x, flyBase.y, 'fly');
        this.players.push(this.enemyAI);
        
        // Set camera to follow player
        camera.follow(this.currentPlayer);
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // Update combat
        this.combat.update();
        
        // Update flags
        this.flags.bee.update();
        this.flags.fly.update();
        
        // Update players
        for (let player of this.players) {
            player.update();
        }
        
        // Update AI
        this.updateAI();
        
        // Check flag interactions
        this.checkFlagInteractions();
        
        // Check for captures
        this.checkCaptures();
        
        // Update camera
        camera.follow(this.currentPlayer);
        
        // Check game end conditions
        this.checkGameEnd();
    }
    
    updateAI() {
        if (!this.enemyAI || this.enemyAI.isDead) return;
        
        // Simple AI behavior
        let target = this.getAITarget();
        if (target) {
            this.moveAIToward(target);
        }
        
        // AI attack behavior
        if (this.enemyAI.canAttack()) {
            let nearbyEnemies = this.players.filter(p => 
                p.team !== this.enemyAI.team && 
                !p.isDead && 
                dist(p.x, p.y, this.enemyAI.x, this.enemyAI.y) < 50
            );
            
            if (nearbyEnemies.length > 0) {
                this.combat.performAttack(this.enemyAI, this.players);
            }
        }
    }
    
    getAITarget() {
        if (this.enemyAI.hasFlag) {
            // Return to base
            let base = gameMap.getBase(this.enemyAI.team);
            return { x: base.x, y: base.y };
        } else if (this.flags.bee.state !== 'carried' || this.flags.bee.carrier !== this.enemyAI) {
            // Go for enemy flag
            return { x: this.flags.bee.x, y: this.flags.bee.y };
        } else {
            // Go for player
            return { x: this.currentPlayer.x, y: this.currentPlayer.y };
        }
    }
    
    moveAIToward(target) {
        let dx = target.x - this.enemyAI.x;
        let dy = target.y - this.enemyAI.y;
        let distance = sqrt(dx * dx + dy * dy);
        
        if (distance > 5) {
            // Normalize and apply movement
            let moveX = (dx / distance) * this.enemyAI.acceleration;
            let moveY = (dy / distance) * this.enemyAI.acceleration;
            
            this.enemyAI.velocity.x += moveX;
            this.enemyAI.velocity.y += moveY;
        }
    }
    
    checkFlagInteractions() {
        for (let player of this.players) {
            if (player.isDead) continue;
            
            // Check pickup for enemy flag
            let enemyFlag = player.team === 'bee' ? this.flags.fly : this.flags.bee;
            if (enemyFlag.canPickup(player)) {
                enemyFlag.pickup(player);
            }
        }
    }
    
    checkCaptures() {
        for (let player of this.players) {
            if (player.hasFlag && player.isInOwnBase()) {
                let ownFlag = player.team === 'bee' ? this.flags.bee : this.flags.fly;
                
                // Can only capture if own flag is home
                if (ownFlag.isAtHome()) {
                    this.scoreCapture(player.team);
                    player.carriedFlag.returnToBase();
                }
            }
        }
    }
    
    scoreCapture(team) {
        this.scores[team]++;
        
        // Visual feedback could be added here
        console.log(`${team} team scored! Score: ${this.scores.bee} - ${this.scores.fly}`);
    }
    
    checkGameEnd() {
        // Check score limit
        if (this.scores.bee >= this.maxScore) {
            this.endGame('bee');
        } else if (this.scores.fly >= this.maxScore) {
            this.endGame('fly');
        }
        
        // Check time limit
        let timeElapsed = millis() - this.startTime;
        if (timeElapsed > this.gameTime) {
            if (this.scores.bee > this.scores.fly) {
                this.endGame('bee');
            } else if (this.scores.fly > this.scores.bee) {
                this.endGame('fly');
            } else {
                this.endGame('tie');
            }
        }
    }
    
    endGame(winner) {
        this.gameState = 'ended';
        this.winner = winner;
    }
    
    draw() {
        // Draw flags
        this.flags.bee.draw();
        this.flags.fly.draw();
        
        // Draw players
        for (let player of this.players) {
            player.draw();
        }
        
        // Draw combat effects
        this.combat.drawAttackEffects();
        
        // Draw attack range for current player
        if (this.currentPlayer && this.currentPlayer.showAttackRange) {
            this.combat.drawAttackRange(this.currentPlayer);
        }
    }
    
    drawHUD() {
        // Score display
        fill(0);
        textAlign(LEFT);
        textSize(24);
        text(`Bees: ${this.scores.bee}`, 20, 40);
        
        textAlign(RIGHT);
        text(`Flies: ${this.scores.fly}`, width - 20, 40);
        
        // Timer
        let timeRemaining = Math.max(0, this.gameTime - (millis() - this.startTime));
        let minutes = floor(timeRemaining / 60000);
        let seconds = floor((timeRemaining % 60000) / 1000);
        
        textAlign(CENTER);
        text(`${minutes}:${seconds.toString().padStart(2, '0')}`, width / 2, 40);
        
        // Player health
        if (this.currentPlayer && !this.currentPlayer.isDead) {
            textAlign(LEFT);
            textSize(16);
            text(`Health: ${this.currentPlayer.health}/${this.currentPlayer.maxHealth}`, 20, height - 60);
            
            // Attack cooldown
            let cooldownPercent = this.currentPlayer.getAttackCooldownPercent();
            fill(cooldownPercent >= 1 ? 0 : 150);
            text(`Attack: ${cooldownPercent >= 1 ? 'Ready' : 'Cooldown'}`, 20, height - 40);
        }
        
        // Flag status
        textAlign(RIGHT);
        textSize(14);
        let beeFlag = this.flags.bee.isAtHome() ? 'Home' : 
                     this.flags.bee.isCarried() ? 'Taken' : 'Dropped';
        let flyFlag = this.flags.fly.isAtHome() ? 'Home' : 
                     this.flags.fly.isCarried() ? 'Taken' : 'Dropped';
        
        text(`Bee Flag: ${beeFlag}`, width - 20, height - 60);
        text(`Fly Flag: ${flyFlag}`, width - 20, height - 40);
        
        // Instructions
        textAlign(CENTER);
        textSize(12);
        fill(100);
        text('WASD: Move, Space: Attack', width / 2, height - 20);
        
        // Game over screen
        if (this.gameState === 'ended') {
            this.drawGameOverScreen();
        }
    }
    
    drawGameOverScreen() {
        // Semi-transparent overlay
        fill(0, 0, 0, 150);
        rect(0, 0, width, height);
        
        // Game over text
        fill(255);
        textAlign(CENTER);
        textSize(48);
        text('GAME OVER', width / 2, height / 2 - 60);
        
        textSize(32);
        if (this.winner === 'tie') {
            text('TIE GAME!', width / 2, height / 2 - 10);
        } else {
            let winnerName = this.winner === 'bee' ? 'BEES' : 'FLIES';
            text(`${winnerName} WIN!`, width / 2, height / 2 - 10);
        }
        
        textSize(18);
        text(`Final Score: ${this.scores.bee} - ${this.scores.fly}`, width / 2, height / 2 + 30);
        
        textSize(16);
        text('Press R to restart', width / 2, height / 2 + 60);
    }
    
    handleKeyPressed(key, keyCode) {
        if (this.gameState === 'ended' && (key === 'r' || key === 'R')) {
            this.restart();
            return;
        }
        
        if (this.currentPlayer) {
            this.currentPlayer.setKeyState(key, true);
            
            if (key === ' ' && this.currentPlayer.canAttack()) {
                this.combat.performAttack(this.currentPlayer, this.players);
            }
        }
    }
    
    handleKeyReleased(key, keyCode) {
        if (this.currentPlayer) {
            this.currentPlayer.setKeyState(key, false);
        }
    }
    
    restart() {
        this.gameState = 'playing';
        this.scores = { bee: 0, fly: 0 };
        this.winner = null;
        this.startTime = millis();
        
        // Reset flags
        this.flags.bee.returnToBase();
        this.flags.fly.returnToBase();
        
        // Reset players
        for (let player of this.players) {
            player.respawn();
        }
    }
}