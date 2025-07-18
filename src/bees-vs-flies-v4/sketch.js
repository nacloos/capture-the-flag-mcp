// Global variables
let gameMap;
let camera;
let game;
let hud;

function setup() {
    // Create canvas
    let canvas = createCanvas(800, 600);
    canvas.parent('gameContainer');
    
    // Initialize game systems
    gameMap = new GameMap();
    camera = new Camera();
    game = new Game();
    hud = new HUD();
    
    // Start the game
    game.init();
    
    // Set initial camera position
    let player = game.getPlayer();
    if (player) {
        camera.follow(player);
        camera.x = camera.targetX;
        camera.y = camera.targetY;
    }
}

function draw() {
    background(135, 206, 235); // Sky blue
    
    // Update game systems
    game.update();
    hud.update();
    
    // Draw everything
    game.draw();
}

function keyPressed() {
    game.handleKeyPressed(key);
}

// Prevent default arrow key behavior
function keyPressed() {
    if (keyCode === UP_ARROW || keyCode === DOWN_ARROW || 
        keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) {
        event.preventDefault();
    }
    
    game.handleKeyPressed(key);
}

// Window resize handler
function windowResized() {
    // Keep the game canvas at fixed size for consistent gameplay
    // This prevents camera and game logic issues
}