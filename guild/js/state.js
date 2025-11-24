export class State {
    constructor() {
        this.data = {
            guilds: [],
            players: [],
            planetStats: {},
            platoonRequirements: {}, // Raw requirements from TSV
            masterRareList: [], // Calculated rare list
            tbColumns: [], // Calculated columns
            tempPlanetConfig: {},
            selectedPlayerId: localStorage.getItem('selectedPlayerId'),
            selectedGuildId: localStorage.getItem('selectedGuildId'),
            rareUnitAvailabilityThreshold: 2,
            shipBaseIds: new Set(),
            sortKey: localStorage.getItem('sortKey') || 'memberLevel',
            sortDirection: localStorage.getItem('sortDirection') || 'asc',
            debugSortKey: localStorage.getItem('debugSortKey') || 'round',
            debugSortDirection: localStorage.getItem('debugSortDirection') || 'asc'
        };
        this.listeners = [];
    }

    get(key) {
        return this.data[key];
    }

    set(key, value) {
        this.data[key] = value;
        this.notify(key, value);
    }

    update(updates) {
        Object.assign(this.data, updates);
        Object.keys(updates).forEach(key => this.notify(key, updates[key]));
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify(key, value) {
        this.listeners.forEach(listener => listener(key, value, this.data));
    }
}

export const state = new State();
