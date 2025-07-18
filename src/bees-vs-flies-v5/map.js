class GameMap {
    constructor() {
        this.width = 2400;
        this.height = 1800;
        this.obstacles = [];
        this.beeBase = null;
        this.flyBase = null;
        this.rivers = [];
        this.bridges = [];
        this.generateMap();
    }
    
    generateMap() {
        // Create terrain features
        this.createRivers();
        this.createBridges();
        
        // Create strategic obstacles
        this.createCentralComplex();
        this.createOutposts();
        
        // Create random base positions
        this.createBases();
        
        // Add scattered obstacles
        this.createScatteredObstacles();
        
        // Add forest areas
        this.createForests();
    }
    
    createRivers() {
        // Vertical river through middle
        this.rivers.push({
            x: this.width / 2 - 30,
            y: 0,
            width: 60,
            height: this.height,
            type: 'river'
        });
        
        // Horizontal river in upper portion
        this.rivers.push({
            x: 0,
            y: this.height / 3 - 20,
            width: this.width,
            height: 40,
            type: 'river'
        });
        
        // Diagonal river in lower portion
        for (let i = 0; i < 20; i++) {
            this.rivers.push({
                x: i * 120 - 200,
                y: this.height * 2/3 + i * 30,
                width: 80,
                height: 40,
                type: 'river'
            });
        }
    }
    
    createBridges() {
        // Main vertical river bridges
        this.bridges.push({
            x: this.width / 2 - 40,
            y: this.height / 4,
            width: 80,
            height: 20,
            type: 'bridge'
        });
        
        this.bridges.push({
            x: this.width / 2 - 40,
            y: this.height * 3/4,
            width: 80,
            height: 20,
            type: 'bridge'
        });
        
        // Horizontal river bridges
        this.bridges.push({
            x: this.width / 4,
            y: this.height / 3 - 30,
            width: 20,
            height: 60,
            type: 'bridge'
        });
        
        this.bridges.push({
            x: this.width * 3/4,
            y: this.height / 3 - 30,
            width: 20,
            height: 60,
            type: 'bridge'
        });
    }
    
    createCentralComplex() {
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Main fortress
        this.obstacles.push({
            x: centerX - 150,
            y: centerY - 100,
            width: 300,
            height: 200,
            type: 'fortress'
        });
        
        // Outer defensive walls
        this.obstacles.push({
            x: centerX - 200,
            y: centerY - 150,
            width: 400,
            height: 30,
            type: 'wall'
        });
        
        this.obstacles.push({
            x: centerX - 200,
            y: centerY + 120,
            width: 400,
            height: 30,
            type: 'wall'
        });
        
        // Corner towers
        this.obstacles.push({
            x: centerX - 250,
            y: centerY - 180,
            width: 50,
            height: 50,
            type: 'tower'
        });
        
        this.obstacles.push({
            x: centerX + 200,
            y: centerY - 180,
            width: 50,
            height: 50,
            type: 'tower'
        });
        
        this.obstacles.push({
            x: centerX - 250,
            y: centerY + 130,
            width: 50,
            height: 50,
            type: 'tower'
        });
        
        this.obstacles.push({
            x: centerX + 200,
            y: centerY + 130,
            width: 50,
            height: 50,
            type: 'tower'
        });
    }
    
    createOutposts() {
        // Strategic outposts around the map
        const outposts = [
            { x: 200, y: 200, size: 80 },
            { x: this.width - 280, y: 200, size: 80 },
            { x: 200, y: this.height - 280, size: 80 },
            { x: this.width - 280, y: this.height - 280, size: 80 },
            { x: this.width / 4, y: this.height / 2, size: 60 },
            { x: this.width * 3/4, y: this.height / 2, size: 60 }
        ];
        
        for (let outpost of outposts) {
            this.obstacles.push({
                x: outpost.x - outpost.size/2,
                y: outpost.y - outpost.size/2,
                width: outpost.size,
                height: outpost.size,
                type: 'outpost'
            });
        }
    }
    
    createBases() {
        // Generate positions for bases in corners with more spread
        const baseSize = 140;
        const margin = 100;
        
        // Bee base in bottom-left area
        this.beeBase = {
            x: random(margin, this.width / 4 - baseSize),
            y: random(this.height * 3/4, this.height - baseSize - margin),
            width: baseSize,
            height: baseSize,
            team: 'bee'
        };
        
        // Fly base in top-right area
        this.flyBase = {
            x: random(this.width * 3/4, this.width - baseSize - margin),
            y: random(margin, this.height / 4 - baseSize),
            width: baseSize,
            height: baseSize,
            team: 'fly'
        };
    }
    
    createScatteredObstacles() {
        const numObstacles = 25;
        
        for (let i = 0; i < numObstacles; i++) {
            let obstacle;
            let attempts = 0;
            
            do {
                obstacle = {
                    x: random(100, this.width - 100),
                    y: random(100, this.height - 100),
                    width: random(40, 100),
                    height: random(40, 100),
                    type: ['rock', 'pillar', 'ruins'][i % 3]
                };
                attempts++;
            } while (attempts < 100 && (this.isInBase(obstacle) || this.overlapsImportantArea(obstacle)));
            
            if (attempts < 100) {
                this.obstacles.push(obstacle);
            }
        }
    }
    
    createForests() {
        const forests = [
            { x: 100, y: 500, width: 200, height: 300 },
            { x: this.width - 300, y: 800, width: 200, height: 300 },
            { x: 500, y: 100, width: 300, height: 200 },
            { x: this.width - 800, y: this.height - 300, width: 300, height: 200 }
        ];
        
        for (let forest of forests) {
            // Create tree clusters
            for (let i = 0; i < 15; i++) {
                let tree = {
                    x: forest.x + (i % 5) * (forest.width / 5) + 15,
                    y: forest.y + Math.floor(i / 5) * (forest.height / 3) + 15,
                    width: 30 + (i % 3) * 5,
                    height: 30 + (i % 3) * 5,
                    type: 'tree'
                };
                
                if (!this.isInBase(tree) && !this.overlapsImportantArea(tree)) {
                    this.obstacles.push(tree);
                }
            }
        }
    }
    
    isInBase(obstacle) {
        return this.rectOverlap(obstacle, this.beeBase) || this.rectOverlap(obstacle, this.flyBase);
    }
    
    overlapsImportantArea(obstacle) {
        // Check rivers and bridges
        for (let river of this.rivers) {
            if (this.rectOverlap(obstacle, river)) return true;
        }
        
        for (let bridge of this.bridges) {
            if (this.rectOverlap(obstacle, bridge)) return true;
        }
        
        // Check other obstacles
        for (let other of this.obstacles) {
            if (this.rectOverlap(obstacle, other)) return true;
        }
        
        return false;
    }
    
    rectOverlap(rect1, rect2) {
        const buffer = 40;
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
        
        // Check river collisions (unless on bridge)
        for (let river of this.rivers) {
            if (x - size < river.x + river.width &&
                x + size > river.x &&
                y - size < river.y + river.height &&
                y + size > river.y) {
                
                // Check if on bridge
                let onBridge = false;
                for (let bridge of this.bridges) {
                    if (x - size < bridge.x + bridge.width &&
                        x + size > bridge.x &&
                        y - size < bridge.y + bridge.height &&
                        y + size > bridge.y) {
                        onBridge = true;
                        break;
                    }
                }
                
                if (!onBridge) return true;
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
        
        // Draw rivers
        this.drawRivers();
        
        // Draw bridges
        this.drawBridges();
        
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
        for (let x = 0; x < this.width; x += 60) {
            for (let y = 0; y < this.height; y += 60) {
                circle(x + 30, y + 30, 4);
                circle(x + 45, y + 20, 3);
                circle(x + 15, y + 40, 3);
            }
        }
    }
    
    drawRivers() {
        for (let river of this.rivers) {
            fill(100, 150, 255);
            stroke(80, 120, 200);
            strokeWeight(2);
            rect(river.x, river.y, river.width, river.height);
            
            // Water effect
            fill(120, 170, 255, 100);
            noStroke();
            for (let i = 0; i < 10; i++) {
                circle(river.x + (i * river.width / 10) + 10, 
                      river.y + (i % 3) * (river.height / 3) + 10, 
                      8);
            }
        }
    }
    
    drawBridges() {
        for (let bridge of this.bridges) {
            fill(139, 69, 19);
            stroke(101, 67, 33);
            strokeWeight(2);
            rect(bridge.x, bridge.y, bridge.width, bridge.height);
            
            // Bridge planks
            stroke(80, 50, 20);
            strokeWeight(1);
            if (bridge.width > bridge.height) {
                // Horizontal bridge
                for (let i = 0; i < bridge.width; i += 10) {
                    line(bridge.x + i, bridge.y, bridge.x + i, bridge.y + bridge.height);
                }
            } else {
                // Vertical bridge
                for (let i = 0; i < bridge.height; i += 10) {
                    line(bridge.x, bridge.y + i, bridge.x + bridge.width, bridge.y + i);
                }
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
            rect(base.x + base.width/2 - 20, base.y + base.height/2 - 5, 40, 25);
            triangle(base.x + base.width/2 - 20, base.y + base.height/2 - 5,
                    base.x + base.width/2 + 20, base.y + base.height/2 - 5,
                    base.x + base.width/2, base.y + base.height/2 - 25);
        } else {
            // Draw cave entrance
            ellipse(base.x + base.width/2, base.y + base.height/2, 40, 25);
            fill(0);
            ellipse(base.x + base.width/2, base.y + base.height/2, 25, 15);
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
                for (let i = 0; i < 8; i++) {
                    let x = obstacle.x + i * (obstacle.width / 8);
                    rect(x, obstacle.y - 10, obstacle.width / 8 - 5, 10);
                }
                break;
                
            case 'tower':
                fill(120, 120, 120);
                stroke(100, 100, 100);
                strokeWeight(2);
                rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                
                // Tower top
                fill(140, 140, 140);
                rect(obstacle.x - 5, obstacle.y - 10, obstacle.width + 10, 10);
                break;
                
            case 'outpost':
                fill(140, 140, 140);
                stroke(100, 100, 100);
                strokeWeight(2);
                rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                
                // Flag pole
                stroke(139, 69, 19);
                strokeWeight(3);
                line(obstacle.x + obstacle.width/2, obstacle.y, 
                     obstacle.x + obstacle.width/2, obstacle.y - 20);
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
                
            case 'ruins':
                fill(80, 80, 80);
                stroke(60, 60, 60);
                strokeWeight(1);
                rect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
                
                // Broken parts
                fill(60, 60, 60);
                rect(obstacle.x + obstacle.width/4, obstacle.y, 
                     obstacle.width/2, obstacle.height/3);
                break;
                
            case 'tree':
                // Tree trunk
                fill(139, 69, 19);
                stroke(101, 67, 33);
                strokeWeight(1);
                rect(obstacle.x + obstacle.width/2 - 3, obstacle.y + obstacle.height/2, 
                     6, obstacle.height/2);
                
                // Tree canopy
                fill(34, 139, 34);
                stroke(0, 100, 0);
                ellipse(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, 
                       obstacle.width, obstacle.height);
                break;
        }
        
        pop();
    }
}