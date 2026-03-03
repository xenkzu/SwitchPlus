import { Progress } from './progress.js';
import { Achievements } from './achievements.js';

export class SettingsApp {
    constructor() {
        this.themes = [
            { name: "Neon (Default)", left: '#00c3e3', right: '#ff4554' },
            { name: "Classic Grey", left: '#888888', right: '#888888' },
            { name: "Animal Crossing", left: '#7eedba', right: '#06b0d9' },
            { name: "Pokemon (Pikachu/Eevee)", left: '#eac83c', right: '#d6a058' },
            { name: "Retro Hacker", left: '#10b981', right: '#10b981' }, // Snake reward
            { name: "Neon Sunset", left: '#f43f5e', right: '#f59e0b' } // Pong reward
        ];
        this.selectedThemeIndex = 0;

        // Hard Mode State
        this.isHardModeEnabled = false;

        // Navigation 
        // 0 = Themes, 1 = Hard Mode Toggle
        this.selectedRow = 0;

        // Callbacks
        this.onThemeChange = null;
        this.onHardModeToggle = null;
    }

    handleInput(action) {
        const hasHardMode = Achievements.hasUnlocked('completionist');

        if (action === 'up') {
            if (this.selectedRow === 1) {
                this.selectedRow = 0;
            } else if (this.selectedRow === 0 && this.selectedThemeIndex > 0) {
                this.selectedThemeIndex--;
            }
        }

        if (action === 'down') {
            if (this.selectedRow === 0) {
                if (this.selectedThemeIndex < this.themes.length - 1) {
                    this.selectedThemeIndex++;
                } else if (hasHardMode) {
                    this.selectedRow = 1; // Move down to Hard Mode toggle
                }
            }
        }

        if (action === 'a') {
            if (this.selectedRow === 0) {
                const theme = this.themes[this.selectedThemeIndex];
                if (Progress.hasUnlocked(theme.name) && this.onThemeChange) {
                    // Apply physical 3D materials immediately!
                    localStorage.setItem('switchplus_active_theme', theme.name);
                    this.onThemeChange(theme);
                }
            } else if (this.selectedRow === 1 && hasHardMode) {
                this.isHardModeEnabled = !this.isHardModeEnabled;
                if (this.onHardModeToggle) {
                    this.onHardModeToggle(this.isHardModeEnabled);
                }
            }
        }
    }

    update(dt) {
        // Settings UI is static until input, no continuous updates needed
    }

    draw(ctx, w, h) {
        ctx.fillStyle = '#2a2a2a'; // Switch system grey
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = '700 50px "Inter"';
        ctx.textAlign = 'left';
        ctx.fillText("System Settings", 50, 80);
        ctx.fillRect(50, 110, w - 100, 2);

        ctx.font = '600 30px "Inter"';
        ctx.fillText("Joy-Con Colors", 50, 170);

        for (let i = 0; i < this.themes.length; i++) {
            const isSel = (i === this.selectedThemeIndex);
            const isUnlocked = Progress.hasUnlocked(this.themes[i].name);
            const y = 250 + (i * 80);

            if (isSel) {
                ctx.fillStyle = '#0ab9e6';
                ctx.fillRect(80, y - 40, w - 160, 60);
                ctx.fillStyle = '#fff';
            } else {
                ctx.fillStyle = isUnlocked ? '#a1a1aa' : '#52525b'; // Darker if locked
            }

            ctx.font = isSel ? '700 30px "Inter"' : '500 30px "Inter"';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';

            let text = this.themes[i].name;
            if (!isUnlocked) text += " 🔒 (Locked)";

            ctx.fillText(text, 100, y);

            if (isUnlocked) {
                // Draw color swatches only if unlocked
                ctx.fillStyle = this.themes[i].left;
                ctx.beginPath();
                ctx.arc(w - 200, y - 10, 20, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = this.themes[i].right;
                ctx.beginPath();
                ctx.arc(w - 140, y - 10, 20, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Hard Mode Toggle (Only if Completionist is unlocked) ---
        if (Achievements.hasUnlocked('completionist')) {
            const hmY = 250 + (this.themes.length * 80) + 40;
            const isSelHM = (this.selectedRow === 1);

            ctx.fillStyle = '#ef4444'; // Red thematic color
            ctx.font = '600 30px "Inter"';
            ctx.fillText("Game Modifiers", 50, hmY - 30);

            if (isSelHM) {
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(80, hmY - 10, w - 160, 60);
                ctx.fillStyle = '#fff';
            } else {
                ctx.fillStyle = '#a1a1aa';
            }

            ctx.font = isSelHM ? '700 30px "Inter"' : '500 30px "Inter"';
            ctx.fillText("Hard Mode", 100, hmY + 30);

            // Toggle switch visual
            ctx.fillStyle = this.isHardModeEnabled ? '#10b981' : '#52525b';
            ctx.beginPath();
            ctx.roundRect(w - 220, hmY + 5, 80, 40, 20);
            ctx.fill();

            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.isHardModeEnabled ? w - 160 : w - 200, hmY + 25, 15, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = '#fff';
        ctx.font = '500 20px "Inter"';
        ctx.textAlign = 'center';
        ctx.fillText("Use Up/Down to select, 'A' to apply theme instantly", w / 2, h - 50);
    }
}
