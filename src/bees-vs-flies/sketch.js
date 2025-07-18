let game;
let camera;
let gameMap;
let graphics;

function setup() {
    let canvas = createCanvas(800, 600);
    canvas.parent('gameContainer');
    
    gameMap = new GameMap();
    camera = new Camera();
    graphics = new Graphics();
    game = new Game();
    
    game.init();
}

function draw() {
    background(255);
    
    camera.update();
    
    push();
    translate(-camera.x, -camera.y);
    
    gameMap.draw();
    game.update();
    game.draw();
    
    pop();
    
    game.drawHUD();
}

function keyPressed() {
    game.handleKeyPressed(key, keyCode);
}

function keyReleased() {
    game.handleKeyReleased(key, keyCode);
}