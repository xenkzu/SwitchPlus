import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'https://unpkg.com/three@0.128.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SnakeApp } from './apps/snake.js';
import { PongApp } from './apps/pong.js';
import { SettingsApp } from './apps/settings.js';

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
    { title: "Snake", color: "#10b981", img: "https://upload.wikimedia.org/wikipedia/en/c/c6/The_Legend_of_Zelda_Breath_of_the_Wild.jpg" }, // Reuse box art for styling
    { title: "Pong", color: "#b91c1c", img: "https://upload.wikimedia.org/wikipedia/en/8/8d/Super_Mario_Odyssey.jpg" },
    { title: "Mario Kart 8 Deluxe", color: "#047857", img: "https://upload.wikimedia.org/wikipedia/en/b/b5/MarioKart8Boxart.jpg" },
    { title: "Animal Crossing", color: "#065f46", img: "https://upload.wikimedia.org/wikipedia/en/1/1f/Animal_Crossing_New_Horizons.jpg" },
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
                if (activeGameIndex === 0) {
                    currentGameApp = snakeApp;
                    snakeApp.reset();
                } else if (activeGameIndex === 1) {
                    currentGameApp = pongApp;
                    pongApp.reset();
                } else if (activeGameIndex === 5) {
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
    // 1. Background
    ctx.fillStyle = UI_BG;
    ctx.fillRect(0, 0, w, h);

    // Top separating line (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(40, 95, w - 80, 2);
    ctx.fillRect(40, 560, w - 80, 2);

    // 2. Header Status Bar
    ctx.fillStyle = UI_TEXT;
    ctx.font = '22px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('12:00', w - 50, 50);

    // Profile Icon (Top Left)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(80, 50, 25, 0, Math.PI * 2);
    ctx.fill();

    // 3. Game Title Text
    ctx.fillStyle = UI_ACCENT; // Highlight color for selected
    ctx.font = '32px "Outfit", sans-serif';
    ctx.textAlign = 'left';
    // Draw the active title dynamically based on selection
    ctx.fillText(games[activeGameIndex].title, 60, 160);

    // 4. Draw Games Row
    ctx.save();
    ctx.translate(w / 2 - 130 + currentScrollX, 350); // Keep start offset centered

    for (let i = 0; i < games.length; i++) {
        const gameX = i * 320; // Increased Spacing (was 260)
        const scale = tileScales[i];
        const isSelected = i === activeGameIndex;

        ctx.save();
        ctx.translate(gameX, 0);
        ctx.scale(scale, scale);

        const baseSize = 250;

        // Shadow for all, bigger for active
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = isSelected ? 20 : 10;
        ctx.shadowOffsetY = isSelected ? 8 : 4;

        // Draw tile background (fallback color)
        ctx.fillStyle = games[i].color;
        drawRoundedRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize, 12);
        ctx.fill();

        // Draw Image if loaded successfully
        if (games[i].imageObj && games[i].imageObj.complete && games[i].imageObj.naturalWidth !== 0) {
            ctx.save();
            ctx.clip(); // Clip to the rounded rect
            ctx.drawImage(games[i].imageObj, -baseSize / 2, -baseSize / 2, baseSize, baseSize);
            ctx.restore();
        } else {
            // Text fallback for apps without images (like Settings)
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Break title into lines if it's long
            const words = games[i].title.split(" ");
            ctx.font = 'bold 32px "Outfit"';
            if (words.length > 1) {
                ctx.fillText(words[0], 0, -20);
                ctx.fillText(words.slice(1).join(" "), 0, 20);
            } else {
                ctx.fillText(games[i].title, 0, 0);
            }
        }

        // Remove shadow for the border
        ctx.shadowColor = 'transparent';

        // Glowing border for selected tile
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

    // 5. Bottom System Menu Row
    const bottomY = 600;
    const icons = ['News', 'eShop', 'Album', 'Controllers', 'System', 'Sleep'];
    ctx.fillStyle = '#424242'; // Slightly lighter than bg

    // Calculate total width to center
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
    ctx.font = '22px "Outfit", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('A  Start   ⌂  Home', w - 50, h - 40);

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
            ctx.font = 'bold 70px "Outfit"';
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
        ctx.font = 'bold 36px "Outfit"';
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
const btnMat = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.8, metalness: 0.1 });
const stickMat = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9, metalness: 0.1 });

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

// Screen Bezel (Glossy)
const bezelGeo = new RoundedBoxGeometry(tabletW - 0.2, tabletH - 0.2, tabletD + 0.02, 4, 0.2);
const bezel = new THREE.Mesh(bezelGeo, bezelMat);
switchGroup.add(bezel);

// 16:9 Screen (Plane with Canvas Texture)
const screenW = 6.4;
const screenH = 3.6;
const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture });
const screenMesh = new THREE.Mesh(screenGeo, screenMat);
screenMesh.position.set(0, 0, (tabletD / 2) + 0.015); // Just barely atop the bezel
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

const leftJcMesh = new THREE.Mesh(jcExtGeo, joyconBlueMat);
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


// L-Stick
const stickBaseGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.05, 32);
stickBaseGeo.rotateX(Math.PI / 2);
const stickTopGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.04, 32);
stickTopGeo.rotateX(Math.PI / 2);
stickTopGeo.translate(0, 0, 0.05);

const leftStick = new THREE.Group();
leftStick.add(new THREE.Mesh(stickBaseGeo, stickMat));
leftStick.add(new THREE.Mesh(stickTopGeo, stickMat));
leftStick.position.set(0, 1.0, (tabletD / 2) + 0.02);
leftJcGroup.add(leftStick);

// D-Pad Directional Buttons
const arrowBtnGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 32);
arrowBtnGeo.rotateX(Math.PI / 2);
const btnZ = (tabletD / 2) + 0.03;

createButton(arrowBtnGeo, btnMat, 0.05, -0.2, btnZ, 'up', leftJcGroup);
createButton(arrowBtnGeo, btnMat, 0.05, -0.8, btnZ, 'down', leftJcGroup);
createButton(arrowBtnGeo, btnMat, -0.25, -0.5, btnZ, 'left', leftJcGroup);
createButton(arrowBtnGeo, btnMat, 0.35, -0.5, btnZ, 'right', leftJcGroup);

// Minus Button
const minusGeo = new THREE.BoxGeometry(0.12, 0.04, 0.06);
createButton(minusGeo, btnMat, 0.25, 1.7, btnZ, 'minus', leftJcGroup);

// Capture Button
const captureGeo = new THREE.BoxGeometry(0.14, 0.14, 0.04);
const captureBtn = createButton(captureGeo, btnMat, 0.15, -1.4, btnZ, 'capture', leftJcGroup);
// Capture indent
const captureIndentGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16);
captureIndentGeo.rotateX(Math.PI / 2);
const captureIndent = new THREE.Mesh(captureIndentGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
captureIndent.position.z = 0.02;
captureBtn.add(captureIndent);


// Right Joy-Con (Neon Red)
const rightJcGroup = new THREE.Group();
const rightOffset = (tabletW / 2) + (jcWidth / 2) + 0.01;
rightJcGroup.position.set(rightOffset, 0, 0);
switchGroup.add(rightJcGroup);

const rightJcShape = createJoyConShape(jcWidth, jcH - 0.1, 0.4);
const jcExtGeoR = new THREE.ExtrudeGeometry(rightJcShape, extrudeSettings);
jcExtGeoR.center();

const rightJcMesh = new THREE.Mesh(jcExtGeoR, joyconRedMat);
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

// R-Stick
const rightStick = leftStick.clone();
rightStick.position.set(-0.05, -0.7, (tabletD / 2) + 0.02);
rightJcGroup.add(rightStick);

// ABXY Buttons
createButton(arrowBtnGeo, btnMat, -0.05, 1.2, btnZ, 'x', rightJcGroup);
createButton(arrowBtnGeo, btnMat, -0.05, 0.6, btnZ, 'b', rightJcGroup);
createButton(arrowBtnGeo, btnMat, -0.35, 0.9, btnZ, 'y', rightJcGroup);
createButton(arrowBtnGeo, btnMat, 0.25, 0.9, btnZ, 'a', rightJcGroup);

// Plus Button 
const plusGeoV = new THREE.BoxGeometry(0.04, 0.12, 0.06);
const plusGeoH = new THREE.BoxGeometry(0.12, 0.04, 0.06);
const plusGroup = new THREE.Group();
plusGroup.add(new THREE.Mesh(plusGeoV, btnMat));
plusGroup.add(new THREE.Mesh(plusGeoH, btnMat));

const plusHitGeo = new THREE.BoxGeometry(0.2, 0.2, 0.06);
const plusHit = createButton(plusHitGeo, new THREE.MeshBasicMaterial({ visible: false }), -0.25, 1.7, btnZ, 'plus', rightJcGroup);
plusHit.add(plusGroup);

// Home Button
const homeGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 32);
homeGeo.rotateX(Math.PI / 2);
const homeBtn = createButton(homeGeo, btnMat, -0.15, -1.3, btnZ, 'home', rightJcGroup);
const homeOutlineGeo = new THREE.RingGeometry(0.1, 0.12, 32);
const homeOutline = new THREE.Mesh(homeOutlineGeo, new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide }));
homeOutline.position.z = 0.021;
homeBtn.add(homeOutline);


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
    joyconBlueMat.color.set(newTheme.left);
    joyconRedMat.color.set(newTheme.right);
};

// --- 6. Animation Loop ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);

    updateCanvas(dt);
    drawCanvas();
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

