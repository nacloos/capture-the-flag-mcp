class Game {
    constructor() {
        this.players = [];
        this.beeFlag = null;
        this.flyFlag = null;
        this.combat = null;
        this.gameState = 'playing'; // 'playing', 'gameOver'
        this.beeScore = 0;
        this.flyScore = 0;
        this.maxScore = 3;
        this.gameTime = 10 * 60 * 1000; // 10 minutes
        this.startTime = 0;
        this.winner = null;
    }
    
    init() {
        this.combat = new Combat();
        this.startTime = millis();
        
        // Create flags
        this.beeFlag = new Flag('bee', 
            gameMap.beeBase.x + gameMap.beeBase.width / 2, 
            gameMap.beeBase.y + gameMap.beeBase.height / 2);
        this.flyFlag = new Flag('fly', 
            gameMap.flyBase.x + gameMap.flyBase.width / 2, 
            gameMap.flyBase.y + gameMap.flyBase.height / 2);
        
        // Create players
        this.createPlayers();
    }
    
    createPlayers() {
        // Player (bee)
        const player = new Player('bee', 
            gameMap.beeBase.x + gameMap.beeBase.width / 2, 
            gameMap.beeBase.y + gameMap.beeBase.height / 2, 
            true);
        this.players.push(player);
        
        // AI enemies (flies)
        for (let i = 0; i < 3; i++) {
            const enemy = new Player('fly', 
                gameMap.flyBase.x + gameMap.flyBase.width / 2 + (i - 1) * 30, 
                gameMap.flyBase.y + gameMap.flyBase.height / 2 + (i - 1) * 30, 
                false);
            this.players.push(enemy);
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // Update flags
        this.beeFlag.update();
        this.flyFlag.update();
        
        // Update players
        for (let player of this.players) {
            player.update();
        }
        
        // Update camera to follow player
        const player = this.players[0];
        if (!player.isDead) {
            camera.follow(player);
        }
        
        // Check game end conditions
        this.checkGameEnd();
    }
    
    draw() {
        // Draw flags
        this.beeFlag.draw();
        this.flyFlag.draw();
        
        // Draw players
        for (let player of this.players) {
            player.draw();
        }
    }
    
    drawHUD() {
        push();
        
        // Score
        textAlign(LEFT);
        textSize(24);
        fill(255, 215, 0);
        stroke(0);
        strokeWeight(2);
        text(`Bees: ${this.beeScore}`, 20, 30);
        
        fill(139, 69, 19);
        text(`Flies: ${this.flyScore}`, 20, 60);
        
        // Timer
        textAlign(CENTER);
        const timeLeft = max(0, this.gameTime - (millis() - this.startTime));
        const minutes = floor(timeLeft / 60000);
        const seconds = floor((timeLeft % 60000) / 1000);
        fill(0);
        text(`${minutes}:${seconds.toString().padStart(2, '0')}`, width / 2, 30);
        
        // Flag status
        textAlign(RIGHT);
        textSize(16);
        fill(0);
        text(`Bee Flag: ${this.beeFlag.isAtBase ? 'Home' : this.beeFlag.isCarried ? 'Taken' : 'Dropped'}`, width - 20, 30);
        text(`Fly Flag: ${this.flyFlag.isAtBase ? 'Home' : this.flyFlag.isCarried ? 'Taken' : 'Dropped'}`, width - 20, 50);
        
        // Player health
        const player = this.players[0];
        if (player && !player.isDead) {
            textAlign(LEFT);
            fill(255, 0, 0);
            text(`Health: ${'♥'.repeat(player.health)}`, 20, height - 30);
        }
        
        // Attack cooldown
        if (player && !player.isDead) {
            const cooldownRemaining = max(0, this.combat.attackCooldown - (millis() - player.lastAttack));
            if (cooldownRemaining > 0) {
                fill(255, 0, 0);
                text(`Attack: ${(cooldownRemaining / 1000).toFixed(1)}s`, 20, height - 10);
            } else {
                fill(0, 255, 0);
                text(`Attack: Ready`, 20, height - 10);
            }
        }
        
        // Game over screen
        if (this.gameState === 'gameOver') {
            fill(0, 0, 0, 150);
            rect(0, 0, width, height);
            
            textAlign(CENTER);
            textSize(48);
            fill(255);
            stroke(0);
            strokeWeight(3);
            text(this.winner === 'bee' ? 'BEES WIN!' : 'FLIES WIN!', width / 2, height / 2);
            
            textSize(24);
            text('Press R to restart', width / 2, height / 2 + 60);
        }
        
        pop();
    }
    
    score(team) {
        if (team === 'bee') {
            this.beeScore++;
        } else {
            this.flyScore++;
        }
        
        if (this.beeScore >= this.maxScore) {
            this.endGame('bee');
        } else if (this.flyScore >= this.maxScore) {
            this.endGame('fly');
        }
    }
    
    checkGameEnd() {
        const timeLeft = this.gameTime - (millis() - this.startTime);
        if (timeLeft <= 0) {
            if (this.beeScore > this.flyScore) {
                this.endGame('bee');
            } else if (this.flyScore > this.beeScore) {
                this.endGame('fly');
            } else {
                // Sudden death - first to score wins
                this.gameTime = this.gameTime + 60000; // Add 1 minute
            }
        }
    }
    
    endGame(winner) {
        this.gameState = 'gameOver';
        this.winner = winner;
    }
    
    restart() {
        this.gameState = 'playing';
        this.beeScore = 0;
        this.flyScore = 0;
        this.startTime = millis();
        this.winner = null;
        
        // Reset flags
        this.beeFlag.returnToBase();
        this.flyFlag.returnToBase();
        
        // Reset players
        for (let player of this.players) {
            player.respawn();
            player.hasFlag = false;
        }
    }
    
    handleKeyPressed(key, keyCode) {
        const player = this.players[0];
        
        if (this.gameState === 'gameOver') {
            if (key === 'r' || key === 'R') {
                this.restart();
            }
            return;
        }
        
        // Set key state
        player.keys[key.toLowerCase()] = true;
        if (keyCode === UP_ARROW) player.keys['ArrowUp'] = true;
        if (keyCode === DOWN_ARROW) player.keys['ArrowDown'] = true;
        if (keyCode === LEFT_ARROW) player.keys['ArrowLeft'] = true;
        if (keyCode === RIGHT_ARROW) player.keys['ArrowRight'] = true;
        
        // Attack
        if (key === ' ') {
            player.attack();
        }
    }
    
    handleKeyReleased(key, keyCode) {
        const player = this.players[0];
        
        if (this.gameState === 'gameOver') return;
        
        // Clear key state
        player.keys[key.toLowerCase()] = false;
        if (keyCode === UP_ARROW) player.keys['ArrowUp'] = false;
        if (keyCode === DOWN_ARROW) player.keys['ArrowDown'] = false;
        if (keyCode === LEFT_ARROW) player.keys['ArrowLeft'] = false;
        if (keyCode === RIGHT_ARROW) player.keys['ArrowRight'] = false;
    }
}