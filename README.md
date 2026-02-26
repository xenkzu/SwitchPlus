# 3D Nintendo Switch Interactive Experience

A high-fidelity, fully interactive 3D model of a Nintendo Switch, built entirely with **Three.js** and HTML5 Canvas. This project not only renders a realistic console that you can rotate and inspect in 3D space, but it also features a functional simulated operating system and fully playable native mini-games!

## ✨ Features

### Detailed 3D Hardware Model
- **Accurate Geometry:** The console is modeled proportionally, featuring perfectly beveled Joy-Cons, precise analog sticks, contoured shoulder bumpers (L/R), sloped rear triggers (ZL/ZR), and a realistic screen bezel.
- **Realistic Materials:** Utilizes `MeshStandardMaterial` for authentic plastic textures, glossy screens, and vibrant Joy-Con colors, enhanced by advanced scene lighting (Key, Fill, Rim, Ambient) and ACESFilmic Tone Mapping.
- **Physical Button Interactions:** Clicking the 3D buttons (A, B, X, Y, D-Pad, Triggers, etc.) with your mouse physically pushes the buttons inward on the model.
- **Keyboard Hardware Sync:** Pressing the Arrow Keys or 'A'/'B' keys natively triggers the same 3D button depression animations, bridging the gap between your physical keyboard and the virtual hardware!
- **Free Camera Rotation:** Seamlessly orbit, pan, and zoom around the console in full 3D space using `OrbitControls`, even while games are running on the screen!

### Interactive Canvas Operating System
- **Nintendo Boot Sequence:** The project greets you with an authentic sliding Joy-Con logo boot-up animation.
- **Dynamic OS Menu:** Navigate a sleek, scrolling horizontal game tile carousel rendered cleanly using HTML5 Canvas (`CanvasTexture`).
- **Smooth Visuals:** Hover states, selection bouncing, and simulated app launching transitions.

### Playable Native Mini-Games
Games are rendered natively inside the 3D screen using a 2D context canvas loop, completely avoiding the need for clunky `iframes`. All games are playable using your keyboard (Arrow Keys & Space) or by clicking the 3D Joy-Con buttons!

* **Snake (*Game Tile 1*):** A fully functional Snake clone. Guide your green snake, eat food, and go for a high score!
* **Pong (*Game Tile 2*):** A built-in Pong clone featuring a reactive AI opponent. First to 5 wins!

### Dynamic Hardware Theming
* **System Settings (*Tile 6*):** Open the settings app to dynamically swap the physical colors of your 3D Joy-Cons! Changing themes in the app immediately updates the 3D materials in the scene.
* **Available Themes:** Neon (Default), Classic Grey, Animal Crossing, and Pokemon.

## 📁 Project Structure

This project uses modern ES6 JavaScript modules for clean, maintainable architecture.

* `index.html` - The entryway that sets up the UI layer and WebGL container.
* `style.css` - Styling for the background gradients and UI overlays.
* `main.js` - The core engine. Handles the Three.js 3D scene, lighting, controls, rendering loop, and raycasting.
* `apps/` - Contains the isolated logic for the native canvas applications.
  * `settings.js` - Logic and rendering for the Theme Switcher.
  * `snake.js` - Game logic, collisions, and layout for Snake.
  * `pong.js` - Game loop and AI logic for Pong.

## 🚀 How to Run

Since ES6 Modules are used, you must run this project on a local web server (opening the `.html` file directly in a browser may throw CORS errors).

**Using Python:**
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your browser.

## ⌨️ Controls

* **Left Click & Drag:** Rotate the 3D Switch.
* **Right Click & Drag:** Pan the camera.
* **Scroll Wheel:** Zoom in/out.
* **Arrow Keys (Left/Right):** Navigate the OS Home Menu.
* **Spacebar or 'A' Key:** Select/Launch a game.
* **Escape or 'Enter' / 'B' Key:** Exit the current game and return to the Home Menu.
* **In-Game (Arrow Keys):** Control Snake/Pong functionality.
