import {
    GALACTIC_LEGENDS_MAP,
    SHIPS_MAP,
    PILOTS_MAP,
    CONQUEST_CHARACTERS_SET,
    CONQUEST_SHIPS_MAP,
    ASSAULT_CHARACTERS
} from '../constants.js';
import { getShipInfo, getPlayerUnitInfo } from './player.js';

const galacticLegends = Object.keys(GALACTIC_LEGENDS_MAP);
const ships = Object.keys(SHIPS_MAP);
const pilots = Object.keys(PILOTS_MAP);
const conquestCharacters = [...CONQUEST_CHARACTERS_SET];
const conquestShips = Object.keys(CONQUEST_SHIPS_MAP);

export function createPlayerSorter(key, direction, shipBaseIds) {
    return (a, b) => {
        if (ships.includes(key) || conquestShips.includes(key)) {
            const valA_ship = a[key];
            const valB_ship = b[key];

            if (valA_ship.type < valB_ship.type) return direction === 'asc' ? -1 : 1;
            if (valA_ship.type > valB_ship.type) return direction === 'asc' ? 1 : -1;

            if (valA_ship.rarity < valB_ship.rarity) return direction === 'asc' ? -1 : 1;
            if (valA_ship.rarity > valB_ship.rarity) return direction === 'asc' ? 1 : -1;

            return 0;
        }

        if (galacticLegends.includes(key) || ASSAULT_CHARACTERS.includes(key) || pilots.includes(key) || conquestCharacters.includes(key) || key.endsWith('-relic')) {
            const valA_gl = a[key] || { type: 0, level: 0, rarity: 0 };
            const valB_gl = b[key] || { type: 0, level: 0, rarity: 0 };

            if (valA_gl.type < valB_gl.type) return direction === 'asc' ? -1 : 1;
            if (valA_gl.type > valB_gl.type) return direction === 'asc' ? 1 : -1;

            if (valA_gl.level < valB_gl.level) return direction === 'asc' ? -1 : 1;
            if (valA_gl.level > valB_gl.level) return direction === 'asc' ? 1 : -1;

            if (valA_gl.rarity < valB_gl.rarity) return direction === 'asc' ? -1 : 1;
            if (valA_gl.rarity > valB_gl.rarity) return direction === 'asc' ? 1 : -1;

            return 0;
        }

        if (key.startsWith('tb-')) {
            const parts = key.split('-'); // e.g., ['tb', 'padawanobiwan', '5']
            const unitId = parts[1];
            const requiredLevel = parseInt(parts[2], 10);

            const isShip = shipBaseIds.has(unitId);

            const getPlayerScore = (player) => {
                if (isShip) {
                    const unitInfo = getShipInfo(player, unitId);
                    if (unitInfo.rarity >= requiredLevel) return 20 + unitInfo.rarity; // Meets requirement (20-27)
                    if (unitInfo.rarity > 0) return 10 + unitInfo.rarity; // Has ship, but not at required rarity (10-17)
                    return 0; // Doesn't have ship
                } else { // Character
                    const unitInfo = getPlayerUnitInfo(player, unitId);
                    // Type 3 = Relic, Type 2 = Gear
                    // We want to sort by: Meets Req > Has Relic > Has Gear > None
                    // Within Meets Req: Sort by Relic Level

                    if (unitInfo.type === 3) { // Relic
                        if (unitInfo.level >= requiredLevel) {
                            return 200 + unitInfo.level; // Meets requirement (200 + RelicLevel)
                        }
                        return 100 + unitInfo.level; // Has relic, but not at required level (100 + RelicLevel)
                    }
                    if (unitInfo.type === 2) { // Gear
                        return unitInfo.level; // Has gear (Level is usually 1-13)
                    }
                    return 0; // Doesn't have character or not geared
                }
            };

            const scoreA = getPlayerScore(a);
            const scoreB = getPlayerScore(b);

            if (scoreA < scoreB) return direction === 'asc' ? -1 : 1;
            if (scoreA > scoreB) return direction === 'asc' ? 1 : -1;

            // If scores are equal, secondary sort by player name
            if (a.playerName.toLowerCase() < b.playerName.toLowerCase()) {
                return direction === 'asc' ? -1 : 1;
            }
            if (a.playerName.toLowerCase() > b.playerName.toLowerCase()) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        }

        const valA = a[key];
        const valB = b[key];

        if (key === 'memberLevel') {
            const roleOrder = ['leader', 'officer', 'member'];
            const indexA = roleOrder.indexOf(valA);
            const indexB = roleOrder.indexOf(valB);
            if (indexA < indexB) return direction === 'asc' ? -1 : 1;
            if (indexA > indexB) return direction === 'asc' ? 1 : -1;

            // Secondary sort by playerName, always ascending
            if (a.playerName.toLowerCase() < b.playerName.toLowerCase()) return -1;
            if (a.playerName.toLowerCase() > b.playerName.toLowerCase()) return 1;
            return 0;
        }

        if (key === 'glAverage' || key === 'allyCode' || key === 'galacticPower' || key.startsWith('rareR') || key === 'modsRating' || key.startsWith('req') || key.endsWith('Omicron')) {
            const numA = Number(valA);
            const numB = Number(valB);
            if (numA < numB) return direction === 'asc' ? -1 : 1;
            if (numA > numB) return direction === 'asc' ? 1 : -1;
            return 0;
        }

        if (String(valA).toLowerCase() < String(valB).toLowerCase()) {
            return direction === 'asc' ? -1 : 1;
        }
        if (String(valA).toLowerCase() > String(valB).toLowerCase()) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    };
}

export function createDebugSorter(key, direction) {
    return (a, b) => {
        const statsA = a.stats;
        const statsB = b.stats;
        let valA, valB;

        if (key === 'round') {
            valA = a.round;
            valB = b.round;
        } else if (key === 'planet') {
            valA = a.planetName;
            valB = b.planetName;
        } else if (key === 'unitCount') {
            valA = statsA.units.length;
            valB = statsB.units.length;
        } else if (key === 'missing') {
            const isLastA = a.round === Math.max(...statsA.rounds);
            const isLastB = b.round === Math.max(...statsB.rounds);
            valA = isLastA ? (statsA.missingCount || 0) : -1;
            valB = isLastB ? (statsB.missingCount || 0) : -1;
        } else if (key === 'candidates') {
            const isLastA = a.round === Math.max(...statsA.rounds);
            const isLastB = b.round === Math.max(...statsB.rounds);
            valA = isLastA ? (statsA.candidateCount || 0) : -1;
            valB = isLastB ? (statsB.candidateCount || 0) : -1;
        } else if (key === 'relic') {
            valA = parseInt(statsA.relic.substring(1));
            valB = parseInt(statsB.relic.substring(1));
        } else {
            valA = statsA[key];
            valB = statsB[key];
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;

        if (a.round < b.round) return -1;
        if (a.round > b.round) return 1;
        if (a.planetName.toLowerCase() < b.planetName.toLowerCase()) return -1;
        if (a.planetName.toLowerCase() > b.planetName.toLowerCase()) return 1;

        return 0;
    };
}
