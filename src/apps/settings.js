import { Progress } from './progress.js';

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
        // Callback to send theme updates back to mainland 3D renderer
        this.onThemeChange = null;
    }

    handleInput(action) {
        if (action === 'up') this.selectedThemeIndex = Math.max(0, this.selectedThemeIndex - 1);
        if (action === 'down') this.selectedThemeIndex = Math.min(this.themes.length - 1, this.selectedThemeIndex + 1);

        if (action === 'a') {
            const theme = this.themes[this.selectedThemeIndex];
            if (Progress.hasUnlocked(theme.name) && this.onThemeChange) {
                // Apply physical 3D materials immediately!
                localStorage.setItem('switchplus_active_theme', theme.name);
                this.onThemeChange(theme);
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

        ctx.fillStyle = '#fff';
        ctx.font = '500 20px "Inter"';
        ctx.textAlign = 'center';
        ctx.fillText("Use Up/Down to select, 'A' to apply theme instantly", w / 2, h - 50);
    }
}
