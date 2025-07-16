#!/usr/bin/env python3

import asyncio
import json
import requests
import websockets
import uuid
import time
import functools
import argparse
import sys
import os
from datetime import datetime
from typing import Dict, Any, Optional, Union
from fastmcp import FastMCP

def mcp_log(event: str, details: str):
    """Log MCP server events to file"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"{timestamp} component=mcp_server event={event} {details}\n"
    
    # Get log path from environment variable, default to logs/mcp_server.log
    log_path = os.getenv("MCP_LOG_PATH", "logs/mcp_server.log")
    
    try:
        with open(log_path, "a") as f:
            f.write(log_entry)
    except Exception as e:
        print(f"Error writing to log file: {e}")
        # Fallback to console if file write fails
        print(log_entry.strip())

# Rate limiting configuration (will be updated from command line args)
class RateLimitConfig:
    calls = 10  # Maximum calls per period
    period = 1.0  # Period in seconds
    enabled = True  # Set to False to disable rate limiting

# Rate limiter class
class RateLimiter:
    def __init__(self, max_calls: int, period: float):
        self.max_calls = max_calls
        self.period = period
        self.calls = []
    
    def is_allowed(self) -> bool:
        now = time.time()
        # Remove old calls outside the time window
        self.calls = [call_time for call_time in self.calls if now - call_time < self.period]
        
        if len(self.calls) >= self.max_calls:
            return False
        
        self.calls.append(now)
        return True
    
    def time_until_next_call(self) -> float:
        if not self.calls:
            return 0.0
        
        now = time.time()
        oldest_call = min(self.calls)
        return max(0.0, self.period - (now - oldest_call))

# Global rate limiter
rate_limiter = RateLimiter(RateLimitConfig.calls, RateLimitConfig.period)

def rate_limit(func):
    """Decorator to add rate limiting to MCP tools"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        if RateLimitConfig.enabled and not rate_limiter.is_allowed():
            wait_time = rate_limiter.time_until_next_call()
            # Log rate limit hit
            agent_name = getattr(game_connection, 'player_name', 'unknown')
            calls_in_window = len(rate_limiter.calls)
            mcp_log("rate_limit_hit", f"agent={agent_name} calls_in_window={calls_in_window} time_until_reset={wait_time:.1f}")
            return f"⏳ Rate limit exceeded. Please wait {wait_time:.1f} seconds before calling tools again. (Limit: {RateLimitConfig.calls} calls per {RateLimitConfig.period} seconds)"
        
        # Handle both sync and async functions
        result = func(*args, **kwargs)
        return result
    return wrapper

def _format_game_state() -> str:
    """
    Helper function to format the current game state.
    
    Returns:
        str: Formatted game state summary
    """
    try:
        game_state = game_connection.get_game_state_sync()
        
        # Build concise status message
        lines = []
        
        # Game status
        red_score = game_state.get("redScore", 0)
        blue_score = game_state.get("blueScore", 0)
        lines.append(f"SCORE: Red {red_score} - Blue {blue_score}")
        
        # My player status
        if game_connection.player_id:
            my_player = game_state.get("players", {}).get(game_connection.player_id)
            if my_player:
                x, y = my_player.get("x", 0), my_player.get("y", 0)
                team = game_connection.player_team
                has_flag = my_player.get("hasFlag", False)
                is_alive = my_player.get("isAlive", True)
                flag_status = " (carrying flag)" if has_flag else ""
                life_status = " (dead)" if not is_alive else ""
                lines.append(f"ME: {team.upper()} team at ({x},{y}){flag_status}{life_status}")
            else:
                lines.append("ME: Not found in game")
        else:
            lines.append("ME: Not connected")
        
        # Flag positions with clear carrier indication
        red_flag = game_state.get("redFlag", {})
        blue_flag = game_state.get("blueFlag", {})
        
        red_carrier = red_flag.get("carrier", "")
        blue_carrier = blue_flag.get("carrier", "")
        
        # Helper function to identify carrier relationship
        def get_carrier_description(carrier_id):
            if carrier_id == game_connection.player_id:
                return "ME"
            elif carrier_id:
                carrier_player = game_state.get("players", {}).get(carrier_id)
                if carrier_player:
                    carrier_team = carrier_player.get("team")
                    if carrier_team == game_connection.player_team:
                        return f"teammate {carrier_player.get('name', 'unknown')}"
                    else:
                        return f"enemy {carrier_player.get('name', 'unknown')}"
            return None
        
        if red_carrier:
            carrier_desc = get_carrier_description(red_carrier)
            lines.append(f"RED FLAG: carried by {carrier_desc}")
        else:
            rx, ry = red_flag.get("x", 100), red_flag.get("y", 300)
            at_base = red_flag.get("isAtBase", True)
            base_info = " (at base)" if at_base else " (dropped)"
            lines.append(f"RED FLAG: at ({rx},{ry}){base_info}")
            
        if blue_carrier:
            carrier_desc = get_carrier_description(blue_carrier)
            lines.append(f"BLUE FLAG: carried by {carrier_desc}")
        else:
            bx, by = blue_flag.get("x", 700), blue_flag.get("y", 300)
            at_base = blue_flag.get("isAtBase", True)
            base_info = " (at base)" if at_base else " (dropped)"
            lines.append(f"BLUE FLAG: at ({bx},{by}){base_info}")
        
        # Enemy and teammate players
        enemies = []
        teammates = []
        for pid, player in game_state.get("players", {}).items():
            if pid != game_connection.player_id and player.get("isAlive", True):
                px, py = player.get("x", 0), player.get("y", 0)
                player_name = player.get("name", "unknown")
                flag_info = " (carrying flag)" if player.get("hasFlag", False) else ""
                
                if player.get("team") != game_connection.player_team:
                    enemies.append(f"{player_name} at ({px},{py}){flag_info}")
                else:
                    teammates.append(f"{player_name} at ({px},{py}){flag_info}")
        
        if teammates:
            lines.append(f"TEAMMATES: {', '.join(teammates)}")
        
        if enemies:
            lines.append(f"ENEMIES: {', '.join(enemies)}")
        else:
            lines.append("ENEMIES: None visible")
        
        # Team chat messages (only show own team's messages)
        if game_connection.player_team:
            team_messages = []
            if game_connection.player_team == "red":
                team_messages = game_state.get("redTeamMessages", [])
            else:
                team_messages = game_state.get("blueTeamMessages", [])
            
            if team_messages:
                lines.append("TEAM CHAT:")
                for msg in team_messages[-5:]:  # Show last 5 messages
                    sender = msg.get("sender", "unknown")
                    message = msg.get("message", "")
                    timestamp = msg.get("timestamp", 0)
                    # Calculate time ago
                    now = game_state.get("gameTime", timestamp)
                    seconds_ago = max(0, (now - timestamp) // 1000)
                    time_ago = f"{seconds_ago}s ago" if seconds_ago > 0 else "now"
                    lines.append(f"  {sender}: \"{message}\" ({time_ago})")
            else:
                lines.append("TEAM CHAT: No recent messages")
        
        # Field layout
        lines.append("FIELD: Red base (50,300), Blue base (750,300), Wall (350-450,250-350)")
        
        return "\n".join(lines)
        
    except Exception as e:
        return f"Error getting game state: {str(e)}"

# MCP Server for Capture the Flag Game
mcp = FastMCP(name="capture_flag_game")

# Game connection state
class GameConnection:
    def __init__(self):
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.player_id: Optional[str] = None
        self.player_name: Optional[str] = None
        self.player_team: Optional[str] = None
        self.game_state: Dict[str, Any] = {}
        self.server_url = "localhost:8080"
        self.ws_url = f"ws://{self.server_url}/ws"
        self.http_url = f"http://{self.server_url}/game-state"
        self.last_error: Optional[str] = None
        
    async def connect(self, player_name: str, team: str) -> str:
        """Connect to the game server via WebSocket"""
        try:
            self.player_id = f"player_{uuid.uuid4().hex[:8]}"
            self.player_name = player_name
            self.player_team = team
            self.last_error = None
            self.websocket = await websockets.connect(self.ws_url)
            
            # Send join message
            join_message = {
                "type": "join",
                "data": {
                    "id": self.player_id,
                    "name": player_name,
                    "team": team
                }
            }
            await self.websocket.send(json.dumps(join_message))
            
            # Start listening for game state updates
            asyncio.create_task(self._listen_for_updates())
            
            # Wait briefly to check for error messages
            await asyncio.sleep(0.1)
            
            # Check if we received an error message
            if self.last_error:
                error_msg = self.last_error
                # Reset connection state
                self.player_id = None
                self.player_name = None
                self.player_team = None
                self.last_error = None
                if self.websocket:
                    await self.websocket.close()
                    self.websocket = None
                raise Exception(error_msg)
            
            return self.player_id
            
        except Exception as e:
            # Log connection error
            if hasattr(self, 'player_name') and self.player_name:
                mcp_log("tool_executed", f"tool=websocket_connect agent={self.player_name} execution_time_ms=0 success=false details={str(e)}")
            raise Exception(f"Failed to connect to game server: {str(e)}")
    
    async def _listen_for_updates(self):
        """Listen for game state updates from the server"""
        try:
            if self.websocket:
                async for message in self.websocket:
                    data = json.loads(message)
                    
                    # Check if this is an error message
                    if isinstance(data, dict) and data.get("type") == "error":
                        # Store error message for retrieval
                        self.last_error = data.get("data", {}).get("message", "Unknown error")
                        continue
                    
                    # Otherwise, treat as game state update
                    self.game_state = data
        except Exception as e:
            # Log WebSocket error
            if hasattr(self, 'player_name') and self.player_name:
                mcp_log("tool_executed", f"tool=websocket_listen agent={self.player_name} execution_time_ms=0 success=false details={str(e)}")
    
    async def send_action(self, action: Dict[str, Any]):
        """Send an action to the game server"""
        if not self.websocket or not self.player_id:
            raise Exception("Not connected to game server")
        
        action_message = {
            "type": "action",
            "data": {
                "playerId": self.player_id,
                "action": action
            }
        }
        await self.websocket.send(json.dumps(action_message))
    
    def get_game_state_sync(self) -> Dict[str, Any]:
        """Get current game state via HTTP request"""
        try:
            response = requests.get(self.http_url, timeout=5)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            raise Exception(f"Failed to get game state: {str(e)}")

# Store connections per session (in a real MCP server, this would be per-session)
# For now, we'll use a simple approach with a single connection but fix the overwrite issue
game_connection = GameConnection()
_active_sessions = {}  # session_id -> connection_info




@mcp.tool
@rate_limit
async def join_game(player_name: str, team: str) -> str:
    """
    Join the capture the flag game as a new player.
    
    This must be called once at the start before using any other actions.
    
    Args:
        player_name (str): Your display name (1-20 characters, visible to other players)
        team (str): Team to join - either "red" or "blue"
    
    Returns:
        str: Success message with starting position and game state, or error description
    
    Details:
    - You spawn at your team's base with 3 seconds of spawn protection
    - Red team spawns at position (50, 300), blue team at (750, 300)
    - Your player is a circle that can move around the 800x600 field
    - Only one player per MCP server instance - call this once per game session
    
    Example:
        join_game("MyBot", "red")
    """
    start_time = time.time()
    
    if not player_name.strip():
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=join_game agent={player_name} execution_time_ms={execution_time_ms} success=false details=empty_name")
        return "Error: player_name cannot be empty"
    if team not in ["red", "blue"]:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=join_game agent={player_name} execution_time_ms={execution_time_ms} success=false details=invalid_team")
        return "Error: team must be 'red' or 'blue'"
    
    # Check if already connected
    if game_connection.player_id:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=join_game agent={player_name} execution_time_ms={execution_time_ms} success=false details=already_connected")
        return f"Error: Already connected as {game_connection.player_name} on {game_connection.player_team} team. Cannot join multiple times per MCP server instance."
    
    try:
        player_id = await game_connection.connect(player_name.strip(), team)
        
        # Log agent connection
        mcp_log("agent_connected", f"agent_name={player_name} team={team}")
        
        # Get initial position info
        try:
            await asyncio.sleep(0.5)  # Wait for game state to update
            game_state = game_connection.get_game_state_sync()
            my_player = game_state.get("players", {}).get(player_id)
            
            if my_player:
                pos_x = my_player.get("x", 0)
                pos_y = my_player.get("y", 0)
                # Log successful tool execution
                execution_time_ms = int((time.time() - start_time) * 1000)
                mcp_log("tool_executed", f"tool=join_game agent={player_name} execution_time_ms={execution_time_ms} success=true details=player_id={player_id}")
                
                action_result = f"✅ Successfully joined as '{player_name}' on {team.upper()} team!\n" \
                               f"📍 Starting position: ({pos_x}, {pos_y})"
                
                # Add game state
                game_state_info = _format_game_state()
                return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
            else:
                # Log successful tool execution
                execution_time_ms = int((time.time() - start_time) * 1000)
                mcp_log("tool_executed", f"tool=join_game agent={player_name} execution_time_ms={execution_time_ms} success=true details=player_id={player_id}")
                
                action_result = f"✅ Joined as {player_name} on {team.upper()} team!\n" \
                               f"⚠️ Player not yet visible in game state"
                
                # Add game state
                game_state_info = _format_game_state()
                return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
                       
        except:
            # Log successful tool execution
            execution_time_ms = int((time.time() - start_time) * 1000)
            mcp_log("tool_executed", f"tool=join_game agent={player_name} execution_time_ms={execution_time_ms} success=true details=player_id={player_id}")
            
            action_result = f"✅ Joined as {player_name} on {team.upper()} team!"
            
            # Add game state
            game_state_info = _format_game_state()
            return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
                   
    except Exception as e:
        # Log failed tool execution
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=join_game agent={player_name} execution_time_ms={execution_time_ms} success=false details={str(e)}")
        return f"❌ Error joining game: {str(e)}"

@mcp.tool
@rate_limit
async def move_to_position(x: float, y: float) -> str:
    """
    Move your player to a specific target position on the game field.
    
    This is a blocking action that waits until your player reaches the target position.
    Movement is continuous at 5 pixels per frame (about 80 pixels per second).
    
    Args:
        x (float): X coordinate to move to (0-800, left edge to right edge)
        y (float): Y coordinate to move to (0-600, top edge to bottom edge)
    
    Returns:
        str: Success message when target is reached, or error description
    
    Movement mechanics:
    - Continuous movement at 5 pixels per frame toward target
    - Action blocks until player reaches target position
    - Movement can be interrupted by death (respawning stops movement)
    - Maximum distance limited to 200 pixels per move for safety
    
    Automatic interactions when moving close (within ~10 pixels):
    - Enemy flag: Pick up automatically if not already carrying a flag
    - Your base with enemy flag: Score a point and reset enemy flag to their base
    - Your dropped flag: Return it to your base automatically
    
    Strategy:
    - Move directly to target positions (flags, bases, strategic points)
    - Movement is visible to other players in real-time
    - Plan routes around obstacles (use get_game_state() to see field layout)
    - Use obstacles for cover or to block enemy movement paths
    
    Example:
        move_to_position(700, 300)  # Move to blue flag spawn
    """
    start_time = time.time()
    agent_name = getattr(game_connection, 'player_name', 'unknown')
    
    if not game_connection.player_id:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=not_connected")
        return "Error: You must join the game first using join_game()"
    
    if not (0 <= x <= 800):
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=invalid_x_coordinate")
        return "Error: x coordinate must be between 0 and 800"
    if not (0 <= y <= 600):
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=invalid_y_coordinate")
        return "Error: y coordinate must be between 0 and 600"
    
    try:
        # Get current position
        game_state = game_connection.get_game_state_sync()
        my_player = game_state.get("players", {}).get(game_connection.player_id)
        
        if not my_player:
            execution_time_ms = int((time.time() - start_time) * 1000)
            mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=player_not_found")
            
            action_result = f"Error: Player {game_connection.player_name} ({game_connection.player_id}) not found in game state"
            game_state_info = _format_game_state()
            return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
        
        current_x = my_player.get("x", 0)
        current_y = my_player.get("y", 0)
        distance = ((x - current_x) ** 2 + (y - current_y) ** 2) ** 0.5
        original_target_x, original_target_y = x, y
        
        # If target is too far, move towards it at maximum distance
        if distance > 200:
            # Calculate direction vector
            direction_x = (x - current_x) / distance
            direction_y = (y - current_y) / distance
            
            # Move 200 pixels in that direction
            x = current_x + (direction_x * 200)
            y = current_y + (direction_y * 200)
            
            # Ensure we stay in bounds
            x = max(0, min(800, x))
            y = max(0, min(600, y))
            
            # Update distance for the actual move
            distance = 200
        
        # Check if target is in wall (center wall: 350-450 x, 250-350 y)
        if (350 <= x <= 450) and (250 <= y <= 350):
            execution_time_ms = int((time.time() - start_time) * 1000)
            mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=blocked_by_wall")
            
            action_result = f"Error: Cannot move to ({x}, {y}) - position blocked by wall"
            game_state_info = _format_game_state()
            return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
        
        # Send move command
        await game_connection.send_action({
            "type": "move",
            "x": x,
            "y": y
        })
        
        # Wait for player to reach target or timeout
        timeout_seconds = max(10, distance / 80)  # Estimate time based on movement speed
        start_time = asyncio.get_event_loop().time()
        
        while True:
            await asyncio.sleep(0.1)  # Check every 100ms
            
            # Get updated position
            game_state = game_connection.get_game_state_sync()
            my_player = game_state.get("players", {}).get(game_connection.player_id)
            
            if not my_player:
                execution_time_ms = int((time.time() - start_time) * 1000)
                mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=player_lost")
                
                action_result = "Error: Player lost during movement"
                game_state_info = _format_game_state()
                return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
            
            # Check if player died
            if not my_player.get("isAlive", True):
                execution_time_ms = int((time.time() - start_time) * 1000)
                mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=player_eliminated")
                
                action_result = "Movement interrupted: Player was eliminated"
                game_state_info = _format_game_state()
                return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
            
            # Check if reached target (within 2 pixels)
            player_x = my_player.get("x", 0)
            player_y = my_player.get("y", 0)
            remaining_distance = ((x - player_x) ** 2 + (y - player_y) ** 2) ** 0.5
            
            if remaining_distance <= 2:
                # Check if this was the original target or an intermediate position
                original_distance = ((original_target_x - player_x) ** 2 + (original_target_y - player_y) ** 2) ** 0.5
                if original_distance <= 2:
                    execution_time_ms = int((time.time() - start_time) * 1000)
                    mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=true details=x={player_x:.1f},y={player_y:.1f}")
                    
                    action_result = f"✅ {game_connection.player_name} reached target position ({player_x:.1f}, {player_y:.1f})"
                    game_state_info = _format_game_state()
                    return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
                else:
                    execution_time_ms = int((time.time() - start_time) * 1000)
                    mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=true details=x={player_x:.1f},y={player_y:.1f},partial_move=true")
                    
                    action_result = f"🎯 {game_connection.player_name} moved towards target, now at ({player_x:.1f}, {player_y:.1f}). Target was {original_distance:.1f} pixels away, moved 200 pixels closer."
                    game_state_info = _format_game_state()
                    return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
            
            # Check if movement stopped (player is no longer moving)
            is_moving = my_player.get("isMoving", False)
            if not is_moving and remaining_distance > 5:
                # Movement stopped before reaching target - likely hit wall
                execution_time_ms = int((time.time() - start_time) * 1000)
                mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=blocked_at_x={player_x:.1f},y={player_y:.1f}")
                
                action_result = f"🚧 {game_connection.player_name} movement blocked at ({player_x:.1f}, {player_y:.1f}), {remaining_distance:.1f} pixels from target. Path blocked by wall or obstacle."
                game_state_info = _format_game_state()
                return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
            
            # Check for timeout
            if asyncio.get_event_loop().time() - start_time > timeout_seconds:
                execution_time_ms = int((time.time() - start_time) * 1000)
                mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details=timeout_at_x={player_x:.1f},y={player_y:.1f}")
                
                action_result = f"Movement timeout: Current position ({player_x:.1f}, {player_y:.1f}), {remaining_distance:.1f} pixels from target"
                game_state_info = _format_game_state()
                return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
                
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=move_to_position agent={agent_name} execution_time_ms={execution_time_ms} success=false details={str(e)}")
        return f"Error moving: {str(e)}"

@mcp.tool
@rate_limit
async def attack() -> str:
    """
    Attack nearby enemies.
    
    Server will automatically find and attack nearby enemy players within range.
    
    Args:
        None
    
    Returns:
        str: Success message confirming attack, or error description
    
    Attack mechanics:
    - Server finds nearby enemies within attack range
    - Eliminates enemy players within range
    - Cannot attack teammates or players with spawn protection
    - Dead players drop any flags they were carrying
    - Dead players respawn after 5 seconds at their base
    - Spawn protection lasts 3 seconds after respawn
    
    Strategy:
    - Attack when near enemies to eliminate them
    - Attack enemy flag carriers to make them drop the flag
    - Attack enemies near your flag to defend it
    - Time attacks when enemies don't have spawn protection
    
    Example:
        attack()  # Attack nearby enemies
    """
    start_time = time.time()
    agent_name = getattr(game_connection, 'player_name', 'unknown')
    
    if not game_connection.player_id:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=attack agent={agent_name} execution_time_ms={execution_time_ms} success=false details=not_connected")
        return "Error: You must join the game first using join_game()"
    
    try:
        if not game_connection.websocket:
            execution_time_ms = int((time.time() - start_time) * 1000)
            mcp_log("tool_executed", f"tool=attack agent={agent_name} execution_time_ms={execution_time_ms} success=false details=websocket_not_connected")
            return "Error: WebSocket not connected"
        
        await game_connection.send_action({
            "type": "attack"
        })
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=attack agent={agent_name} execution_time_ms={execution_time_ms} success=true")
        
        action_result = f"⚔️ {game_connection.player_name} attacking nearby enemies"
        game_state_info = _format_game_state()
        return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=attack agent={agent_name} execution_time_ms={execution_time_ms} success=false details={str(e)}")
        return f"Error attacking: {str(e)}"

@mcp.tool
@rate_limit
async def send_team_message(message: str) -> str:
    """
    Send a message to your teammates.
    
    Args:
        message (str): The message to send to your team (max 200 characters)
    
    Returns:
        str: Success message or error description
    
    Details:
    - Only your teammates can see the message
    - Messages are visible in the game state for coordination
    - Keep messages concise and strategic
    - Examples: "Going for blue flag", "Enemy at our base", "Need backup"
    
    Example:
        send_team_message("Enemy spotted near red flag!")
    """
    start_time = time.time()
    
    if not game_connection.player_id:
        execution_time_ms = int((time.time() - start_time) * 1000)
        agent_name = getattr(game_connection, 'player_name', 'unknown')
        mcp_log("tool_executed", f"tool=send_team_message agent={agent_name} execution_time_ms={execution_time_ms} success=false details=not_connected")
        return "Error: Not connected to game. Call join_game() first."
    
    if not message.strip():
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=send_team_message agent={game_connection.player_name} execution_time_ms={execution_time_ms} success=false details=empty_message")
        return "Error: Message cannot be empty"
    
    if len(message) > 200:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=send_team_message agent={game_connection.player_name} execution_time_ms={execution_time_ms} success=false details=message_too_long")
        return "Error: Message too long (max 200 characters)"
    
    try:
        chat_action = {
            "type": "chat",
            "message": message.strip()
        }
        await game_connection.send_action(chat_action)
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=send_team_message agent={game_connection.player_name} execution_time_ms={execution_time_ms} success=true details=message_sent")
        
        action_result = f"📢 Team message sent: \"{message.strip()}\""
        
        # Add current game state
        game_state_info = _format_game_state()
        return f"{action_result}\n\n📊 CURRENT GAME STATE:\n{game_state_info}"
        
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=send_team_message agent={game_connection.player_name} execution_time_ms={execution_time_ms} success=false details={str(e)}")
        return f"Error sending team message: {str(e)}"

@mcp.tool
@rate_limit
async def disconnect_from_game() -> str:
    """
    Disconnect from the capture the flag game.
    
    This allows another agent to join using this MCP server instance.
    
    Args:
        None
    
    Returns:
        str: Success message or error description
    """
    start_time = time.time()
    agent_name = getattr(game_connection, 'player_name', 'unknown')
    
    try:
        if game_connection.websocket:
            await game_connection.websocket.close()
        
        # Log agent disconnection
        mcp_log("agent_disconnected", f"agent={agent_name} reason=client_disconnect")
        
        # Clear connection data
        game_connection.websocket = None
        game_connection.player_id = None
        game_connection.player_name = None
        game_connection.player_team = None
        game_connection.game_state = {}
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=disconnect_from_game agent={agent_name} execution_time_ms={execution_time_ms} success=true")
        return "✅ Disconnected from game. Another agent can now join."
    except Exception as e:
        execution_time_ms = int((time.time() - start_time) * 1000)
        mcp_log("tool_executed", f"tool=disconnect_from_game agent={agent_name} execution_time_ms={execution_time_ms} success=false details={str(e)}")
        return f"Error disconnecting: {str(e)}"

def parse_args():
    parser = argparse.ArgumentParser(description="Capture the Flag MCP Server")
    parser.add_argument("--rate-limit-calls", type=int, default=10,
                        help="Maximum number of tool calls per time period (default: 10)")
    parser.add_argument("--rate-limit-period", type=float, default=1.0,
                        help="Rate limit time period in seconds (default: 1.0)")
    parser.add_argument("--disable-rate-limit", action="store_true",
                        help="Disable rate limiting completely")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    
    # Configure rate limiting based on command line arguments
    RateLimitConfig.calls = args.rate_limit_calls
    RateLimitConfig.period = args.rate_limit_period
    RateLimitConfig.enabled = not args.disable_rate_limit
    
    # Recreate rate limiter with new settings
    rate_limiter = RateLimiter(RateLimitConfig.calls, RateLimitConfig.period)
    
    print(f"🎮 Starting Capture the Flag MCP Server")
    if RateLimitConfig.enabled:
        print(f"⏳ Rate limiting: {RateLimitConfig.calls} calls per {RateLimitConfig.period} seconds")
    else:
        print("⚡ Rate limiting: DISABLED")
    
    mcp.run()