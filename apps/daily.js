export class DailyChallengeManager {
    constructor() {
        // The list of possible deterministic modifiers
        this.modifiers = [
            { id: 'snake_fast', game: 'snake', name: 'Lightning Snake', description: 'Snake moves 50% faster', apply: (game) => game.tickRate = 0.05 },
            { id: 'pong_strong_ai', game: 'pong', name: 'Pro AI', description: 'AI paddle is faster and ball starts faster', apply: (game) => { game.aiSpeedMult = 1.5; game.ballBaseSpeed = 40; } },
            { id: 'snake_small_grid', game: 'snake', name: 'Claustrophobia', description: 'Playfield is smaller', apply: (game) => { game.gridW = Math.floor(game.gridW * 0.7); game.gridH = Math.floor(game.gridH * 0.7); } },
            { id: 'pong_reverse', game: 'pong', name: 'Inverted Pong', description: 'Up is Down, Down is Up', apply: (game) => { game.controlsInverted = true; } },
            { id: 'snake_growth', game: 'snake', name: 'Growth Spurt', description: 'Apples grow your snake by 3 segments instead of 1', apply: (game) => { game.growthPerApple = 3; } },
            { id: 'pong_tiny_paddle', game: 'pong', name: 'Sniper Pong', description: 'Your paddle is 50% smaller', apply: (game) => { game.playerPaddleHeightMult = 0.5; } }
        ];

        // Is the user explicitly playing in daily challenge mode right now?
        this.isActive = false;

        // Is hard mode toggle enabled for the daily?
        this.isHardMode = false;
    }

    getDailySeed() {
        // Use the current date as a deterministic integer (e.g. 19500 days since epoch)
        return Math.floor(Date.now() / 86400000);
    }

    getDailyModifier() {
        const seed = this.getDailySeed();
        const index = seed % this.modifiers.length;
        return this.modifiers[index];
    }

    // Called by a game when it initializes to apply the daily rules
    applyToGame(gameInstance, gameId) {
        if (!this.isActive) return;

        const modifier = this.getDailyModifier();

        // Only apply if the modifier is meant for this specific game
        if (modifier.game !== gameId) return;

        console.log(`Applying Daily Modifier: ${modifier.name}`);
        modifier.apply(gameInstance);

        // If hard mode is enabled, stack a generic difficulty penalty universally
        if (this.isHardMode) {
            console.log("Hard mode active - applying secondary universal modifiers");
            if (gameId === 'snake') {
                gameInstance.tickRate = (gameInstance.tickRate || 0.1) * 0.8; // generally 20% faster
            } else if (gameId === 'pong') {
                gameInstance.aiSpeedMult = (gameInstance.aiSpeedMult || 1.0) * 1.25; // stronger AI baseline
            }
        }
    }
}

export const Daily = new DailyChallengeManager();
