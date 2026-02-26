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
    }

    handleInput(action) {
        if (action === 'up') this.playerY = Math.max(3, this.playerY - 3);
        if (action === 'down') this.playerY = Math.min(this.gridH - 3, this.playerY + 3);

        if (action === 'a' && this.gameOver) {
            this.reset();
        }
    }

    update(dt) {
        if (this.gameOver) return;

        // Move Ball
        this.ball.x += this.ball.dx * 30 * dt;
        this.ball.y += this.ball.dy * 30 * dt;

        // Bounce Top/Bottom
        if (this.ball.y < 0 || this.ball.y > this.gridH) this.ball.dy *= -1;

        // AI Logic
        if (this.aiY < this.ball.y - 2) this.aiY += 15 * dt;
        if (this.aiY > this.ball.y + 2) this.aiY -= 15 * dt;

        // Check Paddles
        // Player (Left)
        if (this.ball.x < 2 && this.ball.y >= this.playerY - 3 && this.ball.y <= this.playerY + 3) {
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
        }
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
        ctx.fillRect(1 * this.gridSize, (this.playerY - 3) * this.gridSize, this.gridSize / 2, this.gridSize * 6);
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
