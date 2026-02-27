import { Progress } from './progress.js';
import { Unlocks } from './unlocks.js';
import { Daily } from './daily.js';

export class SnakeApp {
    constructor(gridW, gridH, gridSize) {
        this.baseGridW = gridW; // Store originals for reset
        this.baseGridH = gridH;
        this.gridW = gridW;
        this.gridH = gridH;
        this.gridSize = gridSize;
        this.reset();
    }

    reset() {
        // Restore Grid in case a daily modifier shrunk it
        this.gridW = this.baseGridW;
        this.gridH = this.baseGridH;

        // Base defaults
        this.tickRate = 0.1;
        this.growthPerApple = 1;

        // Apply daily 
        Daily.applyToGame(this, 'snake');

        this.snake = [
            { x: Math.floor(this.gridW / 2), y: Math.floor(this.gridH / 2) },
            { x: Math.floor(this.gridW / 2) - 1, y: Math.floor(this.gridH / 2) },
            { x: Math.floor(this.gridW / 2) - 2, y: Math.floor(this.gridH / 2) }
        ];
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.score = 0;
        this.gameOver = false;
        this.timer = 0;
        this.spawnFood();
    }

    spawnFood() {
        this.food = {
            x: Math.floor(Math.random() * this.gridW),
            y: Math.floor(Math.random() * this.gridH)
        };
    }

    handleInput(action) {
        if (action === 'up' && this.dir.y === 0) this.nextDir = { x: 0, y: -1 };
        if (action === 'down' && this.dir.y === 0) this.nextDir = { x: 0, y: 1 };
        if (action === 'left' && this.dir.x === 0) this.nextDir = { x: -1, y: 0 };
        if (action === 'right' && this.dir.x === 0) this.nextDir = { x: 1, y: 0 };

        if (action === 'a' && this.gameOver) {
            this.reset();
        }
    }

    update(dt) {
        if (this.gameOver) return;

        this.timer += dt;
        if (this.timer > this.tickRate) {
            this.timer = 0;
            this.dir = { ...this.nextDir };

            const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

            // Wall collision
            if (head.x < 0 || head.x >= this.gridW || head.y < 0 || head.y >= this.gridH) {
                this.triggerGameOver();
            }

            // Self collision
            for (let i = 0; i < this.snake.length; i++) {
                if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                    this.triggerGameOver();
                }
            }

            if (!this.gameOver) {
                this.snake.unshift(head);
                if (head.x === this.food.x && head.y === this.food.y) {
                    this.score += 10;
                    this.spawnFood();
                    // Growth modifier logic
                    for (let i = 1; i < this.growthPerApple; i++) {
                        // Push a dummy segment that will naturally occupy the tail's previous spot next tick
                        this.snake.push({ ...this.snake[this.snake.length - 1] });
                    }
                } else {
                    this.snake.pop();
                }
            }
        }
    }

    triggerGameOver() {
        this.gameOver = true;

        let xpGained = this.score; // 10 xp per apple is generous but okay for pacing

        if (Daily.isActive) {
            xpGained *= 1.5;
            Daily.isActive = false; // Turn off daily modifiers until requested again
        }

        Progress.addXP(Math.floor(xpGained), "Played Snake");

        // Check Unlocks (Score 150+ grants the achievement)
        Unlocks.checkCondition('snake_score_15', { score: this.score });
    }

    draw(ctx, w, h) {
        // Background
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, w, h);

        // Draw Food
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(this.food.x * this.gridSize, this.food.y * this.gridSize, this.gridSize - 2, this.gridSize - 2);

        // Draw Snake
        ctx.fillStyle = '#10b981';
        for (let i = 0; i < this.snake.length; i++) {
            ctx.fillRect(this.snake[i].x * this.gridSize, this.snake[i].y * this.gridSize, this.gridSize - 2, this.gridSize - 2);
        }

        // UI overlay
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px "Outfit"';
        ctx.textAlign = 'left';
        ctx.fillText("SCORE: " + this.score, 30, 50);

        if (this.gameOver) {
            ctx.textAlign = 'center';
            ctx.font = 'bold 80px "Outfit"';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fillText("GAME OVER", w / 2, h / 2);
            ctx.font = '30px "Outfit"';
            ctx.fillStyle = 'white';
            ctx.fillText("Press 'A' to replay, or 'Home' to exit.", w / 2, h / 2 + 60);
        }
    }
}
