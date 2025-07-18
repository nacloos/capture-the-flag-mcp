class Graphics {
    constructor() {
        this.sprites = {};
        this.colors = {
            bee: {
                primary: '#FFD700',
                secondary: '#000000',
                accent: '#FFFFFF'
            },
            fly: {
                primary: '#8B4513',
                secondary: '#228B22',
                accent: '#696969'
            },
            neutral: {
                obstacle: '#A0A0A0',
                background: '#F5F5F5',
                boundary: '#D3D3D3'
            }
        };
    }
    
    drawBee(x, y, size, health, maxHealth) {
        push();
        translate(x, y);
        
        // Body
        fill(this.colors.bee.primary);
        stroke(this.colors.bee.secondary);
        strokeWeight(2);
        ellipse(0, 0, size, size * 0.8);
        
        // Stripes
        stroke(this.colors.bee.secondary);
        strokeWeight(3);
        for (let i = -size/4; i <= size/4; i += size/8) {
            line(i, -size/3, i, size/3);
        }
        
        // Wings
        fill(this.colors.bee.accent);
        stroke(this.colors.bee.secondary);
        strokeWeight(1);
        ellipse(-size/3, -size/4, size/3, size/4);
        ellipse(size/3, -size/4, size/3, size/4);
        
        // Eyes
        fill(this.colors.bee.secondary);
        noStroke();
        ellipse(-size/4, -size/6, size/8, size/8);
        ellipse(size/4, -size/6, size/8, size/8);
        
        // Health bar
        if (health < maxHealth) {
            this.drawHealthBar(0, -size/2 - 10, size, health, maxHealth, this.colors.bee.primary);
        }
        
        pop();
    }
    
    drawFly(x, y, size, health, maxHealth) {
        push();
        translate(x, y);
        
        // Body
        fill(this.colors.fly.primary);
        stroke(this.colors.fly.secondary);
        strokeWeight(2);
        ellipse(0, 0, size * 0.7, size);
        
        // Segments
        stroke(this.colors.fly.secondary);
        strokeWeight(2);
        for (let i = -size/3; i <= size/3; i += size/6) {
            line(-size/4, i, size/4, i);
        }
        
        // Wings
        fill(this.colors.fly.accent);
        stroke(this.colors.fly.secondary);
        strokeWeight(1);
        ellipse(-size/2, -size/3, size/2, size/3);
        ellipse(size/2, -size/3, size/2, size/3);
        
        // Eyes (compound)
        fill(this.colors.fly.secondary);
        noStroke();
        ellipse(-size/3, -size/4, size/6, size/6);
        ellipse(size/3, -size/4, size/6, size/6);
        
        // Health bar
        if (health < maxHealth) {
            this.drawHealthBar(0, -size/2 - 10, size, health, maxHealth, this.colors.fly.primary);
        }
        
        pop();
    }
    
    drawHealthBar(x, y, width, health, maxHealth, teamColor) {
        push();
        translate(x, y);
        
        // Background
        fill(200);
        noStroke();
        rect(-width/2, -3, width, 6);
        
        // Health
        fill(teamColor);
        rect(-width/2, -3, (health / maxHealth) * width, 6);
        
        // Border
        stroke(0);
        strokeWeight(1);
        noFill();
        rect(-width/2, -3, width, 6);
        
        pop();
    }
    
    drawFlag(x, y, team, size) {
        push();
        translate(x, y);
        
        // Pole
        stroke(101, 67, 33);
        strokeWeight(3);
        line(0, 0, 0, -size);
        
        // Flag
        if (team === 'bee') {
            fill(this.colors.bee.primary);
            stroke(this.colors.bee.secondary);
        } else {
            fill(this.colors.fly.primary);
            stroke(this.colors.fly.secondary);
        }
        strokeWeight(2);
        
        // Flag shape
        beginShape();
        vertex(0, -size);
        vertex(size/2, -size + 10);
        vertex(size/3, -size + 20);
        vertex(size/2, -size + 30);
        vertex(0, -size + 20);
        endShape(CLOSE);
        
        pop();
    }
    
    drawBase(x, y, team, size) {
        push();
        translate(x, y);
        
        if (team === 'bee') {
            // Hive
            fill(this.colors.bee.primary);
            stroke(this.colors.bee.secondary);
            strokeWeight(2);
            
            // Hexagonal hive shape
            beginShape();
            for (let i = 0; i < 6; i++) {
                let angle = TWO_PI / 6 * i;
                let x = cos(angle) * size;
                let y = sin(angle) * size;
                vertex(x, y);
            }
            endShape(CLOSE);
            
            // Entrance
            fill(this.colors.bee.secondary);
            ellipse(0, size/3, size/3, size/4);
        } else {
            // Trash pile
            fill(this.colors.fly.primary);
            stroke(this.colors.fly.secondary);
            strokeWeight(2);
            
            // Irregular pile shape
            beginShape();
            vertex(-size, size/2);
            vertex(-size/2, -size/2);
            vertex(-size/3, -size);
            vertex(size/3, -size/2);
            vertex(size, -size/3);
            vertex(size/2, size/2);
            vertex(0, size);
            endShape(CLOSE);
        }
        
        pop();
    }
    
    drawObstacle(x, y, width, height) {
        push();
        fill(this.colors.neutral.obstacle);
        stroke(100);
        strokeWeight(2);
        rect(x, y, width, height);
        
        // Add texture
        stroke(120);
        strokeWeight(1);
        for (let i = x; i < x + width; i += 20) {
            for (let j = y; j < y + height; j += 20) {
                point(i, j);
            }
        }
        
        pop();
    }
    
    drawAttackEffect(x, y, size, progress) {
        push();
        translate(x, y);
        
        // Flash effect
        let alpha = 255 * (1 - progress);
        fill(255, 255, 0, alpha);
        stroke(255, 0, 0, alpha);
        strokeWeight(2);
        ellipse(0, 0, size * (1 + progress));
        
        pop();
    }
}