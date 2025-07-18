class GameMap {
    constructor() {
        this.width = 1600;
        this.height = 1200;
        this.obstacles = [];
        this.beeBase = null;
        this.flyBase = null;
        this.generateMap();
    }
    
    generateMap() {
        // Create central strategic obstacles
        this.createCentralObstacles();
        
        // Create random base positions
        this.createBases();
        
        // Add perimeter obstacles
        this.createPerimeterObstacles();
    }
    
    createCentralObstacles() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Large central fortress structure
        this.obstacles.push({
            x: centerX - 120,
            y: centerY - 80,
            width: 240,
            height: 160,
            type: 'fortress'
        });
        
        // Strategic chokepoints
        this.obstacles.push({
            x: centerX - 200,
            y: centerY - 30,
            width: 60,
            height: 60,
            type: 'pillar'
        });
        
        this.obstacles.push({
            x: centerX + 140,
            y: centerY - 30,
            width: 60,
            height: 60,
            type: 'pillar'
        });
        
        // Vertical barriers
        this.obstacles.push({
            x: centerX - 40,
            y: centerY - 200,
            width: 80,
            height: 40,
            type: 'wall'
        });
        
        this.obstacles.push({
            x: centerX - 40,
            y: centerY + 160,
            width: 80,
            height: 40,
            type: 'wall'
        });
    }
    
    createBases() {
        // Generate random positions for bases with more spread
        const baseSize = 120;
        const minDistance = 600;
        
        // Bee base (random position in left third)
        this.beeBase = {
            x: random(50, this.width / 3 - baseSize - 50),
            y: random(50, this.height - baseSize - 50),
            width: baseSize,
            height: baseSize,
            team: 'bee'
        };
        
        // Fly base (random position in right third, ensure minimum distance)
        do {
            this.flyBase = {
                x: random(this.width * 2/3 + 50, this.width - baseSize - 50),
                y: random(50, this.height - baseSize - 50),
                width: baseSize,
                height: baseSize,
                team: 'fly'
            };
        } while (dist(this.beeBase.x, this.beeBase.y, this.flyBase.x, this.flyBase.y) < minDistance);
    }
    
    createPerimeterObstacles() {
        // Add scattered obstacles around the map
        const numObstacles = 8;
        
        for (let i = 0; i < numObstacles; i++) {
            let obstacle;
            let attempts = 0;
            
            do {
                obstacle = {
                    x: random(50, this.width - 100),
                    y: random(50, this.height - 100),
                    width: random(40, 80),
                    height: random(40, 80),
                    type: 'rock'
                };
                attempts++;
            } while (attempts < 50 && (this.isInBase(obstacle) || this.overlapsObstacle(obstacle)));
            
            if (attempts < 50) {
                this.obstacles.push(obstacle);
            }
        }
    }
    
    isInBase(obstacle) {
        return this.rectOverlap(obstacle, this.beeBase) || this.rectOverlap(obstacle, this.flyBase);
    }
    
    overlapsObstacle(newObstacle) {
        for (let obstacle of this.obstacles) {
            if (this.rectOverlap(newObstacle, obstacle)) {
                return true;
            }
        }
        return false;
    }
    
    rectOverlap(rect1, rect2) {
        const buffer = 30;
        return rect1.x < rect2.x + rect2.width + buffer &&
               rect1.x + rect1.width > rect2.x - buffer &&
               rect1.y < rect2.y + rect2.height + buffer &&
               rect1.y + rect1.height > rect2.y - buffer;
    }
    
    checkCollision(x, y, size) {
        // Check obstacle collisions
        for (let obstacle of this.obstacles) {
            if (x - size < obstacle.x + obstacle.width &&
                x + size > obstacle.x &&
                y - size < obstacle.y + obstacle.height &&
                y + size > obstacle.y) {
                return true;
            }
        }
        
        // Check world bounds
        if (x - size < 0 || x + size > this.width ||
            y - size < 0 || y + size > this.height) {
            return true;
        }
        
        return false;
    }
    
    isInBase(x, y, team) {
        const base = team === 'bee' ? this.beeBase : this.flyBase;
        return x >= base.x && x <= base.x + base.width &&
               y >= base.y && y <= base.y + base.height;
    }
    
    draw() {
        // Draw background
        fill(120, 180, 120);
        rect(0, 0, this.width, this.height);
        
        // Draw grass texture
        this.drawGrassTexture();
        
        // Draw bases
        this.drawBase(this.beeBase);
        this.drawBase(this.flyBase);
        
        // Draw obstacles
        for (let obstacle of this.obstacles) {
            this.drawObstacle(obstacle);
        }
    }
    
    drawGrassTexture() {
        fill(100, 160, 100);
        for (let x = 0; x < this.width; x += 40) {
            for (let y = 0; y < this.height; y += 40) {
                circle(x + 20, y + 20, 4);
                circle(x + 30, y + 15, 3);
                circle(x + 10, y + 25, 3);
            }
        }
    }
    
    drawBase(base) {
        push();
        
        // Base platform
        fill(base.team === 'bee' ? color(255, 215, 0) : color(80, 50, 30));
        rect(base.x, base.y, base.width, base.height, 10);
        
        // Base border
        stroke(base.team === 'bee' ? color(200, 165, 0) : color(60, 30, 10));
        strokeWeight(4);
        noFill();
        rect(base.x, base.y, base.width, base.height, 10);
        
        // Base symbol
        fill(base.team === 'bee' ? color(255, 255, 255) : color(255, 0, 0));
        noStroke();
        if (base.team === 'bee') {
            // Draw house shape
            rect(base.x + base.width/2 - 15, base.y + base.height/2 - 5, 30, 20);
            triangle(base.x + base.width/2 - 15, base.y + base.height/2 - 5,
                    base.x + base.width/2 + 15, base.y + base.height/2 - 5,
                    base.x + base.width/2, base.y + base.height/2 - 20);
        } else {
            // Draw cave entrance
            ellipse(base.x + base.width/2, base.y + base.height/2, 30, 20);
            fill(0);
            ellipse(base.x + base.width/2, base.y + base.height/2, 20, 12);
        }
        
        pop();
    }
    
    drawObstacle(obstacle) {
        push();
        
        switch (obstacle.type) {
            case 'fortress':
                fill(100, 100, 100);
                stroke(80, 80, 80);
                strokeWeight(2);
                rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                
                // Add battlements
                fill(120, 120, 120);
                for (let i = 0; i < 6; i++) {
                    let x = obstacle.x + i * (obstacle.width / 6);
                    rect(x, obstacle.y - 10, obstacle.width / 6 - 5, 10);
                }
                break;
                
            case 'pillar':
                fill(140, 140, 140);
                stroke(100, 100, 100);
                strokeWeight(2);
                ellipse(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, 
                       obstacle.width, obstacle.height);
                break;
                
            case 'wall':
                fill(120, 120, 120);
                stroke(90, 90, 90);
                strokeWeight(2);
                rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                break;
                
            case 'rock':
                fill(100, 100, 100);
                stroke(70, 70, 70);
                strokeWeight(1);
                ellipse(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, 
                       obstacle.width, obstacle.height);
                break;
        }
        
        pop();
    }
}