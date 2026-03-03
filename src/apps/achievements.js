export const ACHIEVEMENTS = {
    completionist: {
        id: "completionist",
        title: "Completionist",
        subtitle: "Master the basics.",
        icon: "🏆",
        checkUnlock: (stats) => stats.snake.normal.highScore >= 10 && stats.pong.normal.wins >= 5
    },
    mastery: {
        id: "mastery",
        title: "How Did We Get Here?",
        subtitle: "You survived the impossible.",
        icon: "🔥",
        checkUnlock: (stats) => stats.snake.hard.highScore >= 100 && stats.pong.hard.wins >= 10
    }
};

class AchievementManager {
    constructor() {
        this.state = this.loadState();
    }

    loadState() {
        const defaultState = {
            stats: {
                snake: { normal: { highScore: 0 }, hard: { highScore: 0 } },
                pong: { normal: { wins: 0 }, hard: { wins: 0 } }
            },
            unlocked: {
                completionist: false,
                mastery: false
            }
        };

        try {
            const saved = localStorage.getItem('switchplus_achievements');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Deep merge to ensure all nested keys exist if we add new games later
                return this.deepMerge(defaultState, parsed);
            }
        } catch (e) {
            console.error("Could not load achievements from localStorage", e);
        }
        return defaultState;
    }

    saveState() {
        try {
            localStorage.setItem('switchplus_achievements', JSON.stringify(this.state));
        } catch (e) {
            console.error("Could not save achievements to localStorage", e);
        }
    }

    // Helper to deeply merge loaded state over default state structure
    deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target) {
                Object.assign(source[key], this.deepMerge(target[key], source[key]));
            }
        }
        Object.assign(target || {}, source);
        return target;
    }

    // --- Stat Recording APIs ---

    recordSnakeScore(score, isHardMode) {
        const mode = isHardMode ? 'hard' : 'normal';
        const currentHigh = this.state.stats.snake[mode].highScore;

        if (score > currentHigh) {
            this.state.stats.snake[mode].highScore = score;
            this.saveState();
            this.evaluateUnlocks();
        }
    }

    recordPongWin(isHardMode) {
        const mode = isHardMode ? 'hard' : 'normal';
        this.state.stats.pong[mode].wins += 1;
        this.saveState();
        this.evaluateUnlocks();
    }

    // --- Unlock Evaluation Logic ---

    evaluateUnlocks() {
        let changed = false;

        for (const [key, achievement] of Object.entries(ACHIEVEMENTS)) {
            // If not already unlocked, check if conditions are met
            if (!this.state.unlocked[key]) {
                if (achievement.checkUnlock(this.state.stats)) {
                    this.state.unlocked[key] = true;
                    changed = true;
                    this.triggerNotification(achievement);
                }
            }
        }

        if (changed) {
            this.saveState();
        }
    }

    triggerNotification(achievement) {
        // Dispatch CustomEvent to UI layer in main.js
        window.dispatchEvent(new CustomEvent('switchplus_achievement_unlocked', {
            detail: achievement
        }));
    }

    hasUnlocked(achievementId) {
        return !!this.state.unlocked[achievementId];
    }

    getStats() {
        return this.state.stats;
    }
}

export const Achievements = new AchievementManager();
