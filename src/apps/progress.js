export class ProgressManager {
    constructor() {
        this.maxLevel = 20;
        this.state = this.loadState();

        // Broadcasts when things change so UI can update
        this.onLevelUp = null;
        this.onXPAdded = null;
    }

    loadState() {
        const defaultState = {
            xp: 0,
            level: 1,
            unlockedFeatures: ['Neon (Default)', 'Classic Grey'], // Base themes
            dailyCompletionDates: []
        };

        try {
            const saved = localStorage.getItem('switchplus_progress');
            if (saved) {
                return { ...defaultState, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error("Could not load progress from localStorage", e);
        }
        return defaultState;
    }

    saveState() {
        try {
            localStorage.setItem('switchplus_progress', JSON.stringify(this.state));
        } catch (e) {
            console.error("Could not save progress to localStorage", e);
        }
    }

    // Example Curve: Lv1->2 requires 10 XP, Lv2->3 requires 15 XP, Lv3->4 requires 22 XP... 
    // It gets progressively harder.
    getXpRequirementForLevel(level) {
        if (level >= this.maxLevel) return Infinity; // MAX
        // Base formula: 10 * (1.5 ^ (level - 1)) rounded to nearest 5
        const raw = 10 * Math.pow(1.5, level - 1);
        return Math.round(raw / 5) * 5;
    }

    get xpProgress() {
        if (this.state.level >= this.maxLevel) return { current: 1, required: 1, percentage: 1 };
        const required = this.getXpRequirementForLevel(this.state.level);
        return {
            current: this.state.xp,
            required: required,
            percentage: Math.min(1, this.state.xp / required)
        };
    }

    addXP(amount, reason = "Played a game") {
        if (this.state.level >= this.maxLevel) return; // Cap reached

        this.state.xp += amount;
        if (this.onXPAdded) this.onXPAdded(amount, reason);

        let leveledUp = false;
        let requiredXP = this.getXpRequirementForLevel(this.state.level);

        // Handle multi-level ups if they got a ton of XP
        while (this.state.xp >= requiredXP && this.state.level < this.maxLevel) {
            this.state.xp -= requiredXP;
            this.state.level++;
            leveledUp = true;
            requiredXP = this.getXpRequirementForLevel(this.state.level);
        }

        // If they hit max level after the loop, zero out the overflow XP
        if (this.state.level >= this.maxLevel) {
            this.state.xp = 0;
        }

        if (leveledUp) {
            if (this.onLevelUp) this.onLevelUp(this.state.level);
            // Example: Every 5 levels unlocks a special cosmetic automatically
            this.checkLevelUnlocks();
        }

        this.saveState();
    }

    checkLevelUnlocks() {
        const levelUnlocks = {
            5: "Animal Crossing", // Theme
            10: "Pokemon (Pikachu/Eevee)", // Theme
        };

        for (let lvl = 2; lvl <= this.state.level; lvl++) {
            if (levelUnlocks[lvl] && !this.hasUnlocked(levelUnlocks[lvl])) {
                this.unlockFeature(levelUnlocks[lvl]);
            }
        }
    }

    hasUnlocked(featureId) {
        return this.state.unlockedFeatures.includes(featureId);
    }

    unlockFeature(featureId) {
        if (!this.hasUnlocked(featureId)) {
            this.state.unlockedFeatures.push(featureId);
            this.saveState();
            // We could fire an event here to show a toast message
            window.dispatchEvent(new CustomEvent('switchplus_unlocked', { detail: featureId }));
        }
    }

    markDailyCompleted() {
        const todayStr = new Date().toDateString();
        if (!this.state.dailyCompletionDates.includes(todayStr)) {
            this.state.dailyCompletionDates.push(todayStr);
            this.saveState();
        }
    }

    isDailyCompleted() {
        return this.state.dailyCompletionDates.includes(new Date().toDateString());
    }
}

// Export a singleton instance to be shared across modules
export const Progress = new ProgressManager();
