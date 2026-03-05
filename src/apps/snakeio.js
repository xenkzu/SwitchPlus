import { Progress } from './progress.js';
import { Unlocks } from './unlocks.js';
import { Daily } from './daily.js';
import { Achievements } from './achievements.js';

// Virtual world settings (1 unit = gridSize pixels on screen)
const WORLD_W = 120;
const WORLD_H = 80;
const SEG_SPACING = 0.8;
const BODY_RADIUS = 0.6;
const HEAD_RADIUS = 0.75;
const BASE_SPEED = 12.0;    // units per second
const TURN_SPEED = Math.PI * 1.8; // radians per second
const CELL_SIZE = 5; // Spatial hash cell size (in units)

function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

export class SnakeIoApp {
    constructor(viewW, viewH, gridSize) {
        this.viewW = viewW; // Units visible horizontally (e.g. 32)
        this.viewH = viewH; // Units visible vertically (e.g. 18)
        this.gridSize = gridSize; // Pixels per unit (e.g. 40)

        this.numBots = 15;
        this.foodCount = 100;
        this.spatialHash = new Map();

        this.reset();
    }

    reset() {
        this.isHardMode = false;
        Daily.applyToGame(this, 'snakeio');

        this.speedMult = this.isHardMode ? 1.5 : 1.0;
        this.camera = { x: WORLD_W / 2, y: WORLD_H / 2 };

        const startX = WORLD_W / 2;
        const startY = WORLD_H / 2;

        this.player = this.createSnake('player', '#10b981', startX, startY, 0, 10);

        this.bots = [];
        this.botColors = ['#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#84cc16'];
        for (let i = 0; i < this.numBots; i++) {
            this.spawnBot();
        }

        this.foods = [];
        for (let i = 0; i < this.foodCount; i++) {
            this.spawnFood();
        }

        this.gameOver = false;
        this._cachedRank = 1;
        this._rankTimer = 0;
    }

    createSnake(id, color, x, y, angle, startLength) {
        // Path tracks history: [{x, y, d}, ...] where d is distance along the path from the start
        const path = [];
        const initialDist = startLength * SEG_SPACING;

        // Push several points backwards to form a straight line so we don't instantly self-collide
        const numPoints = 10;
        for (let i = 0; i <= numPoints; i++) {
            const fraction = i / numPoints;
            const backwardsDist = initialDist * (1 - fraction);
            path.push({
                x: x - Math.cos(angle) * backwardsDist,
                y: y - Math.sin(angle) * backwardsDist,
                d: initialDist * fraction
            });
        }

        return {
            id, color,
            x, y, angle, targetAngle: angle,
            speed: BASE_SPEED * this.speedMult,
            length: startLength, // Number of segments
            path: path,
            pathDist: initialDist, // Total distance head has traveled
            score: 0,
            isDead: false,
            brainTimer: 0
        };
    }

    spawnBot() {
        const x = Math.random() * (WORLD_W - 10) + 5;
        const y = Math.random() * (WORLD_H - 10) + 5;
        const angle = Math.random() * Math.PI * 2;
        const color = this.botColors[Math.floor(Math.random() * this.botColors.length)];
        const bot = this.createSnake('bot_' + Math.random().toString(36).substring(2), color, x, y, angle, 6);
        this.bots.push(bot);
    }

    spawnFood(x, y, value = 10, isDrop = false) {
        if (x === undefined) x = Math.random() * (WORLD_W - 2) + 1;
        if (y === undefined) y = Math.random() * (WORLD_H - 2) + 1;

        const colors = isDrop ? ['#a855f7', '#ec4899', '#facc15', '#3b82f6'] : ['#ef4444', '#f97316', '#84cc16'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        // Add random slight drift to foods for visual "float"
        const phase = Math.random() * Math.PI * 2;

        this.foods.push({
            x, y, value, color, isDrop,
            radius: isDrop ? 0.6 : 0.3,
            phase,
            ox: x, oy: y // origin
        });
    }

    handleInput(action, isDown) {
        if (!isDown) return;

        if (action === 'up') this.player.targetAngle = -Math.PI / 2;
        else if (action === 'down') this.player.targetAngle = Math.PI / 2;
        else if (action === 'left') this.player.targetAngle = Math.PI;
        else if (action === 'right') this.player.targetAngle = 0;

        if (action === 'a' && this.gameOver) {
            this.reset();
        }
    }

    _hash(x, y) {
        return (Math.floor(x / CELL_SIZE)) + ',' + (Math.floor(y / CELL_SIZE));
    }

    rebuildSpatialHash() {
        this.spatialHash.clear();

        const addSegments = (snake) => {
            if (snake.isDead) return;
            // Get positions for all segments
            for (let i = 0; i < snake.length; i++) {
                const pos = this.getSegmentPos(snake, i);
                if (!pos) continue;
                const h = this._hash(pos.x, pos.y);
                if (!this.spatialHash.has(h)) this.spatialHash.set(h, []);
                this.spatialHash.get(h).push({ snakeId: snake.id, x: pos.x, y: pos.y, index: i });
            }
        };

        addSegments(this.player);
        for (let i = 0; i < this.bots.length; i++) {
            addSegments(this.bots[i]);
        }
    }

    getSegmentPos(snake, index) {
        if (index === 0) return { x: snake.x, y: snake.y, angle: snake.angle };
        const targetD = snake.pathDist - (index * SEG_SPACING);
        if (targetD <= 0) {
            // Reached end of history
            const last = snake.path[0];
            return { x: last.x, y: last.y, angle: snake.angle };
        }

        // Find segment in history
        for (let i = snake.path.length - 1; i >= 1; i--) {
            const curr = snake.path[i];
            const prev = snake.path[i - 1];
            if (curr.d >= targetD && prev.d <= targetD) {
                const t = (targetD - prev.d) / (curr.d - prev.d);
                const x = prev.x + (curr.x - prev.x) * t;
                const y = prev.y + (curr.y - prev.y) * t;
                const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
                return { x, y, angle };
            }
        }
        return { x: snake.path[0].x, y: snake.path[0].y, angle: snake.angle };
    }

    updateBotAI(bot, dt) {
        bot.brainTimer -= dt;
        if (bot.brainTimer > 0) return;
        bot.brainTimer = Math.random() * 0.3 + 0.1; // Think often

        let nearestFood = null;
        let minDist = 15;

        for (let i = 0; i < this.foods.length; i++) {
            const f = this.foods[i];
            const dx = f.x - bot.x;
            const dy = f.y - bot.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < minDist * minDist) {
                minDist = Math.sqrt(d2);
                nearestFood = f;
            }
        }

        if (nearestFood) {
            bot.targetAngle = Math.atan2(nearestFood.y - bot.y, nearestFood.x - bot.x);
        } else {
            bot.targetAngle += (Math.random() - 0.5) * Math.PI;
        }

        // Avoid walls
        const margin = 3;
        if (bot.x < margin) bot.targetAngle = 0;
        else if (bot.x > WORLD_W - margin) bot.targetAngle = Math.PI;
        else if (bot.y < margin) bot.targetAngle = Math.PI / 2;
        else if (bot.y > WORLD_H - margin) bot.targetAngle = -Math.PI / 2;
    }

    killSnake(snake) {
        snake.isDead = true;
        // Drop food along body
        for (let i = 0; i < snake.length; i += 2) {
            const pos = this.getSegmentPos(snake, i);
            if (pos) {
                // Large blobs for death drops
                this.spawnFood(pos.x + (Math.random() - 0.5), pos.y + (Math.random() - 0.5), 15, true);
            }
        }
        snake.path = [];
    }

    updateEntity(snake, dt) {
        // 1. Smooth rotation
        let diff = normalizeAngle(snake.targetAngle - snake.angle);
        const maxTurn = TURN_SPEED * dt;
        if (Math.abs(diff) <= maxTurn) {
            snake.angle = snake.targetAngle;
        } else {
            snake.angle += Math.sign(diff) * maxTurn;
        }
        snake.angle = normalizeAngle(snake.angle);

        // 2. Move Forward
        const moveDist = snake.speed * dt;
        snake.x += Math.cos(snake.angle) * moveDist;
        snake.y += Math.sin(snake.angle) * moveDist;
        snake.pathDist += moveDist;

        // Wall collisions
        const margin = HEAD_RADIUS;
        if (snake.x < margin || snake.x > WORLD_W - margin ||
            snake.y < margin || snake.y > WORLD_H - margin) {
            this.killSnake(snake);
            return;
        }

        // Add to history path
        snake.path.push({ x: snake.x, y: snake.y, d: snake.pathDist });

        // Prune deep history (keep just enough for the tail)
        const requiredDist = snake.length * SEG_SPACING + 1;
        while (snake.path.length > 2 && snake.path[0].d < snake.pathDist - requiredDist) {
            snake.path.shift();
        }

        // 3. Circle-circle collisions with other snakes via spatial hash
        const headH = this._hash(snake.x, snake.y);
        const searchCells = [
            headH,
            this._hash(snake.x - CELL_SIZE, snake.y),
            this._hash(snake.x + CELL_SIZE, snake.y),
            this._hash(snake.x, snake.y - CELL_SIZE),
            this._hash(snake.x, snake.y + CELL_SIZE),
            this._hash(snake.x - CELL_SIZE, snake.y - CELL_SIZE),
            this._hash(snake.x + CELL_SIZE, snake.y + CELL_SIZE)
        ];

        let crashed = false;
        for (let c of searchCells) {
            if (!this.spatialHash.has(c)) continue;
            const locals = this.spatialHash.get(c);

            for (let i = 0; i < locals.length; i++) {
                const target = locals[i];
                // Ignore self-collision for the first 5 segments (neck) to prevent instant suicide on tight turns
                if (target.snakeId === snake.id && target.index < 6) continue;

                const dx = target.x - snake.x;
                const dy = target.y - snake.y;
                const dist2 = dx * dx + dy * dy;
                // Collision if distance < HEAD_RADIUS + BODY_RADIUS
                const radii = HEAD_RADIUS + BODY_RADIUS - 0.2; // slight grace overlap leeway
                if (dist2 < radii * radii) {
                    crashed = true;
                    break;
                }
            }
            if (crashed) break;
        }

        if (crashed) {
            this.killSnake(snake);
            return;
        }

        // 4. Food Collection
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const f = this.foods[i];
            const dx = f.x - snake.x;
            const dy = f.y - snake.y;
            const dist2 = dx * dx + dy * dy;
            const grabRadius = HEAD_RADIUS + f.radius + 0.5; // slight suction range

            if (dist2 < grabRadius * grabRadius) {
                snake.score += f.value;
                // Add length progressively
                const threshold = 30 + (snake.length * 5); // Gets harder to grow as you get longer
                if (snake.score > threshold) {
                    snake.length++;
                    snake.score -= threshold;
                }

                this.foods.splice(i, 1);
                this.spawnFood();
            }
        }
    }

    update(dt) {
        if (this.gameOver) return;

        // 0. Update global visual floats
        const sysTime = Date.now() / 1000;
        for (let i = 0; i < this.foods.length; i++) {
            const f = this.foods[i];
            f.x = f.ox + Math.sin(sysTime * 2 + f.phase) * 0.2;
            f.y = f.oy + Math.cos(sysTime * 2 + f.phase) * 0.2;
        }

        // 1. Rebuild Spatial Hash for the frame
        this.rebuildSpatialHash();

        // 2. Player logic
        if (!this.player.isDead) {
            this.updateEntity(this.player, dt);
        } else if (!this.gameOver) {
            this.triggerGameOver();
        }

        // 3. Bot logic
        let livingBots = 0;
        for (let i = 0; i < this.bots.length; i++) {
            const bot = this.bots[i];
            if (!bot.isDead) {
                this.updateBotAI(bot, dt);
                this.updateEntity(bot, dt);
                livingBots++;
            }
        }

        // Respawn bots
        if (livingBots < this.numBots && Math.random() < 0.05) {
            this.spawnBot();
        }

        // 4. Camera tracking logic (smooth lerp)
        if (!this.player.isDead) {
            const px = this.player.x;
            const py = this.player.y;
            // Target camera position pushes slightly ahead of the snake based on angle
            const lookAhead = 4;
            let targetCamX = px + Math.cos(this.player.angle) * lookAhead - (this.viewW / 2);
            let targetCamY = py + Math.sin(this.player.angle) * lookAhead - (this.viewH / 2);

            targetCamX = Math.max(0, Math.min(targetCamX, WORLD_W - this.viewW));
            targetCamY = Math.max(0, Math.min(targetCamY, WORLD_H - this.viewH));

            // Lerp tracking
            this.camera.x += (targetCamX - this.camera.x) * 5 * dt;
            this.camera.y += (targetCamY - this.camera.y) * 5 * dt;
        }

        this._rankTimer += dt;
        if (this._rankTimer > 0.5) {
            this._rankTimer = 0;
            this._cachedRank = this.computeRank();
        }
    }

    triggerGameOver() {
        this.gameOver = true;
        let xpGained = this.player.length * 10;
        if (Daily.isActive) {
            xpGained *= 1.5;
            Daily.isActive = false;
        }
        if (this.isHardMode) xpGained *= 2.0;

        Progress.addXP(Math.floor(xpGained), "Played Snake.io");
        Achievements.recordSnakeScore(this.player.length, this.isHardMode);
    }

    drawEntity(ctx, snake, camX, camY) {
        if (snake.isDead) return;
        const gs = this.gridSize;

        // Draw body from tail to head (so head is on top)
        for (let i = snake.length - 1; i >= 0; i--) {
            const pos = this.getSegmentPos(snake, i);
            if (!pos) continue;

            const px = (pos.x - camX) * gs;
            const py = (pos.y - camY) * gs;

            // Culling offscreen (radius check)
            if (px < -gs || py < -gs || px > this.viewW * gs + gs || py > this.viewH * gs + gs) continue;

            ctx.beginPath();

            if (i === 0) {
                // Draw Head
                ctx.fillStyle = snake.color;
                ctx.arc(px, py, HEAD_RADIUS * gs, 0, Math.PI * 2);
                ctx.fill();

                // Draw outline for head
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#00000033';
                ctx.stroke();

                // Draw Eyes based on angle
                const eyeSpread = Math.PI / 4;
                const eyeDist = HEAD_RADIUS * gs * 0.5;
                const eyeRadius = HEAD_RADIUS * gs * 0.3;

                ctx.fillStyle = 'white';

                // Left eye
                const ex1 = px + Math.cos(pos.angle - eyeSpread) * eyeDist;
                const ey1 = py + Math.sin(pos.angle - eyeSpread) * eyeDist;
                ctx.beginPath(); ctx.arc(ex1, ey1, eyeRadius, 0, Math.PI * 2); ctx.fill();

                // Right eye
                const ex2 = px + Math.cos(pos.angle + eyeSpread) * eyeDist;
                const ey2 = py + Math.sin(pos.angle + eyeSpread) * eyeDist;
                ctx.beginPath(); ctx.arc(ex2, ey2, eyeRadius, 0, Math.PI * 2); ctx.fill();

                // Pupils (looking forward)
                ctx.fillStyle = 'black';
                const pDist = eyeRadius * 0.4;
                ctx.beginPath(); ctx.arc(ex1 + Math.cos(pos.angle) * pDist, ey1 + Math.sin(pos.angle) * pDist, eyeRadius * 0.4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(ex2 + Math.cos(pos.angle) * pDist, ey2 + Math.sin(pos.angle) * pDist, eyeRadius * 0.4, 0, Math.PI * 2); ctx.fill();

            } else {
                // Draw Body Segment
                const taper = Math.max(0.4, 1.0 - (i / snake.length) * 0.4); // Tail gets slightly smaller
                const r = BODY_RADIUS * gs * taper;

                // Body glow/fill
                ctx.fillStyle = snake.color;
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fill();

                // Outline overlapping borders for Slither.io layered scale effect
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#00000055';
                ctx.stroke();
            }
        }
    }

    draw(ctx, w, h) {
        // Deep background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        const camX = this.camera.x;
        const camY = this.camera.y;
        const gs = this.gridSize;

        // Dynamic Dot Matrix / Hex Grid Background Effect
        ctx.fillStyle = '#1e293b';
        const bgSize = 2; // spacing in units
        const startX = Math.floor(camX / bgSize) * bgSize;
        const startY = Math.floor(camY / bgSize) * bgSize;

        ctx.globalAlpha = 0.5;
        for (let x = startX; x < camX + this.viewW + bgSize; x += bgSize) {
            for (let y = startY; y < camY + this.viewH + bgSize; y += bgSize) {
                const px = (x - camX) * gs;
                const py = (y - camY) * gs;
                ctx.beginPath();
                ctx.arc(px, py, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;

        // World Bounds red zone
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        const boundWidth = 2;
        if (camX < boundWidth) ctx.fillRect(0, 0, (boundWidth - camX) * gs, h);
        if (camY < boundWidth) ctx.fillRect(0, 0, w, (boundWidth - camY) * gs);
        if (camX + this.viewW > WORLD_W - boundWidth) {
            const edge = (WORLD_W - boundWidth - camX) * gs;
            ctx.fillRect(edge, 0, w - edge, h);
        }
        if (camY + this.viewH > WORLD_H - boundWidth) {
            const edge = (WORLD_H - boundWidth - camY) * gs;
            ctx.fillRect(0, edge, w, h - edge);
        }

        // Draw Food (glowing orbs)
        ctx.shadowBlur = 10;
        for (let i = 0; i < this.foods.length; i++) {
            const f = this.foods[i];
            if (f.x >= camX - 1 && f.x <= camX + this.viewW + 1 &&
                f.y >= camY - 1 && f.y <= camY + this.viewH + 1) {

                const px = (f.x - camX) * gs;
                const py = (f.y - camY) * gs;

                ctx.shadowColor = f.color;
                ctx.fillStyle = f.color;
                ctx.beginPath();
                ctx.arc(px, py, f.radius * gs, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0;

        // Draw Bots
        for (let i = 0; i < this.bots.length; i++) {
            this.drawEntity(ctx, this.bots[i], camX, camY);
        }

        // Draw Player
        this.drawEntity(ctx, this.player, camX, camY);

        this.drawMinimap(ctx, w, h);

        // HUD
        ctx.textAlign = 'left';
        ctx.font = 'bold 24px "Outfit"';
        ctx.fillStyle = this.isHardMode ? '#ef4444' : 'white';
        const modeText = this.isHardMode ? " [HARD]" : "";
        ctx.fillText(`LENGTH: ${this.player.length}${modeText}`, 30, 40);
        ctx.fillText(`Rank: ${this._cachedRank}/${this.bots.filter(b => !b.isDead).length + 1}`, 30, 80);

        if (this.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, w, h);

            ctx.textAlign = 'center';
            ctx.font = 'bold 80px "Outfit"';
            ctx.fillStyle = '#ef4444';
            ctx.fillText("WASTED", w / 2, h / 2 - 20);

            ctx.font = 'bold 40px "Outfit"';
            ctx.fillStyle = 'white';
            ctx.fillText(`FINAL LENGTH: ${this.player.length}`, w / 2, h / 2 + 40);

            ctx.font = '30px "Outfit"';
            ctx.fillStyle = '#9ca3af';
            ctx.fillText("Press 'A' to respawn, or 'Home' to exit.", w / 2, h / 2 + 100);
        }
    }

    computeRank() {
        let rank = 1;
        const pl = this.player.length;
        for (let i = 0; i < this.bots.length; i++) {
            if (!this.bots[i].isDead && this.bots[i].length > pl) rank++;
        }
        return rank;
    }

    drawMinimap(ctx, w, h) {
        const miniW = 160;
        const miniH = 120;
        const margin = 20;
        const x = w - miniW - margin;
        const y = margin;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.fillRect(x, y, miniW, miniH);
        ctx.strokeRect(x, y, miniW, miniH);

        const scaleX = miniW / WORLD_W;
        const scaleY = miniH / WORLD_H;

        // Food Drops (highlight large ones)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let i = 0; i < this.foods.length; i++) {
            const f = this.foods[i];
            if (f.isDrop) ctx.fillRect(x + f.x * scaleX, y + f.y * scaleY, 2, 2);
        }

        // Bots
        for (let i = 0; i < this.bots.length; i++) {
            const bot = this.bots[i];
            if (bot.isDead || bot.path.length === 0) continue;
            ctx.fillStyle = bot.color;
            ctx.beginPath();
            ctx.arc(x + bot.x * scaleX, y + bot.y * scaleY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Player
        if (!this.player.isDead && this.player.path.length > 0) {
            ctx.fillStyle = this.player.color;
            ctx.beginPath();
            ctx.arc(x + this.player.x * scaleX, y + this.player.y * scaleY, 3.5, 0, Math.PI * 2);
            ctx.fill();

            // Viewport
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + this.camera.x * scaleX, y + this.camera.y * scaleY, this.viewW * scaleX, this.viewH * scaleY);
        }
    }
}
