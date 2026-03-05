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
        this.gameId = 'pokemon_firered';

        // Setup GBA instance
        try {
            this.gba = new GameBoyAdvance();
            this.gba.logLevel = this.gba.LOG_ERROR;

            this.ctx = this.canvas.getContext('2d');
            this.gba.setCanvasDirect(this.canvas);

            // Draw callback: flush gbajs internal pixel data to our offscreen canvas
            this.gba.video.drawCallback = () => {
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
            this.resume();
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
                const record = await saveDB.loadSlot(this.gameId, this.currentSlot);
                if (record && record.buffer) {
                    this.gba.setSavedata(record.buffer);
                    console.log(`Successfully loaded SRAM for ${this.currentSlot} from IndexedDB.`);
                }
            } catch (e) {
                console.warn(`No existing save or error loading ${this.currentSlot}:`, e);
            }

            // Override gbajs default localStorage persistence with SaveDB
            this.gba.storeSavedata = async () => {
                const sram = this.gba.mmu.save;
                if (!sram) return;

                try {
                    const detachedBuffer = sram.view.buffer.slice(0, sram.view.byteLength);
                    const screenshot = this.captureScreenshot();
                    await saveDB.saveSlot(this.gameId, this.currentSlot, detachedBuffer, null, screenshot);
                    console.log(`Auto-saved SRAM to IndexedDB -> ${this.currentSlot} (${detachedBuffer.byteLength} bytes)`);
                } catch (e) {
                    console.error("Failed to commit SRAM to IndexedDB:", e);
                }
            };

            // Override retrieveSavedata so standard resets don't attempt to poll localStorage
            this.gba.retrieveSavedata = () => { return false; };

            this.isBooted = true;
            this.gba.paused = true; // Force resume to start the initial loop
            this.resume();
        } catch (err) {
            console.error("GBA Boot Error:", err);
        }
    }

    pause() {
        if (!this.gba || !this.isBooted || this.gba.paused) return;
        this.gba.pause();
    }

    resume() {
        if (!this.gba || !this.isBooted || !this.gba.paused) return;
        this.gba.runStable();
    }

    /**
     * Capture a screenshot of the current GBA canvas frame as a data URL.
     */
    captureScreenshot() {
        try {
            return this.canvas.toDataURL('image/png');
        } catch (e) {
            console.warn("Failed to capture screenshot:", e);
            return null;
        }
    }

    /**
     * Save the full emulator state + SRAM + screenshot to a specific slot.
     * Assumes the emulator is already paused via the save menu toggle.
     */
    async saveState(slotId) {
        if (!this.isBooted) return false;

        try {
            // Capture full emulator state (exact frame)
            const state = this.gba.freeze();

            // Capture SRAM buffer (read-only)
            let sramBuffer = null;
            const sram = this.gba.mmu.save;
            if (sram && sram.view) {
                sramBuffer = sram.view.buffer.slice(0, sram.view.byteLength);
            }

            // Capture screenshot
            const screenshot = this.captureScreenshot();

            // Persist to IndexedDB
            await saveDB.saveSlot(this.gameId, slotId, sramBuffer, state, screenshot);
            console.log(`Saved exact state + SRAM + screenshot to ${slotId}`);

            return true;
        } catch (e) {
            console.error("Failed to save state:", e);
            alert("Save Error: " + (e.stack || e.message || String(e)));
            this.resume();
            return false;
        }
    }

    /**
     * Load a full emulator state from a specific slot.
     */
    async loadState(slotId) {
        if (!this.isBooted) return false;

        try {
            const record = await saveDB.loadSlot(this.gameId, slotId);
            if (!record) {
                console.warn(`No save data found for ${slotId}`);
                return false;
            }

            this.currentSlot = slotId;

            if (record.state) {
                // Clear audio to drop outdated channel timers that could cause infinite loops
                if (this.gba.audio) this.gba.audio.clear();

                // Unpack gbajs's native Blob wrappers back into pure ArrayBuffers
                await this.unpackStateBlobs(record.state);

                // Instantly restore exact emulator state
                this.gba.defrost(record.state);

                // --- FIX FOR GBAJS AUDIO RECURSION BUG ---
                // gbajs defrosts CPU cycles, but forgets to defrost audio `nextEvent` and channels.
                // This causes `updateTimers` to infinitely recurse trying to catch up to the new CPU time.
                // We must forcibly fast-forward the primary timer to the current CPU cycles.
                if (this.gba.audio) {
                    this.gba.audio.nextEvent = this.gba.cpu.cycles;
                    // nextSample is correctly restored by defrost() so it doesn't need overriding
                }
                // ------------------------------------------

                console.log(`State restored from ${slotId} — instant exact resume`);

                // loadState causes the menu to close without calling toggleSaveMenu(),
                // so we MUST explicitly resume here.
                this.resume();
            } else if (record.buffer) {
                // Fallback: legacy SRAM-only load (must reboot ROM)
                this.pause();
                this.isBooted = false;
                await this.boot();
                console.log(`SRAM restored from ${slotId} — rebooted ROM`);
            }

            return true;
        } catch (e) {
            console.error("Failed to load state:", e);
            alert("Load Error: " + (e.stack || e.message || String(e)));
            this.resume();
            return false;
        }
    }

    /**
     * Synchronously finds all Blob objects in the state tree and replaces them asynchronously.
     * This avoids massive event-loop starvation from sequential awaits in deep trees.
     */
    async unpackStateBlobs(stateObj) {
        if (!stateObj || typeof stateObj !== 'object') return stateObj;

        const blobTasks = [];

        // 1. Synchronous deep scan to find all Blobs and their parent references
        function scan(obj, parent, key) {
            if (!obj || typeof obj !== 'object') return;

            if (obj && typeof obj.arrayBuffer === 'function') {
                // Register a replacement task
                blobTasks.push(async () => {
                    const buffer = await obj.arrayBuffer();
                    parent[key] = buffer.slice(4); // Slice off 4-byte Serializer header
                });
                return;
            }

            if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
                return; // Do not recurse into typed arrays
            }

            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) scan(obj[i], obj, i);
            } else {
                for (const k in obj) {
                    // Prevent descending into native getters or nulls
                    if (Object.prototype.hasOwnProperty.call(obj, k)) scan(obj[k], obj, k);
                }
            }
        }

        // Start scan. If the root itself is a blob, handle separately.
        if (stateObj && typeof stateObj.arrayBuffer === 'function') {
            const buffer = await stateObj.arrayBuffer();
            return buffer.slice(4);
        }

        scan(stateObj, null, null);

        // 2. Execute all Blob arrayBuffer() extractions concurrently
        await Promise.all(blobTasks.map(task => task()));

        return stateObj;
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
        const targetW = h * (3 / 2);
        const xOffset = (w - targetW) / 2;

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.canvas, xOffset, 0, targetW, h);
    }
}
