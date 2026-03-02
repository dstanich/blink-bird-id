import * as fs from 'fs';
import * as path from 'path';

const DATA_FILE = 'data.json';

export class Storage {
    constructor() {
        this.dataDir = process.env.DATA_DIR || './data';
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        this._refresh();
    }

    addClip(clip) {
        this._data[clip.id] = clip;
    }

    commit() {
        const dataFilePath = path.join(this.dataDir, DATA_FILE);
        fs.writeFileSync(dataFilePath, JSON.stringify(this.data, null, 2), 'utf-8');
    }

    _refresh() {
        const dataFilePath = path.join(this.dataDir, DATA_FILE);
        if (fs.existsSync(dataFilePath)) {
            const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
            this._data = data;
        } else {
            this._data = {};
        }
    }

    get data() {
        return this._data;
    }
}
