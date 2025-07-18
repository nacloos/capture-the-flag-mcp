class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.smoothing = 0.1;
        this.viewWidth = 800;
        this.viewHeight = 600;
        this.shakeAmount = 0;
        this.shakeDecay = 0.9;
    }
    
    follow(target) {
        this.targetX = target.x - this.viewWidth / 2;
        this.targetY = target.y - this.viewHeight / 2;
        
        // Constrain camera to world bounds
        this.targetX = constrain(this.targetX, 0, gameMap.width - this.viewWidth);
        this.targetY = constrain(this.targetY, 0, gameMap.height - this.viewHeight);
    }
    
    update() {
        // Smooth camera movement
        this.x = lerp(this.x, this.targetX, this.smoothing);
        this.y = lerp(this.y, this.targetY, this.smoothing);
        
        // Apply screen shake
        if (this.shakeAmount > 0) {
            this.x += random(-this.shakeAmount, this.shakeAmount);
            this.y += random(-this.shakeAmount, this.shakeAmount);
            this.shakeAmount *= this.shakeDecay;
            if (this.shakeAmount < 0.1) {
                this.shakeAmount = 0;
            }
        }
    }
    
    shake(amount) {
        this.shakeAmount = amount;
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
    
    isOnScreen(x, y, size = 0) {
        return x + size > this.x && x - size < this.x + this.viewWidth &&
               y + size > this.y && y - size < this.y + this.viewHeight;
    }
}