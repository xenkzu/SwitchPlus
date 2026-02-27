import { Progress } from './progress.js';
import { Unlocks } from './unlocks.js';
import { Daily } from './daily.js';

export class PongApp {
    constructor(gridW, gridH, gridSize) {
        this.gridW = gridW;
        this.gridH = gridH;
        this.gridSize = gridSize;
        this.reset();
    }

    reset() {
        this.ball = { x: this.gridW / 2, y: this.gridH / 2, dx: 0.5, dy: 0.5 };
        this.playerY = this.gridH / 2;
        this.aiY = this.gridH / 2;
        this.score = { player: 0, ai: 0 };
        this.gameOver = false;

        // Base defaults
        this.aiSpeedMult = 1.0;
        this.ballBaseSpeed = 30;
        this.controlsInverted = false;
        this.playerPaddleHeightMult = 1.0;

        // Apply any active daily challenges 
        Daily.applyToGame(this, 'pong');
    }

    handleInput(action) {
        let actUp = this.controlsInverted ? 'down' : 'up';
        let actDown = this.controlsInverted ? 'up' : 'down';

        if (action === actUp) this.playerY = Math.max(3, this.playerY - 3);
        if (action === actDown) this.playerY = Math.min(this.gridH - 3, this.playerY + 3);

        if (action === 'a' && this.gameOver) {
            this.reset();
        }
    }

    update(dt) {
        if (this.gameOver) return;

        // Move Ball
        this.ball.x += this.ball.dx * this.ballBaseSpeed * dt;
        this.ball.y += this.ball.dy * this.ballBaseSpeed * dt;

        // Bounce Top/Bottom
        if (this.ball.y < 0 || this.ball.y > this.gridH) this.ball.dy *= -1;

        // AI Logic
        if (this.aiY < this.ball.y - 2) this.aiY += 15 * this.aiSpeedMult * dt;
        if (this.aiY > this.ball.y + 2) this.aiY -= 15 * this.aiSpeedMult * dt;

        // Check Paddles
        // Player (Left)
        const pHalfHeight = 3 * this.playerPaddleHeightMult;
        if (this.ball.x < 2 && this.ball.y >= this.playerY - pHalfHeight && this.ball.y <= this.playerY + pHalfHeight) {
            this.ball.dx *= -1;
            this.ball.x = 2; // don't get stuck
        }
        // AI (Right)
        if (this.ball.x > this.gridW - 2 && this.ball.y >= this.aiY - 3 && this.ball.y <= this.aiY + 3) {
            this.ball.dx *= -1;
            this.ball.x = this.gridW - 2;
        }

        // Scoring
        if (this.ball.x < 0) {
            this.score.ai++;
            this.ball = { x: this.gridW / 2, y: this.gridH / 2, dx: 0.5, dy: 0.5 };
        }
        if (this.ball.x > this.gridW) {
            this.score.player++;
            this.ball = { x: this.gridW / 2, y: this.gridH / 2, dx: -0.5, dy: 0.5 };
        }

        if (this.score.player >= 5 || this.score.ai >= 5) {
            this.gameOver = true;
            this.handleGameOver();
        }
    }

    handleGameOver() {
        // Calculate XP
        let xpGained = 5; // participation
        if (this.score.player > this.score.ai) {
            xpGained += 20; // Win bonus
            const margin = this.score.player - this.score.ai;
            xpGained += margin * 5; // Clean win bonus
        }

        if (Daily.isActive) {
            xpGained *= 1.5; // Daily bonus multiplier
            Daily.isActive = false; // Turn off until requested again
        }

        Progress.addXP(Math.floor(xpGained), "Finished a game of Pong");

        // Check Unlocks
        Unlocks.checkCondition('pong_flawless', {
            playerScore: this.score.player,
            aiScore: this.score.ai
        });
    }

    draw(ctx, w, h) {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#fff';
        // Center line
        for (let i = 0; i < h; i += 40) ctx.fillRect(w / 2 - 2, i, 4, 20);

        // Score
        ctx.font = 'bold 80px "Outfit"';
        ctx.fillText(this.score.player, w / 4, 100);
        ctx.fillText(this.score.ai, (w / 4) * 3, 100);

        // Player Paddle
        const pHalfHeight = 3 * this.playerPaddleHeightMult;
        ctx.fillRect(1 * this.gridSize, (this.playerY - pHalfHeight) * this.gridSize, this.gridSize / 2, pHalfHeight * 2 * this.gridSize);
        // AI Paddle
        ctx.fillRect((this.gridW - 1) * this.gridSize - this.gridSize / 2, (this.aiY - 3) * this.gridSize, this.gridSize / 2, this.gridSize * 6);

        // Ball
        ctx.beginPath();
        ctx.arc(this.ball.x * this.gridSize, this.ball.y * this.gridSize, 10, 0, Math.PI * 2);
        ctx.fill();

        if (this.gameOver) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 80px "Outfit"';
            ctx.fillText(this.score.player >= 5 ? "YOU WIN" : "AI WINS", w / 2, h / 2);
            ctx.font = '30px "Outfit"';
            ctx.fillText("Press 'A' to replay, or 'Home' to exit.", w / 2, h / 2 + 60);
        }
    }
}
