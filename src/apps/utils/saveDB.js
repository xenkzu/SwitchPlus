/**
 * IndexedDB wrapper for managing GBA emulator save slots.
 * Stores full emulator state snapshots, SRAM buffers, screenshots, and timestamps.
 */
export class SaveDB {
    constructor(dbName = 'SwitchPlusSaves', dbVersion = 2) {
        this.dbName = dbName;
        this.dbVersion = dbVersion;
        this.db = null;
        this.storeName = 'gba_saves';
    }

    async init() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error("Database error: ", event.target.error);
                reject("Database error: " + event.target.errorCode);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: ['gameId', 'slotId'] });
                }
                // V2 adds state, screenshot fields — no schema migration needed
                // since we use put() and the new fields are simply added to the data objects
            };
        });
    }

    /**
     * Save a slot with full state, SRAM buffer, screenshot, and timestamp.
     * @param {string} gameId
     * @param {string} slotId
     * @param {ArrayBuffer|null} buffer - SRAM buffer
     * @param {Object|null} state - Full emulator freeze() state object
     * @param {string|null} screenshot - Data URL of the current frame
     */
    async saveSlot(gameId, slotId, buffer, state = null, screenshot = null) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const data = {
                gameId: gameId,
                slotId: slotId,
                timestamp: Date.now(),
                buffer: buffer,
                state: state,
                screenshot: screenshot
            };

            const request = store.put(data);

            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Load a slot's full record (state + screenshot + timestamp + buffer).
     * Returns the entire record object, or null if no save exists.
     */
    async loadSlot(gameId, slotId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get([gameId, slotId]);

            request.onsuccess = (event) => {
                resolve(event.target.result || null);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    /**
     * Get metadata for all slots belonging to a game.
     * Returns lightweight records (screenshot + timestamp) without the heavy state/buffer blobs.
     */
    async getAvailableSlots(gameId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (event) => {
                const results = event.target.result;
                const slots = results
                    .filter(item => item.gameId === gameId)
                    .map(item => ({
                        slotId: item.slotId,
                        timestamp: item.timestamp,
                        screenshot: item.screenshot || null,
                        hasState: !!item.state,
                        size: item.buffer ? item.buffer.byteLength : 0
                    }));
                resolve(slots);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

// Export a singleton instance
export const saveDB = new SaveDB();
