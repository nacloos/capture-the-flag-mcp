class HUD {
    constructor() {
        this.messages = [];
        this.messageTimer = 0;
        this.scoreAnimationTimer = 0;
        this.gameTimeWarning = false;
    }
    
    addMessage(text, color = color(255)) {
        this.messages.unshift({
            text: text,
            color: color,
            timer: 180, // 3 seconds
            alpha: 255
        });
        
        // Keep only last 3 messages
        if (this.messages.length > 3) {
            this.messages.pop();
        }
    }
    
    update() {
        // Update messages
        for (let i = this.messages.length - 1; i >= 0; i--) {
            let message = this.messages[i];
            message.timer--;
            
            if (message.timer < 30) {
                message.alpha = map(message.timer, 0, 30, 0, 255);
            }
            
            if (message.timer <= 0) {
                this.messages.splice(i, 1);
            }
        }
        
        // Update timers
        this.messageTimer = max(0, this.messageTimer - 1);
        this.scoreAnimationTimer = max(0, this.scoreAnimationTimer - 1);
        
        // Check for game time warning
        let timeLeft = game.getTimeLeft();
        if (timeLeft < 60000 && !this.gameTimeWarning) {
            this.gameTimeWarning = true;
            this.addMessage("1 MINUTE REMAINING!", color(255, 0, 0));
        }
    }
    
    draw() {
        // Store current transformation
        push();
        
        // Reset transformations for HUD
        resetMatrix();
        
        this.drawScore();
        this.drawTimer();
        this.drawMessages();
        this.drawPlayerStatus();
        this.drawControls();
        
        // Draw game over screen
        if (game.gameState === 'gameOver') {
            this.drawGameOver();
        }
        
        pop();
    }
    
    drawScore() {
        // Score background
        fill(0, 0, 0, 150);
        noStroke();
        rect(10, 10, 200, 60, 5);
        
        // Bee score
        fill(255, 215, 0);
        textAlign(LEFT, TOP);
        textSize(20);
        text(`Bees: ${game.beeScore}`, 20, 25);
        
        // Fly score
        fill(80, 50, 30);
        text(`Flies: ${game.flyScore}`, 20, 45);
        
        // Score goal
        fill(255);
        textSize(12);
        text(`First to ${game.maxScore}`, 130, 55);
    }
    
    drawTimer() {
        let timeLeft = game.getTimeLeft();
        let minutes = Math.floor(timeLeft / 60000);
        let seconds = Math.floor((timeLeft % 60000) / 1000);
        
        // Timer background
        fill(0, 0, 0, 150);
        noStroke();
        rect(width - 120, 10, 110, 30, 5);
        
        // Timer text
        fill(timeLeft < 60000 ? color(255, 0, 0) : color(255));
        textAlign(CENTER, CENTER);
        textSize(16);
        text(`${minutes}:${seconds.toString().padStart(2, '0')}`, width - 65, 25);
    }
    
    drawMessages() {
        for (let i = 0; i < this.messages.length; i++) {
            let message = this.messages[i];
            let y = 100 + i * 25;
            
            // Message background
            fill(0, 0, 0, message.alpha * 0.7);
            noStroke();
            rect(width/2 - 200, y - 10, 400, 20, 5);
            
            // Message text
            fill(red(message.color), green(message.color), blue(message.color), message.alpha);
            textAlign(CENTER, CENTER);
            textSize(14);
            text(message.text, width/2, y);
        }
    }
    
    drawMiniMap() {
        let mapSize = 120;
        let mapX = width - mapSize - 10;
        let mapY = 50;
        
        // Minimap background
        fill(0, 0, 0, 150);
        noStroke();
        rect(mapX, mapY, mapSize, mapSize * (gameMap.height / gameMap.width), 5);
        
        // Map elements
        push();
        translate(mapX, mapY);
        scale(mapSize / gameMap.width);
        
        // Draw bases
        fill(255, 215, 0);
        rect(gameMap.beeBase.x, gameMap.beeBase.y, gameMap.beeBase.width, gameMap.beeBase.height);
        fill(80, 50, 30);
        rect(gameMap.flyBase.x, gameMap.flyBase.y, gameMap.flyBase.width, gameMap.flyBase.height);
        
        // Draw obstacles
        fill(100);
        for (let obstacle of gameMap.obstacles) {
            rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
        
        // Draw flags
        fill(255, 215, 0);
        circle(game.beeFlag.x, game.beeFlag.y, 8);
        fill(80, 50, 30);
        circle(game.flyFlag.x, game.flyFlag.y, 8);
        
        // Draw players
        for (let player of game.players) {
            if (player.health > 0) {
                fill(player.team === 'bee' ? color(255, 255, 0) : color(100, 50, 0));
                circle(player.x, player.y, 6);
            }
        }
        
        // Draw camera view
        stroke(255);
        strokeWeight(2);
        noFill();
        rect(camera.x, camera.y, camera.viewWidth, camera.viewHeight);
        
        pop();
    }
    
    drawPlayerStatus() {
        let player = game.getPlayer();
        if (!player) return;
        
        let statusX = 10;
        let statusY = height - 80;
        
        // Status background
        fill(0, 0, 0, 150);
        noStroke();
        rect(statusX, statusY, 200, 70, 5);
        
        // Health bar
        fill(255, 0, 0);
        rect(statusX + 10, statusY + 10, 180, 15);
        fill(0, 255, 0);
        rect(statusX + 10, statusY + 10, 180 * (player.health / player.maxHealth), 15);
        
        // Health text
        fill(255);
        textAlign(LEFT, TOP);
        textSize(12);
        text(`Health: ${player.health}/${player.maxHealth}`, statusX + 10, statusY + 30);
        
        // Attack cooldown
        if (player.attackCooldown > 0) {
            fill(255, 100, 100);
            text(`Attack cooldown: ${Math.ceil(player.attackCooldown / 60)}s`, statusX + 10, statusY + 45);
        }
        
        // Flag status
        if (player.carryingFlag) {
            fill(255, 215, 0);
            text(`Carrying ${player.carryingFlag.team} flag!`, statusX + 10, statusY + 60);
        }
    }
    
    drawControls() {
        let controlsX = width - 200;
        let controlsY = height - 100;
        
        // Controls background
        fill(0, 0, 0, 150);
        noStroke();
        rect(controlsX, controlsY, 190, 90, 5);
        
        // Controls text
        fill(255);
        textAlign(LEFT, TOP);
        textSize(11);
        text("Controls:", controlsX + 10, controlsY + 10);
        text("WASD / Arrow Keys - Move", controlsX + 10, controlsY + 25);
        text("SPACE - Attack", controlsX + 10, controlsY + 40);
        text("Capture enemy flag and", controlsX + 10, controlsY + 55);
        text("return to your base!", controlsX + 10, controlsY + 70);
    }
    
    drawGameOver() {
        // Overlay
        fill(0, 0, 0, 200);
        noStroke();
        rect(0, 0, width, height);
        
        // Game over panel
        fill(0, 0, 0, 220);
        stroke(255);
        strokeWeight(2);
        rect(width/2 - 200, height/2 - 100, 400, 200, 10);
        
        // Winner text
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(32);
        text("GAME OVER", width/2, height/2 - 50);
        
        // Winner announcement
        let winnerColor = game.winner === 'bee' ? color(255, 215, 0) : color(80, 50, 30);
        fill(winnerColor);
        textSize(24);
        text(`${game.winner?.toUpperCase()} TEAM WINS!`, width/2, height/2 - 10);
        
        // Final score
        fill(255);
        textSize(16);
        text(`Final Score: Bees ${game.beeScore} - ${game.flyScore} Flies`, width/2, height/2 + 20);
        
        // Restart instruction
        textSize(14);
        text("Press R to restart", width/2, height/2 + 60);
    }
}