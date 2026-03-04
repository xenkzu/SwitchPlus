# Switch Plus

A high-fidelity, fully interactive 3D Nintendo Switch built with **Three.js** and HTML5 Canvas. Features a functional simulated operating system, playable mini-games, a working Game Boy Advance emulator, an achievement system, and dynamic hardware theming.


## Features

### 3D Hardware Model
- Proportionally accurate geometry with beveled Joy-Cons, analog sticks, shoulder bumpers (L/R), rear triggers (ZL/ZR), and a realistic screen bezel.
- Realistic materials using `MeshStandardMaterial` with authentic plastic textures, matte back panel, and vibrant Joy-Con colors.
- Advanced scene lighting (Key, Fill, Rim, Ambient) with ACESFilmic Tone Mapping.
- Physical button interactions — clicking 3D buttons with your mouse pushes them inward on the model.
- Keyboard-to-hardware sync — pressing keys triggers matching 3D button animations.
- Free camera rotation via `OrbitControls` (orbit, pan, zoom), even while games are running.

### Operating System
- Authentic sliding Joy-Con logo boot-up animation.
- Scrolling horizontal game tile carousel rendered on the 3D screen via `CanvasTexture`.
- Smooth hover states, selection bouncing, and app launching transitions.
- Player profile and level system displayed in the top-left corner.

### Native Mini-Games
Games render directly inside the 3D screen using a 2D canvas loop — no iframes.
- **Snake** — Guide your snake, eat food, and chase a high score.
- **Pong** — Play against a reactive AI opponent. First to 5 wins.

### GBA Emulator (Pokemon FireRed)
- Integrated **gbajs** emulator running Pokemon FireRed directly on the 3D Switch screen.
- Full audio support through the Web Audio API.
- Complete input mapping — all keyboard controls and 3D button clicks are forwarded to the emulator.
- **Multiple Save Slots** — Press the minus (-) button to open the Save Data menu. Three independent save slots backed by IndexedDB for persistence across sessions.

### Achievement System
- Unlockable achievements triggered by gameplay milestones (first game launch, high scores, etc.).
- Toast notifications slide in from the top-left corner with a chime sound effect.
- Persistent progress tracking with a player leveling system.

### Hardware Theming
- Open System Settings to dynamically swap Joy-Con colors on the 3D model in real time.
- Available themes: Neon (default), Classic Grey, Animal Crossing, and Pokemon.


## Project Structure

```
index.html              Entry point — sets up the UI layer and WebGL container
src/
  main.js               Core engine — Three.js scene, lighting, controls, rendering, raycasting
  style.css             Background gradients, UI overlays, achievement toast styling
  apps/
    snake.js            Snake game logic and rendering
    pong.js             Pong game loop and AI
    settings.js         Theme switcher logic
    gba.js              GBA emulator integration (boot, input forwarding, save/load)
    achievements.js     Achievement definitions and unlock logic
    utils/
      saveDB.js         IndexedDB helper for persistent GBA save slots
assets/
  emu/
    gbajs.js            Bundled GBA emulator core
  roms/
    bios.bin            GBA BIOS file
    pokemon.gba         Pokemon FireRed ROM
  snake.jpg             Snake game tile image
  pong.jpg              Pong game tile image
  firered.png           Pokemon FireRed tile image
```


## How to Run

This project uses ES6 modules, so it must be served from a local web server.

```bash
# Using Node.js
npx serve .

# Using Python
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.


## Controls

| Action | Input |
|---|---|
| Rotate the 3D Switch | Left Click + Drag |
| Pan the camera | Right Click + Drag |
| Zoom in/out | Scroll Wheel |
| Navigate Home Menu | Arrow Keys (Left / Right) |
| Select / Launch | Spacebar or A key |
| Exit to Home Menu | Escape or B key |
| GBA Start button | Enter or P key |
| Open Save Data menu | Minus (-) key |
| In-game controls | Arrow Keys |
