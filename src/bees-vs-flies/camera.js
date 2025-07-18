class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.smoothing = 0.1;
    }
    
    follow(target) {
        this.targetX = target.x - width / 2;
        this.targetY = target.y - height / 2;
        
        // Keep camera within map bounds
        this.targetX = constrain(this.targetX, 0, gameMap.width - width);
        this.targetY = constrain(this.targetY, 0, gameMap.height - height);
    }
    
    update() {
        this.x = lerp(this.x, this.targetX, this.smoothing);
        this.y = lerp(this.y, this.targetY, this.smoothing);
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.x,
            y: worldY - this.y
        };
    }
    
    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.x,
            y: screenY + this.y
        };
    }
}