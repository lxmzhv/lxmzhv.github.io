import { UNIT_NAME_MAP, REQ_TEAM_UNIT_COLOR_THRESHOLDS } from '../constants.js';

export function getUnitDisplayName(unitId) {
    const lowercasedUnitId = unitId.toLowerCase();
    if (UNIT_NAME_MAP[lowercasedUnitId]) {
        return UNIT_NAME_MAP[lowercasedUnitId];
    }
    // Fallback for unmapped units: capitalize first letter of each word
    return lowercasedUnitId.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

export function getOmicronDetails(player, unitId, skills, omicronSkillLevel) {
    const details = [];
    if (!player.roster || !player.roster[unitId]) {
        return skills.map(s => ({ name: s.displayName, hasOmicron: false }));
    }

    skills.forEach(skillInfo => {
        const skill = player.roster[unitId].skill?.find(s => s.id === skillInfo.skillId);
        const hasOmicron = !!(skill && skill.tier >= omicronSkillLevel);
        details.push({ name: skillInfo.displayName, hasOmicron: hasOmicron });
    });

    return details;
}

export function getOmicronCountForSkill(player, unitId, skillId, omicronSkillLevel) {
    if (!player.roster || !player.roster[unitId] || !player.roster[unitId].skill) {
        return 0;
    }
    const skill = player.roster[unitId].skill.find(s => s.id === skillId);
    return (skill && skill.tier >= omicronSkillLevel) ? 1 : 0;
}

export function getPlayerUnitInfo(player, unitId) {
    if (player.roster === undefined) {
        return { display: '', type: 0, level: 0, rarity: 0 };
    }

    if (player.roster === null || !player.roster[unitId]) {
        return { display: '-', type: 1, level: 0, rarity: 0 };
    }

    const unit = player.roster[unitId];

    let display, type, level, rarity;

    rarity = unit.currentRarity || 0;

    if (unit.relic && unit.relic.currentTier >= 2) {
        type = 3; // 'R'
        level = unit.relic.currentTier - 2;
        display = `R${level}`;
    } else {
        type = 2; // 'G'
        level = unit.currentTier;
        display = `G${level}`;
    }

    if (rarity > 0 && rarity < 7) {
        display += `, ${rarity}*`;
    }

    return { display, type, level, rarity };
}

export function getShipInfo(player, shipName) {
    let shipInfo;
    if (player.roster === undefined) {
        shipInfo = { display: '', type: 0, rarity: 0 }; // No player file
    } else if (player.roster === null || !player.roster[shipName]) {
        shipInfo = { display: '-', type: 1, rarity: 0 }; // Player file, but no ship
    } else {
        const ship = player.roster[shipName];
        const rarity = ship.currentRarity || 0;
        const display = `${rarity}*`;
        shipInfo = { display, type: 2, rarity }; // type 2 for 'has ship'
    }
    return shipInfo;
}

// Color/Formatting Helpers

export function getShipBGColor(shipInfo) {
    if (shipInfo.type === 0) return 'black'; // No info
    if (shipInfo.type === 1) return '#FF9999'; // No ship
    if (shipInfo.type === 2) {
        if (shipInfo.rarity < 7) return 'yellow';
        if (shipInfo.rarity === 7) return '#7ACC7A';
    }
    return ''; // Default or unknown
}

export function getPilotBackgroundColor(pilotInfo) {
    if (pilotInfo.type === 0) return 'black'; // No info
    if (pilotInfo.type === 1) return '#FF9999'; // No unit (red)
    if (pilotInfo.type === 2) return 'orange'; // G level (G1-G13)
    if (pilotInfo.type === 3) { // Relic
        if (pilotInfo.level >= 5) return '#7ACC7A'; // R5+ (slightly darker green)
        if (pilotInfo.level >= 3) return 'lightgreen'; // R3-R4
        if (pilotInfo.level >= 0) return 'yellow'; // R0-R2
    }
    return ''; // Default
}

export function getAssaultUnitBGColor(unitInfo) {
    if (unitInfo.type === 0) return 'black'; // No info
    if (unitInfo.type === 1) return '#FF9999'; // No unit (red)
    if (unitInfo.type === 2) return '#FF9999'; // G level (red)
    if (unitInfo.type === 3) { // Relic
        if (unitInfo.level === 10) return '#00CC00'; // R10
        if (unitInfo.level === 9) return '#7ACC7A'; // R9 (green)
        if (unitInfo.level >= 5) return 'yellow'; // R5-R8
        if (unitInfo.level >= 0) return 'orange'; // R0-R4
    }
    return ''; // Default
}

export function getUnitBGColor(unitInfo) {
    if (unitInfo.type === 0) return 'black'; // No info
    if (unitInfo.type === 1) return '#FF9999'; // No legend (brighter red)
    if (unitInfo.type === 2) return 'orange'; // G level (less than R0)
    if (unitInfo.type === 3) {
        if (unitInfo.level < 7) return 'yellow'; // R0-R6
        if (unitInfo.level < 9) return 'lightgreen'; // R7-R8
        if (unitInfo.level === 9) return '#7ACC7A'; // R9 (slightly darker green)
        if (unitInfo.level === 10) return '#00CC00'; // R10
    }
    return ''; // Default or unknown
}

export function getReqBackgroundColor(score) {
    if (score < 70) return '#FF9999'; // Red
    if (score < 80) return 'orange';
    if (score < 90) return 'yellow';
    if (score < 100) return 'lightgreen';
    return '#7ACC7A'; // Green
}

export function getReqUnitBGColor(unitInfo, unitId) {
    if (unitInfo.type !== 3) { // Not a relic
        return getUnitBGColor(unitInfo);
    }

    const thresholds = REQ_TEAM_UNIT_COLOR_THRESHOLDS[unitId];
    if (!thresholds) {
        return getUnitBGColor(unitInfo); // Fallback for safety
    }

    const level = unitInfo.level;
    if (level < thresholds.red) return '#FF9999';
    if (level < thresholds.orange) return 'orange';
    if (level < thresholds.yellow) return 'yellow';
    if (thresholds.lightgreen && level < thresholds.lightgreen) return 'lightgreen';
    return '#7ACC7A';
}

export function getRoleBackgroundColor(role) {
    switch (role) {
        case 'leader': return '#CC99FF'; // Brighter purple
        case 'officer': return '#99CCFF'; // Brighter blue
        case 'member': return 'lightgreen';
    }
    return ''; // Default
}

export function getRareCharBackgroundColor(count, isTotal = false) {
    let redThreshold = 0;
    let orangeThreshold = 1;
    let yellowThreshold = 2;
    let lightGreenThreshold = 3;

    if (isTotal) {
        redThreshold = 0;
        orangeThreshold = 3;
        yellowThreshold = 6;
        lightGreenThreshold = 9;
    }

    if (count <= redThreshold) return '#FF9999'; // Red
    if (count <= orangeThreshold) return 'orange';
    if (count <= yellowThreshold) return 'yellow';
    if (count <= lightGreenThreshold) return 'lightgreen';
    return '#7ACC7A'; // Green
}
