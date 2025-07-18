let game;
let camera;
let gameMap;
let graphics;

function setup() {
    let canvas = createCanvas(600, 450);
    canvas.parent('game-container');
    
    graphics = new Graphics();
    camera = new Camera();
    gameMap = new GameMap();
    game = new Game();
    
    game.init();
}

function draw() {
    background(255);
    
    // Update game state
    game.update();
    
    // Save current transform
    push();
    
    // Apply camera transform
    camera.apply();
    
    // Draw game world
    gameMap.draw();
    game.draw();
    
    // Restore transform
    pop();
    
    // Draw HUD (fixed position)
    game.drawHUD();
}

function keyPressed() {
    game.handleKeyPressed(key, keyCode);
}

function keyReleased() {
    game.handleKeyReleased(key, keyCode);
}