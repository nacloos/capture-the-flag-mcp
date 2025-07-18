# Detailed Capture the Flag Game Plan

## Game Overview
**Theme**: Cute bees vs ugly flies in a capture the flag battle with combat
**View**: Top-down 2D with camera focused on player
**Technology**: p5.js for graphics rendering

## Core Game Mechanics

### Map Design
- **Layout**: Rectangular battlefield with team bases at opposite ends
- **Central Obstacle**: Large impassable structure in center forcing strategic movement
- **Team Bases**: Protected areas where flags spawn and must be returned
- **Boundaries**: Invisible walls preventing players from leaving map

### Player System
- **Two Teams**: Bee team (cute, yellow/black) vs Fly team (ugly, brown/green)
- **Movement**: WASD or arrow key controls with smooth acceleration/deceleration
- **Health**: 3 hit points, respawn at base when eliminated
- **Attack**: Spacebar to attack nearby enemies, short cooldown between attacks

### Combat System
- **Attack Range**: Short melee range around player
- **Damage**: 1 damage per hit, 3 hits to eliminate
- **Cooldown**: 1 second between attacks to prevent spam
- **Knockback**: Slight pushback when hit
- **Invincibility**: Brief immunity after being hit

### Flag Mechanics
- **Flag States**: At base, being carried, dropped on ground
- **Capture Rules**: Pick up enemy flag, return to own base while your flag is home
- **Drop on Death**: Flag drops when player is eliminated
- **Reset Timer**: Dropped flags return to base after 30 seconds

### Win Conditions
- **Score System**: First team to 3 captures wins
- **Time Limit**: 10 minute matches with sudden death if tied

## Technical Implementation

### File Structure
```
index.html          - Minimal HTML container
sketch.js           - Main p5.js setup and draw loop
game.js             - Game state management
player.js           - Player class, movement, and combat
map.js              - Map layout and collision detection
flag.js             - Flag mechanics and states
camera.js           - Camera following system
graphics.js         - Drawing utilities and sprites
combat.js           - Attack mechanics and hit detection
```

### Key Classes
- **Game**: Overall state, scoring, win conditions
- **Player**: Position, movement, team, health, attack system
- **Flag**: Position, state, team ownership
- **Map**: Obstacles, boundaries, collision detection
- **Camera**: View positioning, smooth following
- **Combat**: Attack range, damage, cooldowns

### Graphics System
- **Bee Sprites**: Round, yellow/black striped, friendly eyes, small wings
- **Fly Sprites**: Angular, brown/green, menacing eyes, large wings
- **Attack Effects**: Brief flash/circle showing attack range
- **Health Indicators**: Small health bars or hearts above players
- **Flag Sprites**: Team-colored banners on poles
- **Base Sprites**: Hives for bees, trash piles for flies

### HUD Elements
- **Score Display**: Team scores in top corners
- **Timer**: Countdown in top center
- **Flag Status**: Icons showing flag locations
- **Player Health**: Your health display
- **Attack Cooldown**: Visual indicator for attack readiness

### Controls
- **Movement**: WASD or arrow keys
- **Attack**: Spacebar
- **Sprint**: Shift key (limited stamina, optional)

## Visual Design Requirements

### Art Style
- **Consistent Theme**: Cartoon-like, family-friendly aesthetic
- **Professional Polish**: No placeholder graphics, cohesive color palette
- **Clear Readability**: High contrast, easily distinguishable teams
- **Smooth Animations**: Fluid movement and transitions

### Color Scheme
- **Bee Team**: Yellow, black, white accents
- **Fly Team**: Brown, green, gray accents
- **Neutral**: Gray obstacles, white background
- **UI**: Clean black text on white/transparent backgrounds

### User Interface
- **Minimal HTML**: Only canvas element, white background
- **Clean HUD**: Non-intrusive overlay elements
- **Responsive**: Adapts to different screen sizes
- **Accessibility**: Clear fonts, sufficient contrast

## Development Phases

### Phase 1: Core Framework
- Set up p5.js environment
- Basic player movement and collision
- Simple map with obstacles
- Camera following system

### Phase 2: Game Mechanics
- Flag pickup and drop mechanics
- Team system implementation
- Combat system with attack mechanics
- Scoring and win conditions
- Basic graphics (simple shapes)

### Phase 3: Visual Polish
- Professional sprite graphics
- Smooth animations
- HUD implementation
- Attack effects and feedback

### Phase 4: Testing & Refinement
- Gameplay balancing
- Performance optimization
- Bug fixes and polish
- Final visual touches