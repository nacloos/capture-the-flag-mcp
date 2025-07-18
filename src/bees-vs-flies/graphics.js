class Particle {
    constructor(x, y, type, color) {
        this.x = x;
        this.y = y;
        this.vx = random(-2, 2);
        this.vy = random(-2, 2);
        this.life = 255;
        this.maxLife = 255;
        this.type = type;
        this.color = color;
        this.size = random(2, 6);
        this.gravity = type === 'trail' ? 0.05 : 0.1;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += this.gravity;
        this.life -= 3;
        
        if (this.type === 'trail') {
            this.life -= 2;
            this.size *= 0.98;
        }
    }
    
    isDead() {
        return this.life <= 0;
    }
    
    draw() {
        push();
        const alpha = map(this.life, 0, this.maxLife, 0, 255);
        this.color.setAlpha(alpha);
        fill(this.color);
        noStroke();
        ellipse(this.x, this.y, this.size, this.size);
        pop();
    }
}

class Sparkle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.life = 60;
        this.maxLife = 60;
        this.color = color;
        this.size = random(1, 3);
        this.twinkle = 0;
    }
    
    update() {
        this.life--;
        this.twinkle += 0.2;
    }
    
    isDead() {
        return this.life <= 0;
    }
    
    draw() {
        push();
        const alpha = map(this.life, 0, this.maxLife, 0, 255);
        const brightness = 1 + sin(this.twinkle) * 0.3;
        this.color.setAlpha(alpha);
        fill(this.color);
        noStroke();
        const sparkleSize = this.size * brightness;
        ellipse(this.x, this.y, sparkleSize, sparkleSize);
        
        // Add cross sparkle effect
        stroke(this.color);
        strokeWeight(1);
        line(this.x - sparkleSize, this.y, this.x + sparkleSize, this.y);
        line(this.x, this.y - sparkleSize, this.x, this.y + sparkleSize);
        pop();
    }
}

class Graphics {
    constructor() {
        this.animationTime = 0;
        this.particles = [];
        this.sparkles = [];
    }
    
    update() {
        this.animationTime += 0.05;
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update();
            if (particle.isDead()) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update sparkles
        for (let i = this.sparkles.length - 1; i >= 0; i--) {
            const sparkle = this.sparkles[i];
            sparkle.update();
            if (sparkle.isDead()) {
                this.sparkles.splice(i, 1);
            }
        }
    }
    
    addParticle(x, y, type, color) {
        this.particles.push(new Particle(x, y, type, color));
    }
    
    addSparkle(x, y, color) {
        this.sparkles.push(new Sparkle(x, y, color));
    }
    
    drawParticles() {
        for (let particle of this.particles) {
            particle.draw();
        }
        
        for (let sparkle of this.sparkles) {
            sparkle.draw();
        }
    }
    
    drawPlayer(player) {
        push();
        
        // Add subtle shadow
        push();
        translate(3, 3);
        fill(0, 0, 0, 50);
        ellipse(0, 0, player.size * 2.2, player.size * 1.8);
        pop();
        
        // Movement trail particles
        if (abs(player.vx) > 0.5 || abs(player.vy) > 0.5) {
            if (frameCount % 3 === 0) {
                const trailColor = player.team === 'bee' ? color(255, 215, 0, 100) : color(139, 69, 19, 100);
                this.addParticle(player.x + random(-5, 5), player.y + random(-5, 5), 'trail', trailColor);
            }
        }
        
        if (player.team === 'bee') {
            this.drawBee(player);
        } else {
            this.drawFly(player);
        }
        
        // Enhanced team indicator for player
        if (player.isPlayer) {
            push();
            stroke(0, 255, 0);
            strokeWeight(3);
            noFill();
            const pulseSize = 2.5 + sin(millis() * 0.008) * 0.3;
            ellipse(0, 0, player.size * pulseSize, player.size * pulseSize);
            
            // Add glowing effect
            stroke(0, 255, 0, 50);
            strokeWeight(8);
            ellipse(0, 0, player.size * pulseSize, player.size * pulseSize);
            pop();
        }
        
        pop();
    }
    
    drawBee(player) {
        // Body with gradient effect
        const bodyGradient = drawingContext.createRadialGradient(0, 0, 0, 0, 0, player.size);
        bodyGradient.addColorStop(0, 'rgba(255, 235, 59, 1)');
        bodyGradient.addColorStop(1, 'rgba(255, 193, 7, 1)');
        drawingContext.fillStyle = bodyGradient;
        
        stroke(0);
        strokeWeight(2);
        ellipse(0, 0, player.size * 2, player.size * 1.5);
        
        // Black stripes with slight wave effect
        fill(0);
        for (let i = 0; i < 3; i++) {
            const waveOffset = sin(this.animationTime * 0.3 + i) * 0.05;
            ellipse(0, -player.size * 0.3 + i * player.size * 0.3 + waveOffset, player.size * 1.8, player.size * 0.2);
        }
        
        // Wings with better animation
        const wingFlap = sin(this.animationTime * 0.8) * 0.4;
        const wingSpeed = abs(player.vx) + abs(player.vy);
        const wingOpacity = 120 + wingSpeed * 20;
        
        fill(255, 255, 255, min(wingOpacity, 180));
        stroke(0);
        strokeWeight(1);
        
        // Left wing
        push();
        translate(-player.size * 0.7, -player.size * 0.3);
        rotate(wingFlap);
        ellipse(0, 0, player.size * 0.8, player.size * 0.4);
        // Wing details
        stroke(0, 0, 0, 80);
        line(-player.size * 0.2, -player.size * 0.1, player.size * 0.2, player.size * 0.1);
        line(-player.size * 0.1, -player.size * 0.15, player.size * 0.1, player.size * 0.15);
        pop();
        
        // Right wing
        push();
        translate(player.size * 0.7, -player.size * 0.3);
        rotate(-wingFlap);
        ellipse(0, 0, player.size * 0.8, player.size * 0.4);
        // Wing details
        stroke(0, 0, 0, 80);
        line(-player.size * 0.2, -player.size * 0.1, player.size * 0.2, player.size * 0.1);
        line(-player.size * 0.1, -player.size * 0.15, player.size * 0.1, player.size * 0.15);
        pop();
        
        // Eyes with shine
        fill(255);
        stroke(0);
        strokeWeight(2);
        ellipse(-player.size * 0.3, -player.size * 0.2, player.size * 0.4, player.size * 0.4);
        ellipse(player.size * 0.3, -player.size * 0.2, player.size * 0.4, player.size * 0.4);
        
        // Pupils
        fill(0);
        ellipse(-player.size * 0.3, -player.size * 0.2, player.size * 0.2, player.size * 0.2);
        ellipse(player.size * 0.3, -player.size * 0.2, player.size * 0.2, player.size * 0.2);
        
        // Eye shine
        fill(255);
        noStroke();
        ellipse(-player.size * 0.25, -player.size * 0.25, player.size * 0.08, player.size * 0.08);
        ellipse(player.size * 0.25, -player.size * 0.25, player.size * 0.08, player.size * 0.08);
        
        // Antennae with slight movement
        stroke(0);
        strokeWeight(2);
        const antennaMove = sin(this.animationTime * 0.4) * 0.1;
        line(-player.size * 0.2, -player.size * 0.8, -player.size * 0.1 + antennaMove, -player.size * 1.2);
        line(player.size * 0.2, -player.size * 0.8, player.size * 0.1 - antennaMove, -player.size * 1.2);
        
        fill(0);
        ellipse(-player.size * 0.1 + antennaMove, -player.size * 1.2, player.size * 0.1, player.size * 0.1);
        ellipse(player.size * 0.1 - antennaMove, -player.size * 1.2, player.size * 0.1, player.size * 0.1);
        
        // Pollen sparkles when moving
        if (wingSpeed > 0.5 && frameCount % 8 === 0) {
            this.addSparkle(player.x + random(-player.size, player.size), 
                           player.y + random(-player.size, player.size), 
                           color(255, 255, 0, 150));
        }
    }
    
    drawFly(player) {
        // Body
        fill(139, 69, 19);
        stroke(0);
        strokeWeight(2);
        ellipse(0, 0, player.size * 1.5, player.size * 2);
        
        // Segments
        stroke(0);
        strokeWeight(1);
        for (let i = 0; i < 4; i++) {
            line(-player.size * 0.7, -player.size * 0.5 + i * player.size * 0.3, 
                 player.size * 0.7, -player.size * 0.5 + i * player.size * 0.3);
        }
        
        // Wings
        fill(128, 128, 128, 100);
        stroke(0);
        strokeWeight(1);
        
        const wingFlap = sin(this.animationTime * 0.3) * 0.5;
        
        // Left wing
        push();
        translate(-player.size * 0.5, -player.size * 0.5);
        rotate(wingFlap);
        ellipse(0, 0, player.size * 1.2, player.size * 0.6);
        pop();
        
        // Right wing
        push();
        translate(player.size * 0.5, -player.size * 0.5);
        rotate(-wingFlap);
        ellipse(0, 0, player.size * 1.2, player.size * 0.6);
        pop();
        
        // Eyes (compound, menacing)
        fill(255, 0, 0);
        ellipse(-player.size * 0.2, -player.size * 0.6, player.size * 0.6, player.size * 0.6);
        ellipse(player.size * 0.2, -player.size * 0.6, player.size * 0.6, player.size * 0.6);
        
        // Eye pattern
        fill(139, 0, 0);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                ellipse(-player.size * 0.2 + (i - 1) * player.size * 0.1, 
                       -player.size * 0.6 + (j - 1) * player.size * 0.1, 
                       player.size * 0.05, player.size * 0.05);
                ellipse(player.size * 0.2 + (i - 1) * player.size * 0.1, 
                       -player.size * 0.6 + (j - 1) * player.size * 0.1, 
                       player.size * 0.05, player.size * 0.05);
            }
        }
        
        // Legs
        stroke(0);
        strokeWeight(1);
        for (let i = 0; i < 3; i++) {
            const legY = -player.size * 0.2 + i * player.size * 0.3;
            line(-player.size * 0.7, legY, -player.size * 1.2, legY + player.size * 0.3);
            line(player.size * 0.7, legY, player.size * 1.2, legY + player.size * 0.3);
        }
    }
}