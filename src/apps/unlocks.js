import { Progress } from './progress.js';

class UnlockManager {
    constructor() {
        // Define all permanent skill-based achievements and what they unlock
        this.achievements = {
            'snake_score_15': {
                description: "Score 150+ in Snake (Eat 15 apples)",
                unlocksTheme: "Retro Hacker" // Example reward theme
            },
            'pong_flawless': {
                description: "Win a game of Pong 5-0 without the AI scoring",
                unlocksTheme: "Neon Sunset"
            }
        };

        // We use the progress manager to persist which of these have been earned.
        // We'll store the literal keys (e.g., 'snake_score_15') in progress.state.unlockedFeatures
    }

    checkCondition(conditionId, runStats) {
        // If already unlocked, do nothing
        if (Progress.hasUnlocked(conditionId)) return;

        let conditionMet = false;

        switch (conditionId) {
            case 'snake_score_15':
                // In our snake game, score goes up by 10 per apple. 15 apples = 150 score.
                if (runStats.score >= 150) {
                    conditionMet = true;
                }
                break;
            case 'pong_flawless':
                if (runStats.playerScore >= 5 && runStats.aiScore === 0) {
                    conditionMet = true;
                }
                break;
        }

        if (conditionMet) {
            this.grantUnlock(conditionId);
        }
    }

    grantUnlock(conditionId) {
        const achievementInfo = this.achievements[conditionId];
        if (achievementInfo) {
            // Unlock the achievement marker itself so we don't grant it again
            Progress.unlockFeature(conditionId);

            // Unlock the aesthetic reward
            if (achievementInfo.unlocksTheme) {
                Progress.unlockFeature(achievementInfo.unlocksTheme);
            }

            console.log(`Unlocked Achievement: ${conditionId}! Reward: ${achievementInfo.unlocksTheme}`);
        }
    }
}

export const Unlocks = new UnlockManager();
