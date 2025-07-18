class GameMap {
    constructor() {
        this.width = 1200;
        this.height = 800;
        this.baseSize = 100;
        this.obstacleSize = 150;
        
        // Team bases
        this.beeBase = {
            x: 50,
            y: this.height / 2 - this.baseSize / 2,
            width: this.baseSize,
            height: this.baseSize
        };
        
        this.flyBase = {
            x: this.width - 50 - this.baseSize,
            y: this.height / 2 - this.baseSize / 2,
            width: this.baseSize,
            height: this.baseSize
        };
        
        // Central obstacle
        this.obstacle = {
            x: this.width / 2 - this.obstacleSize / 2,
            y: this.height / 2 - this.obstacleSize / 2,
            width: this.obstacleSize,
            height: this.obstacleSize
        };
    }
    
    draw() {
        // Draw map background
        fill(240, 255, 240);
        rect(0, 0, this.width, this.height);
        
        // Draw bee base
        fill(255, 215, 0);
        stroke(0);
        strokeWeight(2);
        rect(this.beeBase.x, this.beeBase.y, this.beeBase.width, this.beeBase.height);
        
        // Draw fly base
        fill(139, 69, 19);
        rect(this.flyBase.x, this.flyBase.y, this.flyBase.width, this.flyBase.height);
        
        // Draw central obstacle
        fill(120, 120, 120);
        rect(this.obstacle.x, this.obstacle.y, this.obstacle.width, this.obstacle.height);
        
        noStroke();
    }
    
    checkCollision(x, y, width, height) {
        // Check map boundaries
        if (x < 0 || x + width > this.width || y < 0 || y + height > this.height) {
            return true;
        }
        
        // Check obstacle collision
        if (x + width > this.obstacle.x && x < this.obstacle.x + this.obstacle.width &&
            y + height > this.obstacle.y && y < this.obstacle.y + this.obstacle.height) {
            return true;
        }
        
        return false;
    }
    
    isInBase(x, y, team) {
        const base = team === 'bee' ? this.beeBase : this.flyBase;
        return x >= base.x && x <= base.x + base.width &&
               y >= base.y && y <= base.y + base.height;
    }
}