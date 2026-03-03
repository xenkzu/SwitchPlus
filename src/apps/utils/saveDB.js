/**
 * IndexedDB wrapper for managing GBA emulator save slots.
 * SRAM blobs can be large (up to 128KB), so IndexedDB is used instead of localStorage.
 */
export class SaveDB {
    constructor(dbName = 'SwitchPlusSaves', dbVersion = 1) {
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
                    // Create object store with a composite key path for Game ID and Slot ID
                    db.createObjectStore(this.storeName, { keyPath: ['gameId', 'slotId'] });
                }
            };
        });
    }

    async saveSlot(gameId, slotId, buffer) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            // buffer must be ArrayBuffer or Uint8Array
            const data = {
                gameId: gameId,
                slotId: slotId,
                timestamp: Date.now(),
                buffer: buffer
            };

            const request = store.put(data);

            request.onsuccess = () => resolve(true);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async loadSlot(gameId, slotId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get([gameId, slotId]);

            request.onsuccess = (event) => {
                if (event.target.result) {
                    resolve(event.target.result.buffer);
                } else {
                    resolve(null); // No save exists
                }
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async getAvailableSlots(gameId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (event) => {
                const results = event.target.result;
                // Filter by gameId and return metadata (without the entire buffer blob for fast UI rendering)
                const slots = results
                    .filter(item => item.gameId === gameId)
                    .map(item => ({
                        slotId: item.slotId,
                        timestamp: item.timestamp,
                        size: item.buffer.byteLength
                    }));
                resolve(slots);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }
}

// Export a singleton instance
export const saveDB = new SaveDB();
