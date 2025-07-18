class EventLogger {
    constructor() {
        this.gameId = this.generateGameId();
    }
    
    generateGameId() {
        return 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
    
    log(eventType, data) {
        const event = {
            timestamp: new Date().toISOString(),
            gameId: this.gameId,
            eventType: eventType,
            data: data
        };
        
        // Log to browser console for debugging
        console.log('[GAME_EVENT]', JSON.stringify(event));
        
        // Send to parent window if in iframe
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'GAME_EVENT',
                event: event
            }, '*');
        }
    }
    
    // Combat events
    logAttack(attacker, target, damage, targetHealthAfter) {
        this.log('COMBAT_HIT', {
            attacker: this.getPlayerData(attacker),
            target: this.getPlayerData(target),
            damage: damage,
            targetHealthAfter: targetHealthAfter
        });
    }
    
    logPlayerDeath(player, wasCarryingFlag) {
        this.log('PLAYER_DEATH', {
            player: this.getPlayerData(player),
            wasCarryingFlag: wasCarryingFlag
        });
    }
    
    // Flag events
    logFlagPickup(flag, player) {
        this.log('FLAG_PICKUP', {
            flag: this.getFlagData(flag),
            player: this.getPlayerData(player)
        });
    }
    
    logFlagDrop(flag, reason = 'UNKNOWN') {
        this.log('FLAG_DROP', {
            flag: this.getFlagData(flag),
            reason: reason
        });
    }
    
    logFlagCapture(flag, capturingPlayer, newScore) {
        this.log('FLAG_CAPTURE', {
            flag: this.getFlagData(flag),
            capturingPlayer: this.getPlayerData(capturingPlayer),
            newScore: newScore
        });
    }
    
    logFlagReturn(flag, reason = 'AUTO_RETURN') {
        this.log('FLAG_RETURN', {
            flag: this.getFlagData(flag),
            reason: reason
        });
    }
    
    // AI events
    logAIStateChange(player, fromState, toState, reason = 'UNKNOWN') {
        this.log('AI_STATE_CHANGE', {
            player: this.getPlayerData(player),
            fromState: fromState,
            toState: toState,
            reason: reason
        });
    }
    
    // Movement events
    logCollision(player, collisionType, obstacleInfo = null) {
        this.log('COLLISION', {
            player: this.getPlayerData(player),
            collisionType: collisionType,
            obstacleInfo: obstacleInfo
        });
    }
    
    logPlayerRespawn(player) {
        this.log('PLAYER_RESPAWN', {
            player: this.getPlayerData(player)
        });
    }
    
    // Game events
    logGameStart() {
        this.log('GAME_START', {
            timestamp: new Date().toISOString()
        });
    }
    
    logGameEnd(winner, finalScore, reason) {
        this.log('GAME_END', {
            winner: winner,
            finalScore: finalScore,
            reason: reason
        });
    }
    
    // Helper methods
    getPlayerData(player) {
        return {
            id: player.isPlayer ? 'human_player' : `ai_${player.team}_${player.x}_${player.y}`,
            team: player.team,
            isPlayer: player.isPlayer,
            position: { x: Math.round(player.x), y: Math.round(player.y) },
            health: player.health,
            carryingFlag: !!player.carryingFlag
        };
    }
    
    getFlagData(flag) {
        return {
            team: flag.team,
            position: { x: Math.round(flag.x), y: Math.round(flag.y) },
            isCarried: flag.isCarried,
            isDropped: flag.isDropped
        };
    }
}