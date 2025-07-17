package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

func gameLog(event, details string) {
	logEntry := fmt.Sprintf("%s component=server event=%s %s\n", time.Now().Format("2006-01-02 15:04:05"), event, details)
	
	// Get log path from environment variable, default to logs/game_server.log
	logPath := os.Getenv("GAME_LOG_PATH")
	if logPath == "" {
		logPath = "logs/game_server.log"
	}
	
	// Write to file
	file, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		fmt.Printf("Error opening log file: %v\n", err)
		return
	}
	defer file.Close()
	
	file.WriteString(logEntry)
}

type Player struct {
	ID       string  `json:"id"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Team     string  `json:"team"`
	HasFlag  bool    `json:"hasFlag"`
	Name     string  `json:"name"`
	Color    string  `json:"color"`
	IsAlive  bool    `json:"isAlive"`
	RespawnTime int64 `json:"respawnTime"`
	SpawnProtection int64 `json:"spawnProtection"`
	TargetX  float64 `json:"targetX"`
	TargetY  float64 `json:"targetY"`
	IsMoving bool    `json:"isMoving"`
}

type Flag struct {
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Team     string  `json:"team"`
	IsAtBase bool    `json:"isAtBase"`
	Carrier  string  `json:"carrier"`
	DropTime int64   `json:"dropTime"`
}

type TeamMessage struct {
	Sender    string `json:"sender"`
	Message   string `json:"message"`
	Timestamp int64  `json:"timestamp"`
	Team      string `json:"team"`
}

type GameState struct {
	Players   map[string]*Player `json:"players"`
	RedFlag   *Flag              `json:"redFlag"`
	BlueFlag  *Flag              `json:"blueFlag"`
	RedScore  int                `json:"redScore"`
	BlueScore int                `json:"blueScore"`
	GameTime  int64              `json:"gameTime"`
	GameStarted bool             `json:"gameStarted"`
	GameStartTime int64          `json:"gameStartTime"`
	GameDuration int64           `json:"gameDuration"`
	GameEnded bool               `json:"gameEnded"`
	Winner string                `json:"winner"`
	RedTeamMessages  []TeamMessage `json:"redTeamMessages"`
	BlueTeamMessages []TeamMessage `json:"blueTeamMessages"`
}

type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	gameState  *GameState
	mutex      sync.RWMutex
	usedNames  map[string]bool
	connToPlayer map[*websocket.Conn]string // maps connection to player ID
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
		gameState:  initGameState(),
		usedNames:  make(map[string]bool),
		connToPlayer: make(map[*websocket.Conn]string),
	}
}

func initGameState() *GameState {
	now := time.Now().UnixMilli()
	return &GameState{
		Players: make(map[string]*Player),
		RedFlag: &Flag{
			X:        100,
			Y:        300,
			Team:     "red",
			IsAtBase: true,
			Carrier:  "",
			DropTime: 0,
		},
		BlueFlag: &Flag{
			X:        700,
			Y:        300,
			Team:     "blue",
			IsAtBase: true,
			Carrier:  "",
			DropTime: 0,
		},
		RedScore:    0,
		BlueScore:   0,
		GameTime:    now,
		GameStarted: true,
		GameStartTime: now,
		GameDuration: 900000, // 15 minutes in milliseconds
		GameEnded:   false,
		Winner:      "",
		RedTeamMessages:  make([]TeamMessage, 0),
		BlueTeamMessages: make([]TeamMessage, 0),
	}
}

func (h *Hub) run() {
	ticker := time.NewTicker(16 * time.Millisecond) // 60 FPS
	defer ticker.Stop()

	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			h.sendGameState(client)

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				// Clean up player data for this client
				h.cleanupPlayerData(client)
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					client.Close()
					delete(h.clients, client)
				}
			}

		case <-ticker.C:
			h.updateGame()
		}
	}
}

func (h *Hub) updateGame() {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	now := time.Now().UnixMilli()
	
	// Update respawn times and spawn protection
	for _, player := range h.gameState.Players {
		if !player.IsAlive && now >= player.RespawnTime {
			player.IsAlive = true
			player.HasFlag = false
			player.SpawnProtection = now + 3000 // 3 seconds of protection
			// Respawn at base
			if player.Team == "red" {
				player.X = 50
				player.Y = 300
			} else {
				player.X = 750
				player.Y = 300
			}
			player.IsMoving = false // Stop movement when respawning
		}
		
		// Update continuous movement
		if player.IsAlive && player.IsMoving {
			const moveSpeed = 5.0 // pixels per frame
			
			dx := player.TargetX - player.X
			dy := player.TargetY - player.Y
			distance := math.Sqrt(dx*dx + dy*dy)
			
			if distance <= moveSpeed {
				// Reached target
				player.X = player.TargetX
				player.Y = player.TargetY
				player.IsMoving = false
			} else {
				// Calculate new position
				newX := player.X + (dx / distance) * moveSpeed
				newY := player.Y + (dy / distance) * moveSpeed
				
				// Check wall collision before moving
				if !h.checkWallCollision(newX, newY) {
					player.X = newX
					player.Y = newY
				} else {
					// Stop movement if hitting wall
					player.IsMoving = false
				}
			}
			
			// Ensure player stays in bounds
			player.X = math.Max(0, math.Min(800, player.X))
			player.Y = math.Max(0, math.Min(600, player.Y))
			
			// Check flag interactions
			h.checkFlagInteractions(player)
		}
	}

	// Update game time
	h.gameState.GameTime = now
	
	// Clean up old messages (older than 60 seconds)
	h.cleanupOldMessages(now)
	
	// Check for dropped flags that should return to base after 30 seconds
	if !h.gameState.RedFlag.IsAtBase && h.gameState.RedFlag.Carrier == "" && h.gameState.RedFlag.DropTime > 0 {
		if now-h.gameState.RedFlag.DropTime > 30000 { // 30 seconds
			h.gameState.RedFlag.X = 100
			h.gameState.RedFlag.Y = 300
			h.gameState.RedFlag.IsAtBase = true
			h.gameState.RedFlag.DropTime = 0
		}
	}
	
	if !h.gameState.BlueFlag.IsAtBase && h.gameState.BlueFlag.Carrier == "" && h.gameState.BlueFlag.DropTime > 0 {
		if now-h.gameState.BlueFlag.DropTime > 30000 { // 30 seconds
			h.gameState.BlueFlag.X = 700
			h.gameState.BlueFlag.Y = 300
			h.gameState.BlueFlag.IsAtBase = true
			h.gameState.BlueFlag.DropTime = 0
		}
	}

	// Check if game should end
	if !h.gameState.GameEnded {
		gameElapsed := now - h.gameState.GameStartTime
		if gameElapsed >= h.gameState.GameDuration {
			h.gameState.GameEnded = true
			// Determine winner based on score
			if h.gameState.RedScore > h.gameState.BlueScore {
				h.gameState.Winner = "red"
			} else if h.gameState.BlueScore > h.gameState.RedScore {
				h.gameState.Winner = "blue"
			} else {
				h.gameState.Winner = "tie"
			}
		}
		
		// Also check for score-based victory (first to 10 points wins)
		if h.gameState.RedScore >= 10 {
			h.gameState.GameEnded = true
			h.gameState.Winner = "red"
		} else if h.gameState.BlueScore >= 10 {
			h.gameState.GameEnded = true
			h.gameState.Winner = "blue"
		}
	}

	// Broadcast game state
	h.broadcastGameState()
}

func (h *Hub) sendGameState(client *websocket.Conn) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	data, _ := json.Marshal(h.gameState)
	client.WriteMessage(websocket.TextMessage, data)
}

func (h *Hub) broadcastGameState() {
	data, _ := json.Marshal(h.gameState)
	for client := range h.clients {
		err := client.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			client.Close()
			delete(h.clients, client)
		}
	}
}

func (h *Hub) handlePlayerAction(playerID string, action map[string]interface{}) {
	h.mutex.Lock()
	defer h.mutex.Unlock()

	
	player, exists := h.gameState.Players[playerID]
	if !exists {
		return
	}
	if !player.IsAlive {
		return
	}

	switch action["type"] {
	case "move":
		x, okX := action["x"].(float64)
		y, okY := action["y"].(float64)
		if okX && okY {
			// Boundary checking
			if x >= 0 && x <= 800 && y >= 0 && y <= 600 {
				// Check if target position would collide with wall
				if !h.checkWallCollision(x, y) {
					// Set target position for continuous movement
					player.TargetX = x
					player.TargetY = y
					player.IsMoving = true
					gameLog("player_moved", fmt.Sprintf("player_id=%s from_x=%.0f from_y=%.0f to_x=%.0f to_y=%.0f", playerID, player.X, player.Y, x, y))
				} else {
					// Send error message back to client for wall collision
					h.sendErrorMessage(playerID, "Cannot move to target: position blocked by wall")
				}
			} else {
				// Send error message for out of bounds
				h.sendErrorMessage(playerID, "Cannot move to target: position out of bounds")
			}
		}
	case "attack":
		h.handleAttack(player)
	case "chat":
		message, ok := action["message"].(string)
		if ok && len(message) > 0 && len(message) <= 200 {
			h.handleTeamChat(player, message)
		}
	}
}

func (h *Hub) checkFlagInteractions(player *Player) {
	const flagRadius = 10.0
	
	// Check red flag pickup
	if player.Team == "blue" && !player.HasFlag {
		dx := player.X - h.gameState.RedFlag.X
		dy := player.Y - h.gameState.RedFlag.Y
		if dx*dx + dy*dy < flagRadius*flagRadius {
			if h.gameState.RedFlag.IsAtBase || h.gameState.RedFlag.Carrier == "" {
				player.HasFlag = true
				h.gameState.RedFlag.IsAtBase = false
				h.gameState.RedFlag.Carrier = player.ID
				h.gameState.RedFlag.DropTime = 0
				gameLog("flag_picked_up", fmt.Sprintf("player_id=%s team=%s flag_team=red", player.ID, player.Team))
			}
		}
	}
	
	// Check blue flag pickup
	if player.Team == "red" && !player.HasFlag {
		dx := player.X - h.gameState.BlueFlag.X
		dy := player.Y - h.gameState.BlueFlag.Y
		if dx*dx + dy*dy < flagRadius*flagRadius {
			if h.gameState.BlueFlag.IsAtBase || h.gameState.BlueFlag.Carrier == "" {
				player.HasFlag = true
				h.gameState.BlueFlag.IsAtBase = false
				h.gameState.BlueFlag.Carrier = player.ID
				h.gameState.BlueFlag.DropTime = 0
				gameLog("flag_picked_up", fmt.Sprintf("player_id=%s team=%s flag_team=blue", player.ID, player.Team))
			}
		}
	}
	
	// Check flag recovery (returning dropped team flag to base)
	if player.Team == "red" && !h.gameState.RedFlag.IsAtBase && h.gameState.RedFlag.Carrier == "" {
		dx := player.X - h.gameState.RedFlag.X
		dy := player.Y - h.gameState.RedFlag.Y
		if dx*dx + dy*dy < flagRadius*flagRadius {
			// Return red flag to base
			h.gameState.RedFlag.X = 100
			h.gameState.RedFlag.Y = 300
			h.gameState.RedFlag.IsAtBase = true
			h.gameState.RedFlag.DropTime = 0
		}
	}
	
	if player.Team == "blue" && !h.gameState.BlueFlag.IsAtBase && h.gameState.BlueFlag.Carrier == "" {
		dx := player.X - h.gameState.BlueFlag.X
		dy := player.Y - h.gameState.BlueFlag.Y
		if dx*dx + dy*dy < flagRadius*flagRadius {
			// Return blue flag to base
			h.gameState.BlueFlag.X = 700
			h.gameState.BlueFlag.Y = 300
			h.gameState.BlueFlag.IsAtBase = true
			h.gameState.BlueFlag.DropTime = 0
		}
	}
	
	// Check scoring
	if player.HasFlag {
		if player.Team == "red" && player.X < 100 && player.Y > 250 && player.Y < 350 {
			// Red team scores
			h.gameState.RedScore++
			player.HasFlag = false
			h.gameState.BlueFlag.X = 700
			h.gameState.BlueFlag.Y = 300
			h.gameState.BlueFlag.IsAtBase = true
			h.gameState.BlueFlag.Carrier = ""
			h.gameState.BlueFlag.DropTime = 0
			gameLog("flag_captured", fmt.Sprintf("player_id=%s team=red flag_team=blue red_score=%d blue_score=%d", player.ID, h.gameState.RedScore, h.gameState.BlueScore))
		} else if player.Team == "blue" && player.X > 700 && player.Y > 250 && player.Y < 350 {
			// Blue team scores
			h.gameState.BlueScore++
			player.HasFlag = false
			h.gameState.RedFlag.X = 100
			h.gameState.RedFlag.Y = 300
			h.gameState.RedFlag.IsAtBase = true
			h.gameState.RedFlag.Carrier = ""
			h.gameState.RedFlag.DropTime = 0
			gameLog("flag_captured", fmt.Sprintf("player_id=%s team=blue flag_team=red red_score=%d blue_score=%d", player.ID, h.gameState.RedScore, h.gameState.BlueScore))
		}
	}
	
	// Update flag positions for carried flags
	if h.gameState.RedFlag.Carrier == player.ID {
		h.gameState.RedFlag.X = player.X
		h.gameState.RedFlag.Y = player.Y
	}
	if h.gameState.BlueFlag.Carrier == player.ID {
		h.gameState.BlueFlag.X = player.X
		h.gameState.BlueFlag.Y = player.Y
	}
}

func (h *Hub) handleAttack(attacker *Player) {
	const attackRange = 50.0 // Attack range in pixels
	now := time.Now().UnixMilli()
	
	
	for _, target := range h.gameState.Players {
		if target.ID == attacker.ID || target.Team == attacker.Team || !target.IsAlive {
			continue
		}
		
		// Check spawn protection
		if now < target.SpawnProtection {
			continue
		}
		
		// Calculate distance from attacker to target
		dx := target.X - attacker.X
		dy := target.Y - attacker.Y
		distance := dx*dx + dy*dy
		
		if distance < attackRange*attackRange {
			// Target is hit
			target.IsAlive = false
			target.RespawnTime = time.Now().UnixMilli() + 5000 // 5 second respawn
			target.SpawnProtection = 0 // Reset spawn protection
			gameLog("player_eliminated", fmt.Sprintf("player_id=%s team=%s eliminated_by=%s", target.ID, target.Team, attacker.ID))
			
			// Drop flag if carrying one
			if target.HasFlag {
				target.HasFlag = false
				if h.gameState.RedFlag.Carrier == target.ID {
					h.gameState.RedFlag.Carrier = ""
					h.gameState.RedFlag.DropTime = now
				}
				if h.gameState.BlueFlag.Carrier == target.ID {
					h.gameState.BlueFlag.Carrier = ""
					h.gameState.BlueFlag.DropTime = now
				}
			}
			break // Only attack one enemy per attack action
		}
	}
}

func (h *Hub) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()

	h.register <- conn

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			h.unregister <- conn
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "join":
			data := msg.Data.(map[string]interface{})
			playerID := data["id"].(string)
			team := data["team"].(string)
			name := data["name"].(string)
			
			h.mutex.Lock()
			
			// Check if name is already taken
			if h.usedNames[name] {
				h.mutex.Unlock()
				// Send error message back to client
				errorMsg := Message{
					Type: "error",
					Data: map[string]interface{}{
						"message": fmt.Sprintf("Player name '%s' is already taken", name),
					},
				}
				errorData, _ := json.Marshal(errorMsg)
				conn.WriteMessage(websocket.TextMessage, errorData)
				gameLog("player_join_failed", fmt.Sprintf("player_id=%s team=%s name=%s reason=name_taken", playerID, team, name))
				continue
			}
			
			// Mark name as used
			h.usedNames[name] = true
			
			color := "#ff0000"
			if team == "blue" {
				color = "#0000ff"
			}
			
			x, y := 50.0, 300.0
			if team == "blue" {
				x = 750.0
			}
			
			h.gameState.Players[playerID] = &Player{
				ID:      playerID,
				X:       x,
				Y:       y,
				Team:    team,
				HasFlag: false,
				Name:    name,
				Color:   color,
				IsAlive: true,
				RespawnTime: 0,
				SpawnProtection: time.Now().UnixMilli() + 3000, // 3 seconds initial protection
			}
			
			// Track connection to player mapping
			h.connToPlayer[conn] = playerID
			
			h.mutex.Unlock()
			
			gameLog("player_joined", fmt.Sprintf("player_id=%s team=%s name=%s", playerID, team, name))
			
		case "action":
			data := msg.Data.(map[string]interface{})
			playerID := data["playerId"].(string)
			action := data["action"].(map[string]interface{})
			h.handlePlayerAction(playerID, action)
		}
	}
}

func (h *Hub) checkWallCollision(x, y float64) bool {
	// Center wall obstacle: 350-450 x, 250-350 y (100x100 pixels)
	const wallLeft = 350.0
	const wallRight = 450.0
	const wallTop = 250.0
	const wallBottom = 350.0
	const playerRadius = 15.0 // Player collision radius
	
	// Check if player (with radius) would collide with wall
	return x+playerRadius > wallLeft && x-playerRadius < wallRight && 
		   y+playerRadius > wallTop && y-playerRadius < wallBottom
}

func (h *Hub) sendErrorMessage(playerID string, message string) {
	// For now, we'll just log the error
	// In a full implementation, you could send this back to the specific client
	log.Printf("Player %s: %s", playerID, message)
}

func (h *Hub) cleanupPlayerData(conn *websocket.Conn) {
	h.mutex.Lock()
	defer h.mutex.Unlock()
	
	// Find the player ID for this connection
	playerID, exists := h.connToPlayer[conn]
	if !exists {
		return
	}
	
	// Remove connection mapping
	delete(h.connToPlayer, conn)
	
	// Find and remove the player
	if player, exists := h.gameState.Players[playerID]; exists {
		// Free up the player's name
		delete(h.usedNames, player.Name)
		
		// Remove player from game state
		delete(h.gameState.Players, playerID)
		
		// If player was carrying a flag, drop it
		if player.HasFlag {
			now := time.Now().UnixMilli()
			if h.gameState.RedFlag.Carrier == playerID {
				h.gameState.RedFlag.Carrier = ""
				h.gameState.RedFlag.DropTime = now
			}
			if h.gameState.BlueFlag.Carrier == playerID {
				h.gameState.BlueFlag.Carrier = ""
				h.gameState.BlueFlag.DropTime = now
			}
		}
		
		gameLog("player_left", fmt.Sprintf("player_id=%s team=%s name=%s", playerID, player.Team, player.Name))
	}
}

func (h *Hub) handleTeamChat(player *Player, message string) {
	now := time.Now().UnixMilli()
	
	teamMessage := TeamMessage{
		Sender:    player.Name,
		Message:   message,
		Timestamp: now,
		Team:      player.Team,
	}
	
	// Add message to appropriate team
	if player.Team == "red" {
		h.gameState.RedTeamMessages = append(h.gameState.RedTeamMessages, teamMessage)
		// Keep only last 10 messages
		if len(h.gameState.RedTeamMessages) > 10 {
			h.gameState.RedTeamMessages = h.gameState.RedTeamMessages[1:]
		}
	} else {
		h.gameState.BlueTeamMessages = append(h.gameState.BlueTeamMessages, teamMessage)
		// Keep only last 10 messages
		if len(h.gameState.BlueTeamMessages) > 10 {
			h.gameState.BlueTeamMessages = h.gameState.BlueTeamMessages[1:]
		}
	}
	
	gameLog("team_chat", fmt.Sprintf("player_id=%s team=%s name=%s message=%s", player.ID, player.Team, player.Name, message))
}

func (h *Hub) cleanupOldMessages(now int64) {
	const maxAge = 60000 // 60 seconds in milliseconds
	
	// Clean up red team messages
	validRed := make([]TeamMessage, 0)
	for _, msg := range h.gameState.RedTeamMessages {
		if now-msg.Timestamp < maxAge {
			validRed = append(validRed, msg)
		}
	}
	h.gameState.RedTeamMessages = validRed
	
	// Clean up blue team messages
	validBlue := make([]TeamMessage, 0)
	for _, msg := range h.gameState.BlueTeamMessages {
		if now-msg.Timestamp < maxAge {
			validBlue = append(validBlue, msg)
		}
	}
	h.gameState.BlueTeamMessages = validBlue
}

func (h *Hub) handleGameState(w http.ResponseWriter, r *http.Request) {
	h.mutex.RLock()
	defer h.mutex.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(h.gameState)
}

func main() {
	hub := newHub()
	go hub.run()

	http.HandleFunc("/ws", hub.handleWebSocket)
	http.HandleFunc("/game-state", hub.handleGameState)
	
	// Serve static files
	fs := http.FileServer(http.Dir("./static/"))
	http.Handle("/", fs)

	fmt.Println("Server starting on localhost:8080")
	log.Fatal(http.ListenAndServe("localhost:8080", nil))
}