class Game {
    constructor() {
        this.players = [];
        this.beeFlag = null;
        this.flyFlag = null;
        this.gameState = 'playing';
        this.beeScore = 0;
        this.flyScore = 0;
        this.maxScore = 3;
        this.gameTime = 5 * 60 * 1000; // 5 minutes
        this.startTime = 0;
        this.winner = null;
    }
    
    init() {
        this.startTime = millis();
        this.gameState = 'playing';
        this.beeScore = 0;
        this.flyScore = 0;
        this.winner = null;
        
        // Clear existing players
        this.players = [];
        
        // Create flags
        this.beeFlag = new Flag('bee', 
            gameMap.beeBase.x + gameMap.beeBase.width / 2, 
            gameMap.beeBase.y + gameMap.beeBase.height / 2);
        this.flyFlag = new Flag('fly', 
            gameMap.flyBase.x + gameMap.flyBase.width / 2, 
            gameMap.flyBase.y + gameMap.flyBase.height / 2);
        
        // Create players
        this.createPlayers();
        
        // Initialize HUD
        hud.addMessage("Game Started! Capture the enemy flag!", color(255, 255, 0));
    }
    
    createPlayers() {
        // Player (bee)
        const player = new Player('bee', 
            gameMap.beeBase.x + gameMap.beeBase.width / 2, 
            gameMap.beeBase.y + gameMap.beeBase.height / 2, 
            true);
        this.players.push(player);
        
        // AI enemies (flies)
        for (let i = 0; i < 4; i++) {
            const enemy = new Player('fly', 
                gameMap.flyBase.x + gameMap.flyBase.width / 2 + (i - 1.5) * 25, 
                gameMap.flyBase.y + gameMap.flyBase.height / 2 + (i - 1.5) * 25, 
                false);
            this.players.push(enemy);
        }
    }
    
    update() {
        if (this.gameState !== 'playing') return;
        
        // Update players
        for (let player of this.players) {
            player.update();
        }
        
        // Update flags
        this.beeFlag.update();
        this.flyFlag.update();
        
        // Check for game end conditions
        this.checkGameEnd();
        
        // Update camera to follow player
        let player = this.getPlayer();
        if (player && player.health > 0) {
            camera.follow(player);
        }
        
        camera.update();
    }
    
    checkGameEnd() {
        // Check score victory
        if (this.beeScore >= this.maxScore) {
            this.endGame('bee');
        } else if (this.flyScore >= this.maxScore) {
            this.endGame('fly');
        }
        
        // Check time victory
        if (this.getTimeLeft() <= 0) {
            if (this.beeScore > this.flyScore) {
                this.endGame('bee');
            } else if (this.flyScore > this.beeScore) {
                this.endGame('fly');
            } else {
                this.endGame('tie');
            }
        }
    }
    
    endGame(winner) {
        this.gameState = 'gameOver';
        this.winner = winner;
        
        if (winner === 'tie') {
            hud.addMessage("GAME TIED!", color(255, 255, 0));
        } else {
            hud.addMessage(`${winner.toUpperCase()} TEAM WINS!`, 
                          winner === 'bee' ? color(255, 215, 0) : color(80, 50, 30));
        }
    }
    
    restart() {
        // Regenerate map
        gameMap = new GameMap();
        
        // Reset game
        this.init();
        
        // Reset camera
        camera.x = 0;
        camera.y = 0;
        camera.targetX = 0;
        camera.targetY = 0;
        
        hud.addMessage("Game Restarted!", color(255, 255, 0));
    }
    
    getPlayer() {
        return this.players.find(p => p.isPlayer);
    }
    
    getTimeLeft() {
        return this.gameTime - (millis() - this.startTime);
    }
    
    draw() {
        // Apply camera transformation
        push();
        translate(-camera.x, -camera.y);
        
        // Draw game world
        gameMap.draw();
        
        // Draw flags
        this.beeFlag.draw();
        this.flyFlag.draw();
        
        // Draw players
        for (let player of this.players) {
            player.draw();
        }
        
        // Draw flag connections
        this.drawFlagConnections();
        
        pop();
        
        // Draw HUD (no camera transformation)
        hud.draw();
    }
    
    drawFlagConnections() {
        // Draw line from carrying player to their base
        for (let player of this.players) {
            if (player.carryingFlag && player.health > 0) {
                let base = player.team === 'bee' ? gameMap.beeBase : gameMap.flyBase;
                let baseX = base.x + base.width / 2;
                let baseY = base.y + base.height / 2;
                
                stroke(player.team === 'bee' ? color(255, 215, 0) : color(80, 50, 30));
                strokeWeight(2);
                drawingContext.setLineDash([5, 10]);
                line(player.x, player.y, baseX, baseY);
                drawingContext.setLineDash([]);
            }
        }
    }
    
    handleKeyPressed(key) {
        if (this.gameState === 'gameOver' && (key === 'r' || key === 'R')) {
            this.restart();
        }
    }
}