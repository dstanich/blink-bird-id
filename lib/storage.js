import { SQLiteStorage } from './sqlite-storage.js';

/**
 * Interface for clip storage that delegates to a swappable storage provider.
 */
export class Storage {
    /** Creates a new Storage instance with the default storage provider. */
    constructor() {
        this.provider = new SQLiteStorage();
    }

    /**
     * Persists a clip and its bird identification(s) to storage.
     * @param {Object} clip - The clip object containing metadata and optional birdIdentification.
     */
    addClip(clip) {
        return this.provider.addClip(clip);
    }

    /**
     * Flushes any pending writes to the backing store.
     * May be a no-op depending on the provider.
     */
    commit() {
        return this.provider.commit();
    }

    /**
     * Returns a map of processed clip IDs.
     * @returns {Object.<number, boolean>} An object keyed by clip ID, with `true` for each processed clip.
     */
    get data() {
        return this.provider.data;
    }
}
