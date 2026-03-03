import GameBoyAdvance from '../../assets/emu/gbajs.js';
import { saveDB } from './utils/saveDB.js';

export class GBAApp {
    constructor() {
        this.gba = null;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 240;
        this.canvas.height = 160;

        this.isBooted = false;
        this.currentSlot = 'Slot 1';

        // Setup GBA instance
        try {
            this.gba = new GameBoyAdvance();
            this.gba.logLevel = this.gba.LOG_ERROR;

            this.ctx = this.canvas.getContext('2d');
            this.gba.setCanvasDirect(this.canvas); // This safely binds the Context2D and creates an ImageData struct internally

            // Define the hook that flushes the ImageData struct to the visible offscreen canvas every frame
            this.gba.video.drawCallback = () => {
                // gbajs internally exposes the updated ImageData on the software render target
                const pixels = this.gba.video.renderPath.pixelData;
                if (pixels) {
                    this.ctx.putImageData(pixels, 0, 0);
                }
            };

            this.keyMap = {
                'a': this.gba.keypad.A,
                'b': this.gba.keypad.B,
                'plus': this.gba.keypad.START,
                'minus': this.gba.keypad.SELECT,
                'up': this.gba.keypad.UP,
                'down': this.gba.keypad.DOWN,
                'left': this.gba.keypad.LEFT,
                'right': this.gba.keypad.RIGHT,
                'r_bumper': this.gba.keypad.R,
                'l_bumper': this.gba.keypad.L
            };

        } catch (e) {
            console.error("GBA Initialization failed", e);
        }
    }

    async boot() {
        if (this.isBooted) {
            this.gba.runStable();
            this.gba.audio.masterEnable = true;
            return;
        }

        try {
            // Load BIOS
            const biosReq = await fetch('assets/emu/bios.bin');
            const biosBuffer = await biosReq.arrayBuffer();
            this.gba.setBios(biosBuffer);

            // Load ROM
            const romReq = await fetch('assets/roms/pokemon.gba');
            const romBuffer = await romReq.arrayBuffer();
            const romStatus = this.gba.setRom(romBuffer);
            console.log("GBARom Boot Status:", romStatus, romBuffer.byteLength);

            // Fetch Save File from IndexedDB
            try {
                const savedData = await saveDB.loadSlot('pokemon_firered', this.currentSlot);
                if (savedData) {
                    this.gba.setSavedata(savedData);
                    console.log(`Successfully loaded SRAM for ${this.currentSlot} from IndexedDB.`);
                }
            } catch (e) {
                console.warn(`No existing save or error loading ${this.currentSlot}:`, e);
            }

            // Override gbajs default localStorage persistance with SaveDB
            this.gba.storeSavedata = async () => {
                const sram = this.gba.mmu.save;
                if (!sram) return;

                try {
                    // Extract Uint8Array view elements, then slice to copy into a purely detached ArrayBuffer
                    const detachedBuffer = sram.view.buffer.slice(0, sram.view.byteLength);
                    await saveDB.saveSlot('pokemon_firered', this.currentSlot, detachedBuffer);
                    console.log(`Saved SRAM to IndexedDB -> ${this.currentSlot} (${detachedBuffer.byteLength} bytes)`);
                } catch (e) {
                    console.error("Failed to commit SRAM to IndexedDB:", e);
                }
            };

            // Override retrieveSavedata so standard resets don't attempt to poll localStorage
            this.gba.retrieveSavedata = () => { return false; };

            this.gba.runStable();
            this.isBooted = true;
        } catch (err) {
            console.error("GBA Boot Error:", err);
        }
    }

    handleInput(action, isDown) {
        if (!this.isBooted) return;

        const gbaKey = this.keyMap[action];
        if (gbaKey !== undefined) {
            if (isDown) {
                this.gba.keypad.keydown(gbaKey);
            } else {
                this.gba.keypad.keyup(gbaKey);
            }
        }
    }

    update(dt) {
        // GBA JS runs on its own internal stable timer, we just need to harvest the canvas in draw
    }

    draw(ctx, w, h) {
        // Clear background black
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        // Draw the GBA 240x160 canvas stretched perfectly to our 16:9 Switch Canvas (1280x720)
        // GBA aspect ratio is 3:2. 
        // We will maintain aspect ratio and letterbox it horizontally
        const targetW = h * (3 / 2); // 720 * 1.5 = 1080
        const xOffset = (w - targetW) / 2; // (1280 - 1080) / 2 = 100

        // We want crisp pixels, not blurry bilinear filtering
        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(this.canvas, xOffset, 0, targetW, h);
    }
}
