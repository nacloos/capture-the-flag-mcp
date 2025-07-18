class Graphics {
    constructor() {
        this.sprites = {};
        this.animationTime = 0;
        this.colors = {
            bee: {
                primary: '#FFD700',
                secondary: '#000000',
                accent: '#FFFFFF',
                bodyGradient: {
                    start: '#FFE55C',
                    end: '#FFB347'
                },
                wingGradient: {
                    start: '#FFFFFF',
                    end: '#E6E6FA'
                },
                stripeColor: '#2C1810',
                shadowColor: '#D4AF37'
            },
            fly: {
                primary: '#4A4A4A',
                secondary: '#2F4F2F',
                accent: '#696969',
                bodyGradient: {
                    start: '#5C5C5C',
                    end: '#3A3A3A'
                },
                wingGradient: {
                    start: '#8B8B8B',
                    end: '#5C5C5C'
                },
                segmentColor: '#1C1C1C',
                shadowColor: '#2A2A2A'
            },
            neutral: {
                obstacle: '#A0A0A0',
                background: '#F5F5F5',
                boundary: '#D3D3D3'
            }
        };
    }
    
    update() {
        this.animationTime += 0.05;
    }
    
    createGradient(startColor, endColor, x1, y1, x2, y2) {
        let gradient = drawingContext.createLinearGradient(x1, y1, x2, y2);
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        return gradient;
    }
    
    createRadialGradient(startColor, endColor, x, y, r1, r2) {
        let gradient = drawingContext.createRadialGradient(x, y, r1, x, y, r2);
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        return gradient;
    }
    
    drawBee(x, y, size, health, maxHealth) {
        push();
        translate(x, y);
        
        // Wing animation
        let wingFlap = sin(this.animationTime * 8) * 0.1;
        
        // Shadow
        fill(this.colors.bee.shadowColor);
        noStroke();
        ellipse(2, 4, size * 0.95, size * 0.75);
        
        // Wings (behind body)
        push();
        rotate(wingFlap);
        drawingContext.fillStyle = this.createRadialGradient(
            this.colors.bee.wingGradient.start,
            this.colors.bee.wingGradient.end,
            0, 0, 0, size/6
        );
        stroke(this.colors.bee.secondary);
        strokeWeight(1);
        // Left wing
        ellipse(-size/3, -size/4, size/3, size/4);
        // Right wing
        ellipse(size/3, -size/4, size/3, size/4);
        
        // Wing details
        stroke(this.colors.bee.secondary);
        strokeWeight(0.5);
        for (let i = 0; i < 3; i++) {
            line(-size/3 - size/12, -size/4 + i*size/24, -size/3 + size/12, -size/4 + i*size/24);
            line(size/3 - size/12, -size/4 + i*size/24, size/3 + size/12, -size/4 + i*size/24);
        }
        pop();
        
        // Body with gradient
        drawingContext.fillStyle = this.createRadialGradient(
            this.colors.bee.bodyGradient.start,
            this.colors.bee.bodyGradient.end,
            0, 0, 0, size/2
        );
        stroke(this.colors.bee.secondary);
        strokeWeight(2);
        ellipse(0, 0, size, size * 0.8);
        
        // Stripes with better styling
        stroke(this.colors.bee.stripeColor);
        strokeWeight(4);
        for (let i = -size/4; i <= size/4; i += size/7) {
            line(i, -size/3, i, size/3);
        }
        
        // Highlight on body
        fill(255, 255, 255, 80);
        noStroke();
        ellipse(-size/6, -size/6, size/4, size/6);
        
        // Eyes with depth
        fill(this.colors.bee.secondary);
        noStroke();
        ellipse(-size/4, -size/6, size/6, size/6);
        ellipse(size/4, -size/6, size/6, size/6);
        
        // Eye highlights
        fill(255, 255, 255, 150);
        ellipse(-size/4 - size/20, -size/6 - size/20, size/12, size/12);
        ellipse(size/4 - size/20, -size/6 - size/20, size/12, size/12);
        
        // Antennae
        stroke(this.colors.bee.secondary);
        strokeWeight(2);
        line(-size/8, -size/2, -size/6, -size/2 - size/8);
        line(size/8, -size/2, size/6, -size/2 - size/8);
        
        // Antennae tips
        fill(this.colors.bee.secondary);
        noStroke();
        ellipse(-size/6, -size/2 - size/8, size/20, size/20);
        ellipse(size/6, -size/2 - size/8, size/20, size/20);
        
        // Health bar
        if (health < maxHealth) {
            this.drawHealthBar(0, -size/2 - 15, size, health, maxHealth, this.colors.bee.primary);
        }
        
        pop();
    }
    
    drawFly(x, y, size, health, maxHealth) {
        push();
        translate(x, y);
        
        // Wing animation (faster and more erratic than bees)
        let wingFlap = sin(this.animationTime * 12) * 0.15;
        let wingTwitch = cos(this.animationTime * 15) * 0.08;
        
        // Shadow
        fill(this.colors.fly.shadowColor);
        noStroke();
        ellipse(3, 5, size * 0.65, size * 0.95);
        
        // Wings (behind body) - more insect-like and dirty
        push();
        rotate(wingFlap + wingTwitch);
        drawingContext.fillStyle = this.createRadialGradient(
            this.colors.fly.wingGradient.start,
            this.colors.fly.wingGradient.end,
            0, 0, 0, size/4
        );
        stroke(this.colors.fly.secondary);
        strokeWeight(1);
        // Left wing - more angular and ugly
        ellipse(-size/2, -size/3, size/2, size/3);
        ellipse(size/2, -size/3, size/2, size/3);
        
        // Wing veins (more prominent and messy)
        stroke(this.colors.fly.segmentColor);
        strokeWeight(0.8);
        for (let i = 0; i < 4; i++) {
            // Left wing veins
            line(-size/2 - size/8, -size/3 + i*size/20, -size/2 + size/8, -size/3 + i*size/20);
            // Right wing veins
            line(size/2 - size/8, -size/3 + i*size/20, size/2 + size/8, -size/3 + i*size/20);
        }
        pop();
        
        // Body with gradient (more muted and dirty)
        drawingContext.fillStyle = this.createRadialGradient(
            this.colors.fly.bodyGradient.start,
            this.colors.fly.bodyGradient.end,
            0, 0, 0, size/2
        );
        stroke(this.colors.fly.secondary);
        strokeWeight(2);
        ellipse(0, 0, size * 0.7, size);
        
        // Segments with more definition
        stroke(this.colors.fly.segmentColor);
        strokeWeight(3);
        for (let i = -size/3; i <= size/3; i += size/5) {
            line(-size/4, i, size/4, i);
        }
        
        // Body texture/dirt spots (fixed positions)
        fill(this.colors.fly.segmentColor);
        noStroke();
        let spots = [
            {x: -size/16, y: -size/4},
            {x: size/12, y: -size/8},
            {x: -size/10, y: size/8},
            {x: size/16, y: size/4},
            {x: -size/20, y: 0},
            {x: size/8, y: -size/6}
        ];
        for (let spot of spots) {
            ellipse(spot.x, spot.y, size/20, size/20);
        }
        
        // Large compound eyes (more prominent and ugly)
        fill(this.colors.fly.segmentColor);
        noStroke();
        ellipse(-size/3, -size/4, size/4, size/4);
        ellipse(size/3, -size/4, size/4, size/4);
        
        // Compound eye pattern
        fill(this.colors.fly.secondary);
        for (let i = 0; i < 8; i++) {
            let angle = TWO_PI / 8 * i;
            let eyeX = cos(angle) * size/16;
            let eyeY = sin(angle) * size/16;
            ellipse(-size/3 + eyeX, -size/4 + eyeY, size/40, size/40);
            ellipse(size/3 + eyeX, -size/4 + eyeY, size/40, size/40);
        }
        
        // Small beady pupils
        fill(255, 0, 0, 100);
        ellipse(-size/3, -size/4, size/20, size/20);
        ellipse(size/3, -size/4, size/20, size/20);
        
        // Proboscis (fly feeding tube)
        stroke(this.colors.fly.segmentColor);
        strokeWeight(2);
        line(0, size/8, 0, size/4);
        fill(this.colors.fly.segmentColor);
        noStroke();
        ellipse(0, size/4, size/15, size/15);
        
        // Health bar
        if (health < maxHealth) {
            this.drawHealthBar(0, -size/2 - 15, size, health, maxHealth, this.colors.fly.primary);
        }
        
        pop();
    }
    
    drawHealthBar(x, y, width, health, maxHealth, teamColor) {
        push();
        translate(x, y);
        
        // Shadow
        fill(0, 0, 0, 50);
        noStroke();
        rect(-width/2 + 1, -2, width, 6);
        
        // Background with gradient
        drawingContext.fillStyle = this.createGradient('#E0E0E0', '#B0B0B0', 0, -3, 0, 3);
        noStroke();
        rect(-width/2, -3, width, 6);
        
        // Health with gradient
        let healthWidth = (health / maxHealth) * width;
        let healthPercent = health / maxHealth;
        
        // Color based on health percentage
        let healthColor;
        if (healthPercent > 0.6) {
            healthColor = teamColor;
        } else if (healthPercent > 0.3) {
            healthColor = '#FFA500'; // Orange
        } else {
            healthColor = '#FF4500'; // Red
        }
        
        drawingContext.fillStyle = this.createGradient(healthColor, this.darkenColor(healthColor, 0.3), 0, -3, 0, 3);
        rect(-width/2, -3, healthWidth, 6);
        
        // Highlight
        fill(255, 255, 255, 80);
        noStroke();
        rect(-width/2, -3, healthWidth, 2);
        
        // Border with depth
        stroke(0, 0, 0, 150);
        strokeWeight(1);
        noFill();
        rect(-width/2, -3, width, 6);
        
        pop();
    }
    
    darkenColor(color, amount) {
        // Simple color darkening function
        let r = parseInt(color.substr(1, 2), 16);
        let g = parseInt(color.substr(3, 2), 16);
        let b = parseInt(color.substr(5, 2), 16);
        
        r = Math.floor(r * (1 - amount));
        g = Math.floor(g * (1 - amount));
        b = Math.floor(b * (1 - amount));
        
        return `rgb(${r},${g},${b})`;
    }
    
    drawFlag(x, y, team, size) {
        push();
        translate(x, y);
        
        // Pole shadow
        stroke(70, 45, 20);
        strokeWeight(3);
        line(2, 2, 2, -size + 2);
        
        // Pole with gradient effect
        drawingContext.strokeStyle = this.createGradient('#8B4513', '#654321', 0, 0, 0, -size);
        strokeWeight(4);
        line(0, 0, 0, -size);
        
        // Pole highlight
        stroke(139, 101, 70);
        strokeWeight(1);
        line(-1, 0, -1, -size);
        
        // Flag waving animation
        let wave = sin(this.animationTime * 3) * 0.08;
        
        push();
        rotate(wave);
        
        // Flag shadow
        fill(0, 0, 0, 50);
        noStroke();
        beginShape();
        vertex(2, -size + 2);
        vertex(size/2 + 2, -size + 12);
        vertex(size/3 + 2, -size + 22);
        vertex(size/2 + 2, -size + 32);
        vertex(2, -size + 22);
        endShape(CLOSE);
        
        // Flag with gradient
        if (team === 'bee') {
            drawingContext.fillStyle = this.createGradient(
                this.colors.bee.bodyGradient.start,
                this.colors.bee.bodyGradient.end,
                0, -size, size/2, -size + 30
            );
            stroke(this.colors.bee.secondary);
        } else {
            drawingContext.fillStyle = this.createGradient(
                this.colors.fly.bodyGradient.start,
                this.colors.fly.bodyGradient.end,
                0, -size, size/2, -size + 30
            );
            stroke(this.colors.fly.secondary);
        }
        strokeWeight(2);
        
        // Flag shape with wave effect
        beginShape();
        vertex(0, -size);
        vertex(size/2, -size + 10 + wave * 5);
        vertex(size/3, -size + 20 + wave * 3);
        vertex(size/2, -size + 30 + wave * 2);
        vertex(0, -size + 20);
        endShape(CLOSE);
        
        // Flag highlight
        fill(255, 255, 255, 60);
        noStroke();
        beginShape();
        vertex(0, -size);
        vertex(size/4, -size + 8);
        vertex(size/6, -size + 15);
        vertex(0, -size + 12);
        endShape(CLOSE);
        
        // Team symbol on flag
        fill(team === 'bee' ? this.colors.bee.secondary : this.colors.fly.secondary);
        noStroke();
        if (team === 'bee') {
            // Bee symbol (hexagon)
            beginShape();
            for (let i = 0; i < 6; i++) {
                let angle = TWO_PI / 6 * i;
                let x = cos(angle) * size/12 + size/6;
                let y = sin(angle) * size/12 + (-size + 20);
                vertex(x, y);
            }
            endShape(CLOSE);
        } else {
            // Fly symbol (cross)
            rect(size/6 - 2, -size + 15, 4, 10);
            rect(size/6 - 5, -size + 18, 10, 4);
        }
        
        pop();
        pop();
    }
    
    drawBase(x, y, team, size) {
        push();
        translate(x, y);
        
        if (team === 'bee') {
            // Hive with professional styling
            
            // Shadow
            fill(0, 0, 0, 40);
            noStroke();
            beginShape();
            for (let i = 0; i < 6; i++) {
                let angle = TWO_PI / 6 * i;
                let x = cos(angle) * size + 3;
                let y = sin(angle) * size + 5;
                vertex(x, y);
            }
            endShape(CLOSE);
            
            // Main hive body with gradient
            drawingContext.fillStyle = this.createRadialGradient(
                this.colors.bee.bodyGradient.start,
                this.colors.bee.bodyGradient.end,
                0, -size/3, 0, size
            );
            stroke(this.colors.bee.secondary);
            strokeWeight(3);
            
            // Hexagonal hive shape
            beginShape();
            for (let i = 0; i < 6; i++) {
                let angle = TWO_PI / 6 * i;
                let x = cos(angle) * size;
                let y = sin(angle) * size;
                vertex(x, y);
            }
            endShape(CLOSE);
            
            // Hexagonal pattern on hive
            stroke(this.colors.bee.stripeColor);
            strokeWeight(1);
            noFill();
            for (let layer = 0; layer < 3; layer++) {
                let layerSize = size * (0.3 + layer * 0.2);
                beginShape();
                for (let i = 0; i < 6; i++) {
                    let angle = TWO_PI / 6 * i;
                    let x = cos(angle) * layerSize;
                    let y = sin(angle) * layerSize;
                    vertex(x, y);
                }
                endShape(CLOSE);
            }
            
            // Entrance shadow
            fill(0, 0, 0, 80);
            noStroke();
            ellipse(0, size/3 + 2, size/3, size/4);
            
            // Entrance
            drawingContext.fillStyle = this.createRadialGradient(
                '#4A4A4A',
                '#000000',
                0, size/3, 0, size/3 + size/8
            );
            noStroke();
            ellipse(0, size/3, size/3, size/4);
            
            // Entrance highlight
            fill(139, 101, 70);
            stroke(this.colors.bee.secondary);
            strokeWeight(1);
            ellipse(0, size/3 - 2, size/3 - 4, size/4 - 2);
            
            // Highlight on hive
            fill(255, 255, 255, 60);
            noStroke();
            beginShape();
            for (let i = 0; i < 6; i++) {
                let angle = TWO_PI / 6 * i;
                let x = cos(angle) * size * 0.8;
                let y = sin(angle) * size * 0.8 - size/6;
                vertex(x, y);
            }
            endShape(CLOSE);
            
        } else {
            // Trash pile with disgusting styling
            
            // Shadow
            fill(0, 0, 0, 60);
            noStroke();
            beginShape();
            vertex(-size + 3, size/2 + 5);
            vertex(-size/2 + 3, -size/2 + 5);
            vertex(-size/3 + 3, -size + 5);
            vertex(size/3 + 3, -size/2 + 5);
            vertex(size + 3, -size/3 + 5);
            vertex(size/2 + 3, size/2 + 5);
            vertex(0 + 3, size + 5);
            endShape(CLOSE);
            
            // Main trash pile with gradient
            drawingContext.fillStyle = this.createRadialGradient(
                this.colors.fly.bodyGradient.start,
                this.colors.fly.bodyGradient.end,
                0, 0, 0, size
            );
            stroke(this.colors.fly.secondary);
            strokeWeight(3);
            
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
            
            // Trash details - various garbage items
            fill(this.colors.fly.segmentColor);
            noStroke();
            
            // Bottles and cans
            rect(-size/2, -size/4, size/8, size/3);
            ellipse(size/3, -size/3, size/6, size/6);
            rect(-size/4, size/6, size/6, size/8);
            
            // Organic waste
            fill(101, 67, 33);
            ellipse(-size/3, 0, size/8, size/12);
            ellipse(size/4, size/4, size/10, size/8);
            
            // Flies buzzing around
            fill(this.colors.fly.segmentColor);
            for (let i = 0; i < 4; i++) {
                let flyX = cos(this.animationTime * 2 + i * PI/2) * size * 1.2;
                let flyY = sin(this.animationTime * 2 + i * PI/2) * size * 0.8;
                ellipse(flyX, flyY, size/20, size/30);
            }
            
            // Stink lines
            stroke(100, 150, 100);
            strokeWeight(2);
            for (let i = 0; i < 5; i++) {
                let stinkX = -size/2 + i * size/4;
                let stinkY = -size - 10;
                let wave = sin(this.animationTime * 2 + i) * 5;
                
                beginShape();
                noFill();
                vertex(stinkX, stinkY);
                vertex(stinkX + wave, stinkY - 10);
                vertex(stinkX - wave, stinkY - 20);
                vertex(stinkX + wave, stinkY - 30);
                endShape();
            }
        }
        
        pop();
    }
    
    drawObstacle(x, y, width, height) {
        push();
        
        // Shadow
        fill(0, 0, 0, 40);
        noStroke();
        rect(x + 3, y + 3, width, height);
        
        // Main obstacle with gradient
        drawingContext.fillStyle = this.createGradient('#B8B8B8', '#808080', x, y, x, y + height);
        stroke(60);
        strokeWeight(3);
        rect(x, y, width, height);
        
        // Top highlight
        fill(220, 220, 220);
        noStroke();
        rect(x, y, width, height/8);
        
        // Stone texture (fixed pattern)
        stroke(140);
        strokeWeight(1);
        for (let i = x + 5; i < x + width - 5; i += 15) {
            for (let j = y + 5; j < y + height - 5; j += 15) {
                let textureSize = 2 + ((i + j) % 3);
                fill(120 + ((i * j) % 40));
                noStroke();
                ellipse(i + ((i * j) % 7) - 3, j + ((i + j) % 7) - 3, textureSize, textureSize);
            }
        }
        
        // Crack lines (fixed pattern based on position)
        stroke(80);
        strokeWeight(1);
        let crackPatterns = [
            {startX: 0.3, startY: 0.2, endX: 0.6, endY: 0.5},
            {startX: 0.7, startY: 0.3, endX: 0.4, endY: 0.7},
            {startX: 0.2, startY: 0.8, endX: 0.5, endY: 0.6}
        ];
        for (let pattern of crackPatterns) {
            let startX = x + pattern.startX * width;
            let startY = y + pattern.startY * height;
            let endX = x + pattern.endX * width;
            let endY = y + pattern.endY * height;
            line(startX, startY, endX, endY);
        }
        
        pop();
    }
    
    drawAttackEffect(x, y, size, progress) {
        push();
        translate(x, y);
        
        // Multiple layered effects for more impact
        let alpha = 255 * (1 - progress);
        let effectSize = size * (1 + progress * 2);
        
        // Outer energy ring
        fill(255, 100, 0, alpha * 0.3);
        stroke(255, 0, 0, alpha * 0.5);
        strokeWeight(4);
        ellipse(0, 0, effectSize * 1.5);
        
        // Main flash effect with radial gradient
        drawingContext.fillStyle = this.createRadialGradient(
            `rgba(255, 255, 100, ${alpha/255})`,
            `rgba(255, 0, 0, ${alpha/510})`,
            0, 0, 0, effectSize/2
        );
        noStroke();
        ellipse(0, 0, effectSize);
        
        // Inner bright core
        fill(255, 255, 255, alpha * 0.8);
        ellipse(0, 0, effectSize * 0.3);
        
        // Spark particles
        fill(255, 200, 0, alpha);
        noStroke();
        for (let i = 0; i < 8; i++) {
            let angle = TWO_PI / 8 * i;
            let distance = effectSize * 0.6;
            let sparkX = cos(angle) * distance;
            let sparkY = sin(angle) * distance;
            ellipse(sparkX, sparkY, size/8, size/8);
        }
        
        // Lightning effect
        if (progress < 0.5) {
            stroke(255, 255, 255, alpha);
            strokeWeight(2);
            for (let i = 0; i < 4; i++) {
                let angle = TWO_PI / 4 * i;
                let startX = cos(angle) * effectSize * 0.2;
                let startY = sin(angle) * effectSize * 0.2;
                let endX = cos(angle) * effectSize * 0.7;
                let endY = sin(angle) * effectSize * 0.7;
                
                // Jagged lightning line
                let steps = 5;
                let prevX = startX;
                let prevY = startY;
                for (let j = 1; j <= steps; j++) {
                    let t = j / steps;
                    let nextX = lerp(startX, endX, t) + random(-size/8, size/8);
                    let nextY = lerp(startY, endY, t) + random(-size/8, size/8);
                    line(prevX, prevY, nextX, nextY);
                    prevX = nextX;
                    prevY = nextY;
                }
            }
        }
        
        pop();
    }
}