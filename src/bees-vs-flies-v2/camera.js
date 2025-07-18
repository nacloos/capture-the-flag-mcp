class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.followSpeed = 0.1;
        this.bounds = {
            left: -800,
            right: 800,
            top: -600,
            bottom: 600
        };
    }
    
    follow(target) {
        this.targetX = -target.x + width / 2;
        this.targetY = -target.y + height / 2;
        
        // Clamp to bounds
        this.targetX = constrain(this.targetX, -this.bounds.right + width/2, -this.bounds.left + width/2);
        this.targetY = constrain(this.targetY, -this.bounds.bottom + height/2, -this.bounds.top + height/2);
    }
    
    update() {
        this.x = lerp(this.x, this.targetX, this.followSpeed);
        this.y = lerp(this.y, this.targetY, this.followSpeed);
    }
    
    apply() {
        this.update();
        translate(this.x, this.y);
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX + this.x,
            y: worldY + this.y
        };
    }
    
    screenToWorld(screenX, screenY) {
        return {
            x: screenX - this.x,
            y: screenY - this.y
        };
    }
}