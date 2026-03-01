import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SnakeApp } from './apps/snake.js';
import { PongApp } from './apps/pong.js';
import { SettingsApp } from './apps/settings.js';
import { Progress } from './apps/progress.js';
import { Daily } from './apps/daily.js';

// --- 1. Scene Setup & Aesthetics ---
const container = document.getElementById('scene-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#111111'); // Dark Studio Background

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 12); // Restored original framing zoom

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Enhanced Tone Mapping for vibrant colors
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 25;
controls.minDistance = 5;

// --- 2. Lighting (Boosted for PBR) ---
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

// Key light 
const dirLight = new THREE.DirectionalLight(0xffffff, 2.8);
dirLight.position.set(5, 10, 10);
scene.add(dirLight);

// Fill light for the dark side
const fillLight = new THREE.DirectionalLight(0xb0d0ff, 1.2);
fillLight.position.set(-8, 3, 5);
scene.add(fillLight);

// Rim light 
const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
rimLight.position.set(0, 5, -10);
scene.add(rimLight);

// --- 3. Switch OS Home Screen (High-Fidelity Canvas Logic) ---
const canvas = document.getElementById('screen-canvas');
const ctx = canvas.getContext('2d');
const screenTexture = new THREE.CanvasTexture(canvas);
screenTexture.generateMipmaps = false;
screenTexture.minFilter = THREE.LinearFilter;
screenTexture.colorSpace = THREE.SRGBColorSpace;

const w = canvas.width;  // 1280
const h = canvas.height; // 720

const gridSize = 40;
const gridW = Math.floor(w / gridSize);
const gridH = Math.floor(h / gridSize);

// Game State / UI State
let activeGameIndex = 0;
const games = [
    { title: "Snake", color: "#10b981", img: "public/snake.png" },
    { title: "Pong", color: "#b91c1c", img: "public/pong.png" },
    { title: "Daily Challenge", color: "#eab308", img: "public/daily.png" }, // New generic daily app tile
    { title: "Mario Kart 8 Deluxe", color: "#047857", img: "https://upload.wikimedia.org/wikipedia/en/b/b5/MarioKart8Boxart.jpg" },
    { title: "Super Smash Bros", color: "#4c1d95", img: "https://upload.wikimedia.org/wikipedia/en/5/50/Super_Smash_Bros._Ultimate.jpg" },
    { title: "System Settings", color: "#2a2a2a", img: "" }
];

// Preload Images
games.forEach(g => {
    if (g.img) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = g.img;
        g.imageObj = img;
    }
});

let targetScrollX = 0;
let currentScrollX = 0;
let isOpeningGame = false;
let gameOverlayOpacity = 0;
// We'll track the scale of each tile individually for smooth bouncing
let tileScales = games.map(() => 1);

let bootTime = 0;
let isBooting = true;

// --- Native Mini-Games State ---
let currentGameApp = null; // 'snake' or 'pong' or 'settings'

// Native Modules
const snakeApp = new SnakeApp(gridW, gridH, gridSize);
const pongApp = new PongApp(gridW, gridH, gridSize);
const settingsApp = new SettingsApp();

// Toast notification state
let toastQueue = [];
let activeToast = null;
let toastTimer = 0;

window.addEventListener('switchplus_unlocked', (e) => {
    toastQueue.push(`Achievement Unlocked! ${e.detail}`);
});

Progress.onLevelUp = (newLevel) => {
    toastQueue.push(`Level Up! You are now Level ${newLevel}!`);
};

function drawHalfPill(ctx, x, y, width, height, radius, isLeft) {
    ctx.beginPath();
    if (isLeft) {
        ctx.moveTo(x + width, y);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
    }
}

function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

const UI_BG = '#282828'; // Authentic dark mode Switch BG
const UI_TEXT = '#ebebeb';
const UI_ACCENT = '#0ab9e6'; // Neon blue highlight

function updateCanvas(dt) {
    if (isBooting) {
        bootTime += dt;
        if (bootTime > 4.0) {
            isBooting = false;
        }
    }

    // Handle Toasts
    if (activeToast) {
        toastTimer -= dt;
        if (toastTimer <= 0) {
            activeToast = null;
        }
    } else if (toastQueue.length > 0) {
        activeToast = toastQueue.shift();
        toastTimer = 4.0; // Show for 4 seconds
    }

    // Smooth scrolling (Increased spacing from 260 to 320)
    targetScrollX = -(activeGameIndex * 320);
    currentScrollX += (targetScrollX - currentScrollX) * 12 * dt;

    // Smooth scaling for active tile bounce
    for (let i = 0; i < games.length; i++) {
        const targetScale = (i === activeGameIndex) ? 1.15 : 1.0;
        tileScales[i] += (targetScale - tileScales[i]) * 15 * dt;
    }

    if (isOpeningGame) {
        gameOverlayOpacity += 3 * dt;
        if (gameOverlayOpacity > 1) {
            gameOverlayOpacity = 1;
            // Launch the actual app once the screen is fully covered
            if (!currentGameApp) {
                // If it's the Daily Challenge tile, set the active game to whatever mode is chosen
                let loadIndex = activeGameIndex;
                if (activeGameIndex === 2) { // Daily Challenge
                    const dailyGame = Daily.getDailyModifier().game;
                    if (dailyGame === 'snake') loadIndex = 0;
                    if (dailyGame === 'pong') loadIndex = 1;
                    Daily.isActive = true; // Flag it!
                } else {
                    Daily.isActive = false; // Normal play
                }

                if (loadIndex === 0) {
                    currentGameApp = snakeApp;
                    snakeApp.reset();
                } else if (loadIndex === 1) {
                    currentGameApp = pongApp;
                    pongApp.reset();
                } else if (loadIndex === 5) {
                    currentGameApp = settingsApp;
                }
            }
        }
    } else {
        gameOverlayOpacity -= 5 * dt;
        if (gameOverlayOpacity < 0) {
            gameOverlayOpacity = 0;
            currentGameApp = null; // App fully closed
        }
    }

    // Pass rendering loop down to active Native App modules
    if (currentGameApp) {
        currentGameApp.update(dt);
    }
}

function drawCanvas() {
    // 1. Background (Classic Switch dark mode)
    ctx.fillStyle = UI_BG;
    ctx.fillRect(0, 0, w, h);

    // Top separating line (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(40, 95, w - 80, 2);
    ctx.fillRect(40, h - 140, w - 80, 2); // Bottom separating line

    // Live Clock
    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutes = now.getMinutes().toString().padStart(2, '0');

    // 2. Header Status Bar
    ctx.fillStyle = UI_TEXT;
    ctx.font = '500 22px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${hours}:${minutes} ${ampm}`, w - 50, 50);

    // Progression UI (XP Bar and Level - Switch Style)
    const xp = Progress.xpProgress;
    const barWidth = 200;
    const barHeight = 12;
    const barX = 140;
    const barY = 32;

    // Level Text
    ctx.fillStyle = UI_TEXT;
    ctx.font = '600 24px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Lv. ${Progress.state.level}`, 70, 48);

    // XP Bar Background
    ctx.fillStyle = '#111';
    drawRoundedRect(barX, barY, barWidth, barHeight, 6);
    ctx.fill();

    // XP Bar Fill
    if (xp.percentage > 0) {
        ctx.fillStyle = UI_ACCENT;
        drawRoundedRect(barX, barY, barWidth * xp.percentage, barHeight, 6);
        ctx.fill();
    }

    // Profile Icon (Top Left)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(40, 40, 20, 0, Math.PI * 2);
    ctx.fill();

    // 3. Game Title Text (Dynamic active selection)
    ctx.fillStyle = UI_ACCENT; // Highlight color for selected
    ctx.font = '600 32px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(games[activeGameIndex].title, 60, 150);

    // 4. Central Carousel
    ctx.save();
    // Shift the row to be perfectly centered on screen vertically
    ctx.translate(w / 2 - 130 + currentScrollX, h / 2 - 20);

    for (let i = 0; i < games.length; i++) {
        const gameX = i * 320; // Increased spacing between games
        const scale = tileScales[i];
        const isSelected = i === activeGameIndex;

        ctx.save();
        ctx.translate(gameX, 0);
        ctx.scale(scale, scale);

        const baseSize = 250; // Switch size
        const cornerRadius = 12; // Classic hard rounded rectangle

        // Switch neon shadow 
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = isSelected ? 20 : 10;
        ctx.shadowOffsetY = isSelected ? 8 : 4;

        // Draw tile background
        ctx.fillStyle = games[i].color;
        drawRoundedRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize, cornerRadius);
        ctx.fill();

        ctx.shadowColor = 'transparent'; // Remove shadow for inner elements

        // Draw Image if loaded successfully
        if (games[i].imageObj && games[i].imageObj.complete && games[i].imageObj.naturalWidth !== 0) {
            ctx.save();
            drawRoundedRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize, cornerRadius);
            ctx.clip();

            ctx.drawImage(games[i].imageObj, -baseSize / 2, -baseSize / 2, baseSize, baseSize);

            // Draw special text over Daily Challenge 
            if (i === 2) {
                const dailyMod = Daily.getDailyModifier();
                ctx.fillStyle = 'rgba(0,0,0,0.85)'; // Dark banner
                ctx.fillRect(-baseSize / 2, baseSize / 2 - 80, baseSize, 80);

                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.font = '600 20px "Inter"';
                ctx.fillText(dailyMod.name, 0, baseSize / 2 - 50);
                if (Progress.isDailyCompleted()) {
                    ctx.fillStyle = '#10b981';
                    ctx.fillText("✓ COMPLETED", 0, baseSize / 2 - 20);
                } else {
                    ctx.fillStyle = '#eab308';
                    ctx.fillText("READY!", 0, baseSize / 2 - 20);
                }
            }
            ctx.restore();
        } else {
            // Check if it's the settings app to draw a gear
            if (games[i].title === "System Settings" || games[i].title === "Settings") {
                ctx.save();
                ctx.translate(0, 0); // Center of tile

                // Draw gear base
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, 45, 0, Math.PI * 2);
                ctx.fill();

                // Draw gear teeth
                ctx.fillStyle = '#fff';
                for (let t = 0; t < 8; t++) {
                    ctx.save();
                    ctx.rotate((Math.PI * 2 / 8) * t);
                    ctx.fillRect(-12, -60, 24, 120);
                    ctx.restore();
                }

                // Inner circle to cut out center
                ctx.fillStyle = games[i].color; // Fill with background color
                ctx.beginPath();
                ctx.arc(0, 0, 25, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            } else {
                // Text fallback for apps without images
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Break title into lines if it's long
                const words = games[i].title.split(" ");
                ctx.font = '700 32px "Inter"';
                if (words.length > 1) {
                    ctx.fillText(words[0], 0, -20);
                    ctx.fillText(words.slice(1).join(" "), 0, 20);
                } else {
                    ctx.fillText(games[i].title, 0, 0);
                }
            }
        }

        // Switch glowing border for selected tile
        if (isSelected) {
            ctx.lineWidth = 6;
            ctx.strokeStyle = UI_ACCENT;
            ctx.stroke();

            // Inner glow effect trick
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
        }

        ctx.restore();
    }
    ctx.restore();

    // 5. Classic Bottom System Menu Row (Grey circles)
    const bottomY = h - 90;
    const icons = ['News', 'eShop', 'Album', 'Controllers', 'System', 'Sleep'];
    ctx.fillStyle = '#424242'; // Lighter grey circles

    const iconWidth = 60;
    const iconSpacing = 30;
    const totalMenuWidth = (icons.length * iconWidth) + ((icons.length - 1) * iconSpacing);
    const startX = (w - totalMenuWidth) / 2;

    for (let i = 0; i < icons.length; i++) {
        ctx.beginPath();
        ctx.arc(startX + (i * (iconWidth + iconSpacing)) + 30, bottomY + 30, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    // Bottom Controls Hint
    ctx.fillStyle = UI_TEXT;
    ctx.font = '500 22px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('A  Start   ⌂  Home', w - 50, h - 40);

    // 6. Draw Notification Toasts (Classic Switch slide-in)
    if (activeToast) {
        let toastY = 120;
        let alpha = 1.0;
        if (toastTimer < 0.5) alpha = toastTimer * 2;
        if (toastTimer > 3.5) alpha = (4.0 - toastTimer) * 2;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeStyle = UI_ACCENT;
        ctx.lineWidth = 2;

        ctx.font = '700 20px "Inter"';
        const txtWidth = ctx.measureText(activeToast).width;

        drawRoundedRect(w / 2 - txtWidth / 2 - 30, toastY, txtWidth + 60, 50, 25);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeToast, w / 2, toastY + 25);
        ctx.restore();
    }

    // 6. Game Opening Transition (Simulated Launch Splash / Built-in Native App)
    if (gameOverlayOpacity > 0) {
        // Draw the full solid background
        ctx.fillStyle = games[activeGameIndex].color;
        ctx.globalAlpha = gameOverlayOpacity;
        ctx.fillRect(0, 0, w, h);

        ctx.globalAlpha = 1;

        // If the native app is fully open, draw it instead of the splash
        if (gameOverlayOpacity === 1 && currentGameApp) {
            currentGameApp.draw(ctx, w, h);
        } else if (gameOverlayOpacity > 0.5) {
            // Loading splash transition
            ctx.globalAlpha = (gameOverlayOpacity - 0.5) * 2;
            ctx.fillStyle = (currentGameApp === settingsApp) ? '#2a2a2a' : '#fff';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = (currentGameApp === settingsApp) ? '#fff' : '#000';
            ctx.font = '700 70px "Inter"';
            ctx.textAlign = 'center';
            ctx.fillText(games[activeGameIndex].title, w / 2, h / 2);
            ctx.globalAlpha = 1;
        }
    }
}

function drawBootAnimation() {
    if (isBooting) {
        let overlayAlpha = 1.0;
        if (bootTime > 3.0) {
            overlayAlpha = 1.0 - Math.min(1, (bootTime - 3.0) * 1.5);
        }

        ctx.save();
        ctx.globalAlpha = overlayAlpha;

        // Draw pure red Nintendo background
        ctx.fillStyle = '#e60012';
        ctx.fillRect(0, 0, w, h);

        const centerX = w / 2;
        const centerY = h / 2 - 20;
        const pillW = 45;
        const pillH = 110;
        const radius = 22;
        const gap = 12;

        let leftOp = Math.min(1, Math.max(0, (bootTime - 0.3) * 5));
        ctx.globalAlpha = overlayAlpha * leftOp;

        // Draw Left Pill (Outline)
        drawHalfPill(ctx, centerX - gap / 2 - pillW, centerY - pillH / 2, pillW, pillH, radius, true);
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Left stick (solid white circle, near top)
        ctx.beginPath();
        ctx.arc(centerX - gap / 2 - pillW / 2, centerY - pillH / 4, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Right Pill (Solid White, slides down and "clicks")
        let rightYOffset = Math.max(0, Math.min(150, (1.3 - bootTime) * 150 * 3));
        if (bootTime < 1.0) rightYOffset = 200; // hidden or high up
        if (bootTime > 1.3) rightYOffset = 0;

        let rightOp = Math.min(1, Math.max(0, (bootTime - 0.8) * 5));
        ctx.globalAlpha = overlayAlpha * (bootTime > 1.0 ? 1.0 : rightOp);

        drawHalfPill(ctx, centerX + gap / 2, centerY - pillH / 2 - rightYOffset, pillW, pillH, radius, false);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Right stick (solid red circle, near bottom)
        ctx.beginPath();
        ctx.arc(centerX + gap / 2 + pillW / 2, centerY + pillH / 4 - rightYOffset, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#e60012';
        ctx.fill();

        // Draw NINTENDO SWITCH text
        let textOp = Math.min(1, Math.max(0, (bootTime - 1.5) * 4));
        ctx.globalAlpha = overlayAlpha * textOp;
        ctx.fillStyle = '#fff';
        ctx.font = '600 36px "Inter"';
        ctx.textAlign = 'center';
        ctx.fillText('NINTENDO SWITCH', centerX, centerY + pillH / 2 + 60);

        ctx.restore();
    }
}


// --- 4. High-Fidelity 3D Model Construction (Robust Fallback) ---
const switchGroup = new THREE.Group();
scene.add(switchGroup);
const interactableMeshes = [];

// Realistic Materials (Matched to reference photo)
const tabletMat = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.7, metalness: 0.1 });
const bezelMat = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.05, metalness: 0.8 });
const joyconBlueMat = new THREE.MeshStandardMaterial({ color: '#00c3e3', roughness: 0.4, metalness: 0.1 }); // Exact Neon Blue
const joyconRedMat = new THREE.MeshStandardMaterial({ color: '#ff4554', roughness: 0.4, metalness: 0.1 });  // Exact Neon Red
const btnMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.95, metalness: 0.05 }); // Same dark material as joysticks
const stickMat = btnMat; // All buttons share the same material
const stickCapMat = new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 1.0, metalness: 0.0 }); // Rubber grip top

// Helper function to create text textures mapped onto buttons
function createButtonLabel(text) {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');

    // Transparent background
    ctx.clearRect(0, 0, 128, 128);

    ctx.fillStyle = '#ffffff'; // White text
    ctx.font = 'bold 80px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 70); // Center text

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8 });
}

function createButton(geometry, material, x, y, z, actionLabel, parentGroup) {
    const btn = new THREE.Mesh(geometry, material);
    btn.position.set(x, y, z);
    btn.userData = { action: actionLabel, originalZ: z };
    interactableMeshes.push(btn);
    parentGroup.add(btn);
    return btn;
}

const tabletW = 7.6;
const tabletH = 4.4;
const tabletD = 0.5;

// Main Tablet Body (Robust shape)
const bodyGeo = new RoundedBoxGeometry(tabletW, tabletH, tabletD, 4, 0.2);
const body = new THREE.Mesh(bodyGeo, tabletMat);
switchGroup.add(body);

// Screen Bezel (Glossy) - uniform border
const bezelGeo = new RoundedBoxGeometry(tabletW - 0.1, tabletH - 0.1, tabletD + 0.02, 4, 0.15);
const bezel = new THREE.Mesh(bezelGeo, bezelMat);
switchGroup.add(bezel);

// 16:9 Screen - 0.3 uniform bezel on all sides, with soft rounded corners
const screenW = tabletW - 0.6;   // 0.3 gap each side (left + right)
const screenH = tabletH - 0.6;   // 0.3 gap top/bottom
const screenCornerR = 0.2;        // corner rounding radius

// Build a rounded-rect shape for the screen
const screenShape = new THREE.Shape();
const sW2 = screenW / 2;
const sH2 = screenH / 2;
screenShape.moveTo(-sW2 + screenCornerR, -sH2);
screenShape.lineTo(sW2 - screenCornerR, -sH2);
screenShape.quadraticCurveTo(sW2, -sH2, sW2, -sH2 + screenCornerR);
screenShape.lineTo(sW2, sH2 - screenCornerR);
screenShape.quadraticCurveTo(sW2, sH2, sW2 - screenCornerR, sH2);
screenShape.lineTo(-sW2 + screenCornerR, sH2);
screenShape.quadraticCurveTo(-sW2, sH2, -sW2, sH2 - screenCornerR);
screenShape.lineTo(-sW2, -sH2 + screenCornerR);
screenShape.quadraticCurveTo(-sW2, -sH2, -sW2 + screenCornerR, -sH2);

const screenGeo = new THREE.ShapeGeometry(screenShape, 16);

// Remap UVs so the texture fills the shape correctly
const _pos = screenGeo.attributes.position;
const _uvArr = [];
for (let i = 0; i < _pos.count; i++) {
    _uvArr.push((_pos.getX(i) + sW2) / screenW, (_pos.getY(i) + sH2) / screenH);
}
screenGeo.setAttribute('uv', new THREE.Float32BufferAttribute(_uvArr, 2));

const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
const screenMesh = new THREE.Mesh(screenGeo, screenMat);
screenMesh.position.set(0, 0, (tabletD / 2) + 0.016);
switchGroup.add(screenMesh);


// --- Joy-Cons (Robust Box geometries with Cylinder curves) ---
const jcWidth = 1.4;
const jcH = tabletH;

// --- Custom Shape for True Joy-Con Profile (Flat inner, half-circle outer)
function createJoyConShape(width, height, radius) {
    const shape = new THREE.Shape();
    // Start at bottom right (inner edge)
    shape.moveTo(width / 2, -height / 2);
    // Draw line to bottom left (outer edge curve start)
    shape.lineTo(-width / 2 + radius, -height / 2);
    // Bottom-left corner (small curve)
    shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2, -height / 2 + radius);
    // Left edge (straight up to top curve)
    shape.lineTo(-width / 2, height / 2 - radius);
    // Top-left corner (small curve)
    shape.quadraticCurveTo(-width / 2, height / 2, -width / 2 + radius, height / 2);
    // Line to top right (inner edge)
    shape.lineTo(width / 2, height / 2);
    // Inner edge (completely straight back to bottom right)
    shape.lineTo(width / 2, -height / 2);
    return shape;
}

const extrudeSettings = {
    depth: tabletD,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.05,
    bevelThickness: 0.05,
};

const leftJcShape = createJoyConShape(jcWidth, jcH - 0.1, 0.4); // 0.4 radius on the outer corners
const jcExtGeo = new THREE.ExtrudeGeometry(leftJcShape, extrudeSettings);
jcExtGeo.center();

// Left Joy-Con (Neon Blue)
const leftJcGroup = new THREE.Group();
const leftOffset = -(tabletW / 2) - (jcWidth / 2) - 0.01;
leftJcGroup.position.set(leftOffset, 0, 0);
switchGroup.add(leftJcGroup);

const leftJcMesh = new THREE.Mesh(jcExtGeo, joyconBlueMat); // Swapped back to Blue
// We don't need to rotate because we center()
leftJcGroup.add(leftJcMesh);

// L Bumper (Contoured to the top corner)
function createBumperShape() {
    const s = new THREE.Shape();
    s.moveTo(0.1, 0);
    s.lineTo(jcWidth - 0.05, 0);
    s.lineTo(jcWidth - 0.05, 0.15);
    // Curve top left corner tightly
    s.lineTo(0.3, 0.15);
    s.quadraticCurveTo(0.1, 0.15, 0.1, 0);
    return s;
}
const lBumperExt = { depth: 0.15, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 };
const lBumperGeo = new THREE.ExtrudeGeometry(createBumperShape(), lBumperExt);
lBumperGeo.center();
createButton(lBumperGeo, btnMat, -0.05, jcH / 2 + 0.01, 0.05, 'l_bumper', leftJcGroup);

// ZL Trigger (Sloped, behind bumper)
function createTriggerShape() {
    const s = new THREE.Shape();
    s.moveTo(0.1, 0);
    s.lineTo(jcWidth - 0.05, 0);
    s.lineTo(jcWidth - 0.05, 0.35);
    s.lineTo(0.4, 0.35);
    s.quadraticCurveTo(0.1, 0.35, 0.1, 0);
    return s;
}
const zlExt = { depth: 0.25, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 };
const zlGeo = new THREE.ExtrudeGeometry(createTriggerShape(), zlExt);
zlGeo.center();
const zlBtn = createButton(zlGeo, btnMat, -0.05, jcH / 2 + 0.02, -0.15, 'zl_trigger', leftJcGroup);
zlBtn.rotation.x = -Math.PI / 12; // Slant backward


// L-Stick (Clean analog stick - matches reference) - Increased by 20%
const stickBaseGeo = new THREE.CylinderGeometry(0.24, 0.31, 0.14, 32);
stickBaseGeo.rotateX(Math.PI / 2);

const stickCapGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.04, 32);
stickCapGeo.rotateX(Math.PI / 2);
stickCapGeo.translate(0, 0, 0.08);

const stickRimGeo = new THREE.TorusGeometry(0.23, 0.036, 12, 32);
stickRimGeo.translate(0, 0, 0.09);

const leftStick = new THREE.Group();
leftStick.add(new THREE.Mesh(stickBaseGeo, btnMat));
leftStick.add(new THREE.Mesh(stickCapGeo, stickCapMat));
leftStick.add(new THREE.Mesh(stickRimGeo, stickCapMat));
leftStick.position.set(0, 1.0, 0.35);
leftJcGroup.add(leftStick);

const btnZ = 0.35;

// --- D-Pad: 4 separate circular buttons, aligned below the joystick ---
// Aligned on X=0 to match the joystick center
const dPadCenterX = 0;
const dPadCenterY = -0.55;
const dPadSpacing = 0.29; // Increased spacing by ~20%

// Increased button radius by 20% (0.09 -> 0.11)
const dpadBtnGeo = new THREE.CylinderGeometry(0.108, 0.12, 0.05, 32);
dpadBtnGeo.rotateX(Math.PI / 2);

createButton(dpadBtnGeo, btnMat, dPadCenterX, dPadCenterY + dPadSpacing, btnZ, 'up', leftJcGroup);
createButton(dpadBtnGeo, btnMat, dPadCenterX, dPadCenterY - dPadSpacing, btnZ, 'down', leftJcGroup);
createButton(dpadBtnGeo, btnMat, dPadCenterX - dPadSpacing, dPadCenterY, btnZ, 'left', leftJcGroup);
createButton(dpadBtnGeo, btnMat, dPadCenterX + dPadSpacing, dPadCenterY, btnZ, 'right', leftJcGroup);

// Minus Button — Hardware accurate "-" shape, toward the screen
const minusShape = new THREE.Shape();
const mw = 0.07;
const mh = 0.02;
minusShape.moveTo(-mw, -mh); minusShape.lineTo(mw, -mh);
minusShape.lineTo(mw, mh); minusShape.lineTo(-mw, mh);
minusShape.lineTo(-mw, -mh);
const minusGeo = new THREE.ExtrudeGeometry(minusShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
minusGeo.center();
createButton(minusGeo, btnMat, 0.45, 1.6, btnZ, 'minus', leftJcGroup);

// Capture Button (small rounded square, lower area)
const captureGeo = new RoundedBoxGeometry(0.12, 0.12, 0.04, 2, 0.02);
createButton(captureGeo, btnMat, 0.15, -1.4, btnZ, 'capture', leftJcGroup);


// Right Joy-Con (Neon Red)
const rightJcGroup = new THREE.Group();
const rightOffset = (tabletW / 2) + (jcWidth / 2) + 0.01;
rightJcGroup.position.set(rightOffset, 0, 0);
switchGroup.add(rightJcGroup);

const rightJcShape = createJoyConShape(jcWidth, jcH - 0.1, 0.4);
const jcExtGeoR = new THREE.ExtrudeGeometry(rightJcShape, extrudeSettings);
jcExtGeoR.center();

const rightJcMesh = new THREE.Mesh(jcExtGeoR, joyconRedMat); // Swapped back to Red
// Flip it for the right side
rightJcMesh.rotation.y = Math.PI;
rightJcGroup.add(rightJcMesh);

// R Bumper
// Flip the bumper geometry as well
const rBumperGeo = new THREE.ExtrudeGeometry(createBumperShape(), lBumperExt);
rBumperGeo.center();
const rBumperBtn = createButton(rBumperGeo, btnMat, 0.05, jcH / 2 + 0.01, 0.05, 'r_bumper', rightJcGroup);
rBumperBtn.rotation.y = Math.PI;

// ZR Trigger (Sloped)
const zrGeo = new THREE.ExtrudeGeometry(createTriggerShape(), zlExt);
zrGeo.center();
const zrBtn = createButton(zrGeo, btnMat, 0.05, jcH / 2 + 0.02, -0.15, 'zr_trigger', rightJcGroup);
zrBtn.rotation.y = Math.PI;
zrBtn.rotation.x = -Math.PI / 12;

// R-Stick (clone of Left)
const rightStick = leftStick.clone();
rightStick.position.set(0, -0.7, 0.35);
rightJcGroup.add(rightStick);

// --- ABXY Buttons (4 separate circles, same dark material, with letter labels) ---
const abxyCenterY = 0.9;
const abxyCenterX = 0;
const abxySpacing = 0.29; // Increased spacing by ~20%

// Increased button radius by 20% (0.09 -> 0.11)
const abxyBtnGeo = new THREE.CylinderGeometry(0.108, 0.12, 0.05, 32);
abxyBtnGeo.rotateX(Math.PI / 2);

function addLabeledButton(x, y, label, action) {
    const btn = createButton(abxyBtnGeo, btnMat, x, y, btnZ, action, rightJcGroup);

    // White letter on top (scale up slightly)
    const decalMat = createButtonLabel(label);
    const decalGeo = new THREE.PlaneGeometry(0.144, 0.144);
    const decal = new THREE.Mesh(decalGeo, decalMat);
    decal.position.z = 0.026;
    btn.add(decal);

    return btn;
}

addLabeledButton(abxyCenterX, abxyCenterY + abxySpacing, 'X', 'x');
addLabeledButton(abxyCenterX, abxyCenterY - abxySpacing, 'B', 'b');
addLabeledButton(abxyCenterX - abxySpacing, abxyCenterY, 'Y', 'y');
addLabeledButton(abxyCenterX + abxySpacing, abxyCenterY, 'A', 'a');

// Plus Button — Hardware accurate "+" shape, toward the screen
const plusShape = new THREE.Shape();
const pw = 0.07;
const pt = 0.02; // Thickness
plusShape.moveTo(-pt, -pw); plusShape.lineTo(pt, -pw);
plusShape.lineTo(pt, -pt); plusShape.lineTo(pw, -pt);
plusShape.lineTo(pw, pt); plusShape.lineTo(pt, pt);
plusShape.lineTo(pt, pw); plusShape.lineTo(-pt, pw);
plusShape.lineTo(-pt, pt); plusShape.lineTo(-pw, pt);
plusShape.lineTo(-pw, -pt); plusShape.lineTo(-pt, -pt);
plusShape.lineTo(-pt, -pw);
const plusGeo = new THREE.ExtrudeGeometry(plusShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 2 });
plusGeo.center();
createButton(plusGeo, btnMat, -0.45, 1.6, btnZ, 'plus', rightJcGroup);

// Home Button (small circle, lower area)
const homeBtnGeo = new THREE.CylinderGeometry(0.10, 0.11, 0.04, 32);
homeBtnGeo.rotateX(Math.PI / 2);
createButton(homeBtnGeo, btnMat, -0.15, -1.3, btnZ, 'home', rightJcGroup);


// Initial presentation angle
switchGroup.rotation.y = -Math.PI / 10;
switchGroup.rotation.x = Math.PI / 16;


// --- 5. Interaction (Raycaster & Events) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function triggerAction(action) {
    if (currentGameApp) {
        // Universal escape route
        if (action === 'home' || action === 'b') {
            isOpeningGame = false;
        } else {
            currentGameApp.handleInput(action);
        }
        return; // Don't scroll OS
    }

    if (isOpeningGame && action !== 'home') return;

    if (action === 'left') {
        activeGameIndex = Math.max(0, activeGameIndex - 1);
    } else if (action === 'right') {
        activeGameIndex = Math.min(games.length - 1, activeGameIndex + 1);
    } else if (action === 'a' && !isOpeningGame) {
        isOpeningGame = true;

        // Immediate Native App Routing based on Game Index
        if (activeGameIndex === 0) {
            currentGameApp = snakeApp;
            snakeApp.reset();
        } else if (activeGameIndex === 1) {
            currentGameApp = pongApp;
            pongApp.reset();
        } else if (activeGameIndex === 5) {
            currentGameApp = settingsApp;
        } else {
            // Placeholder for other unbuilt games
            currentGameApp = null;
        }
    } else if (action === 'home') {
        isOpeningGame = false;
    }
}

let activeButtons = new Set();
function getOriginalZ(mesh) { return mesh.userData.originalZ; }

function physicalButtonPressed(mesh) {
    if (!mesh || !mesh.userData.action) return;
    mesh.position.z = getOriginalZ(mesh) - 0.03; // Animate push
    activeButtons.add(mesh);
    triggerAction(mesh.userData.action);
}

function physicalButtonReleased(mesh) {
    if (!mesh || !mesh.userData.action) return;
    mesh.position.z = getOriginalZ(mesh);
    activeButtons.delete(mesh);
}

function releaseAllButtons() {
    activeButtons.forEach(mesh => physicalButtonReleased(mesh));
}

function onPointerDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableMeshes);

    if (intersects.length > 0) {
        physicalButtonPressed(intersects[0].object);
        // Do NOT disable controls here, otherwise clicking a button to drag the console fails
    }
}

function onPointerUp() {
    releaseAllButtons();
}

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('pointerout', onPointerUp);

// Allow keyboard events to visually push the physical 3D buttons
function pushButtonByAction(actionLabel) {
    const mesh = interactableMeshes.find(m => m.userData.action === actionLabel);
    if (mesh) {
        physicalButtonPressed(mesh);
        // Auto-release after a fast pop
        setTimeout(() => physicalButtonReleased(mesh), 150);
    }
}

function onKeyDown(event) {
    // Prevent default scrolling for game keys
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
    }

    switch (event.code) {
        case 'ArrowLeft': pushButtonByAction('left'); break;
        case 'ArrowRight': pushButtonByAction('right'); break;
        case 'ArrowUp': pushButtonByAction('up'); break;
        case 'ArrowDown': pushButtonByAction('down'); break;
        case 'Space': case 'KeyA': pushButtonByAction('a'); break;
        case 'KeyB': pushButtonByAction('b'); break;
        case 'Escape': case 'Enter': pushButtonByAction('home'); break;
    }
}
window.addEventListener('keydown', onKeyDown);

// Hook settings changing
settingsApp.onThemeChange = (newTheme) => {
    joyconBlueMat.color.set(newTheme.left); // Left Joy-Con mesh
    joyconRedMat.color.set(newTheme.right); // Right Joy-Con mesh
};

// Always force the Neon theme on load to fix stale localStorage issue
// (Left=Blue, Right=Red is the classic Nintendo default)
joyconBlueMat.color.set('#00c3e3');
joyconRedMat.color.set('#ff4554');

// --- 6. Animation Loop ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);

    updateCanvas(dt);
    drawCanvas();
    drawBootAnimation(); // Fixed! The boot splash is drawn on top of the OS while booting
    screenTexture.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

