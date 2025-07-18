class GameMap {
    constructor() {
        this.width = 1600;
        this.height = 1200;
        this.obstacles = [];
        this.boundaries = [];
        this.bases = {};
        
        this.setupMap();
    }
    
    setupMap() {
        // Central obstacle - larger and more complex
        this.obstacles.push({
            x: -80,
            y: -150,
            width: 160,
            height: 300,
            type: 'central'
        });
        
        // Side obstacles for strategy - more spread out
        this.obstacles.push({
            x: -500,
            y: -100,
            width: 120,
            height: 200,
            type: 'side'
        });
        
        this.obstacles.push({
            x: 380,
            y: -100,
            width: 120,
            height: 200,
            type: 'side'
        });
        
        // Additional strategic obstacles
        this.obstacles.push({
            x: -200,
            y: 200,
            width: 100,
            height: 80,
            type: 'strategic'
        });
        
        this.obstacles.push({
            x: 100,
            y: 200,
            width: 100,
            height: 80,
            type: 'strategic'
        });
        
        this.obstacles.push({
            x: -150,
            y: -350,
            width: 300,
            height: 60,
            type: 'strategic'
        });
        
        // Map boundaries
        this.boundaries = [
            { x: -this.width/2, y: -this.height/2, width: this.width, height: 20 }, // top
            { x: -this.width/2, y: this.height/2 - 20, width: this.width, height: 20 }, // bottom
            { x: -this.width/2, y: -this.height/2, width: 20, height: this.height }, // left
            { x: this.width/2 - 20, y: -this.height/2, width: 20, height: this.height } // right
        ];
        
        // Team bases - moved further apart
        this.bases.bee = {
            x: -640,
            y: 0,
            radius: 80,
            team: 'bee'
        };
        
        this.bases.fly = {
            x: 640,
            y: 0,
            radius: 80,
            team: 'fly'
        };
    }
    
    draw() {
        // Draw map background
        fill(245);
        stroke(200);
        strokeWeight(2);
        rect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Draw boundaries
        fill(200);
        stroke(100);
        strokeWeight(2);
        for (let boundary of this.boundaries) {
            rect(boundary.x, boundary.y, boundary.width, boundary.height);
        }
        
        // Draw obstacles
        for (let obstacle of this.obstacles) {
            graphics.drawObstacle(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        }
        
        // Draw bases
        graphics.drawBase(this.bases.bee.x, this.bases.bee.y, 'bee', this.bases.bee.radius);
        graphics.drawBase(this.bases.fly.x, this.bases.fly.y, 'fly', this.bases.fly.radius);
        
        // Draw base zones (subtle circles)
        stroke(graphics.colors.bee.primary);
        strokeWeight(2);
        noFill();
        ellipse(this.bases.bee.x, this.bases.bee.y, this.bases.bee.radius * 2);
        
        stroke(graphics.colors.fly.primary);
        strokeWeight(2);
        noFill();
        ellipse(this.bases.fly.x, this.bases.fly.y, this.bases.fly.radius * 2);
    }
    
    checkCollision(x, y, radius) {
        // Check obstacles
        for (let obstacle of this.obstacles) {
            if (this.circleRectCollision(x, y, radius, obstacle.x, obstacle.y, obstacle.width, obstacle.height)) {
                return true;
            }
        }
        
        // Check boundaries
        for (let boundary of this.boundaries) {
            if (this.circleRectCollision(x, y, radius, boundary.x, boundary.y, boundary.width, boundary.height)) {
                return true;
            }
        }
        
        return false;
    }
    
    circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
        let closestX = constrain(cx, rx, rx + rw);
        let closestY = constrain(cy, ry, ry + rh);
        
        let distance = dist(cx, cy, closestX, closestY);
        return distance < radius;
    }
    
    isInBase(x, y, team) {
        let base = this.bases[team];
        return dist(x, y, base.x, base.y) < base.radius;
    }
    
    getBase(team) {
        return this.bases[team];
    }
    
    getBounds() {
        return {
            left: -this.width/2,
            right: this.width/2,
            top: -this.height/2,
            bottom: this.height/2
        };
    }
}