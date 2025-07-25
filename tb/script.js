let state = {
    playerData: [],
    guildActivePhases: new Set(),
    sort: {
        key: 'totalWaves',
        direction: 'desc'
    }
};

const ZoneAliases = [
    ['tb3_mixed_', ''],
    ['phase0', 'p'],
    ["conflict01", "right"],
    ["conflict02", "left"],
    ["conflict03", "middle"],
    ['strike0', 'm'],
    ['covert0', 'sm'],
];

const SpecialMissions = [
   { name: 'Cere', id: 'phase02_conflict01_covert01' },
   { name: 'Reva', id: 'phase03_conflict03_covert01' },
   { name: 'Bo-Katan', id: 'phase03_conflict03_covert02' },
];

function zoneIdToName(zone_id) {
    let name = zone_id;
    for (const [text, alias] of ZoneAliases) {
        name = name.replace(new RegExp(text, 'g'), alias);
    }
    return name;
}

function getPlayers(data) {
    const players = {};
    if (data && data.member) {
        for (const member of data.member) {
            players[member.playerId] = member;
        }
    }
    return players;
}

function sortAndRender() {
    const { key, direction } = state.sort;
    const sortedData = [...state.playerData];

    const isNumeric = (k) => k === 'rank' || k === 'totalWaves' || k === 'totalWaves2plus' || k.startsWith('waves-');

    sortedData.sort((a, b) => {
        let valA, valB;

        if (key.startsWith('waves-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].waves;
            valB = b.phases[phase].waves;
        } else if (key.startsWith('sm-')) {
            const missionName = key.substring(3);
            valA = a.specialMissions[missionName];
            valB = b.specialMissions[missionName];
        } else {
            valA = a[key];
            valB = b[key];
        }

        let result;
        if (isNumeric(key)) {
            result = valA - valB;
        } else {
            result = String(valA).localeCompare(String(valB));
        }

        return direction === 'asc' ? result : -result;
    });

    // Assign ranks after sorting
    sortedData.forEach((p, index) => {
        p.rank = index + 1;
    });

    renderDashboard(sortedData, state.guildActivePhases);
}

function processData(data) {
    const players = getPlayers(data);
    const playerData = {};

    // Initialize player data structure
    for (const pId in players) {
        playerData[pId] = {
            playerName: players[pId].playerName,
            phases: {},
            specialMissions: {},
            totalWaves: 0,
            totalWaves2plus: 0
        };
        for (let i = 1; i <= 6; i++) {
            playerData[pId].phases[i] = { waves: 0 };
        }
        for (const mission of SpecialMissions) {
            playerData[pId].specialMissions[mission.name] = '-';
        }
    }

    if (!data.currentStat) {
        console.error("data.currentStat is not found");
        return;
    }

    const guildActivePhases = new Set();

    // Process wave stats
    for (const stats of data.currentStat) {
        if (!stats.playerStat) {
            continue;
        }
        const statName = zoneIdToName(stats.mapStatId);
        const match = statName.match(/strike_encounter_round_(\d+)/);
        if (match) {
            const phase = parseInt(match[1], 10);
            if (stats.playerStat.length > 0) {
                guildActivePhases.add(phase);
            }
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId] && playerData[pId].phases[phase]) {
                    playerData[pId].phases[phase].waves = parseInt(playerStat.score, 10);
                }
            }
        }
    }

    // Process special missions
    for (const mission of SpecialMissions) {
        const suffix = '_tb3_mixed_' + mission.id;
        const attemptedMissionStatId = "covert_round_attempted_mission" + suffix;
        const completedMissionStatId = "covert_complete_mission" + suffix;

        const attemptedMissionStats = data.currentStat.find(s => s.mapStatId === attemptedMissionStatId);
        const completedMissionStats = data.currentStat.find(s => s.mapStatId === completedMissionStatId);

        const attemptedPlayers = new Set(attemptedMissionStats ? attemptedMissionStats.playerStat.map(p => p.memberId) : []);
        const completedPlayers = new Set(completedMissionStats ? completedMissionStats.playerStat.map(p => p.memberId) : []);

        for (const pId in playerData) {
            if (playerData[pId]) {
                if (completedPlayers.has(pId)) {
                    playerData[pId].specialMissions[mission.name] = 'win';
                } else if (attemptedPlayers.has(pId)) {
                    playerData[pId].specialMissions[mission.name] = 'fail';
                } else {
                    playerData[pId].specialMissions[mission.name] = '-';
                }
            }
        }
    }

    state.playerData = Object.values(playerData);
    state.guildActivePhases = guildActivePhases;

    for (const p of state.playerData) {
        let grandTotal = 0;
        let grandTotal2plus = 0;
        for (let i = 1; i <= 6; i++) {
            const phaseData = p.phases[i];
            grandTotal += phaseData.waves;
            if (i >= 2) {
                grandTotal2plus += phaseData.waves;
            }
        }
        p.totalWaves = grandTotal;
        p.totalWaves2plus = grandTotal2plus;
    }

    // Calculate normalized total waves using the global active phase count
    const activePhasesCount = Math.max(state.guildActivePhases.size, 1);
    const activePhases2plusCount = Math.max([...state.guildActivePhases].filter(p => p >= 2).length, 1);

    for (const p of state.playerData) {
        p.normalizedTotalWaves = p.totalWaves / activePhasesCount;
        p.normalizedTotalWaves2plus = p.totalWaves2plus / activePhases2plusCount;
    }

    sortAndRender();
}

function getWaveCountGroupClass(waves_count) {
    if (waves_count === 0) {
        return 'waves-group0';
    } else if (waves_count > 0 && waves_count < 5) {
        return 'waves-group1';
    } else if (waves_count >= 5 && waves_count < 10) {
        return 'waves-group2';
    } else if (waves_count >= 10 && waves_count < 15) {
        return 'waves-group3';
    } else if (waves_count >= 15) {
        return 'waves-group4';
    }
    return '';
}

function renderDashboard(playerData, guildActivePhases) {
    const dashboard = document.getElementById('dashboard');
    let html = '<table>';

    // Header
    html += '<thead><tr>';
    html += '<th rowspan="2" data-sort="rank">#</th>';
    html += '<th rowspan="2" data-sort="playerName">Player</th>';
    html += '<th rowspan="2" data-sort="totalWaves">Total Waves</th>';
    html += '<th rowspan="2" data-sort="totalWaves2plus">Total Waves 2+</th>';
    for (let i = 1; i <= 6; i++) {
        html += `<th>Phase ${i}</th>`;
    }
    html += `<th colspan="${SpecialMissions.length}">Special Missions</th>`;
    html += '</tr><tr>';
    for (let i = 1; i <= 6; i++) {
        html += `<th data-sort="waves-${i}">Waves</th>`;
    }
    for (const mission of SpecialMissions) {
        html += `<th data-sort="sm-${mission.name}">${mission.name}</th>`;
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';

    // Calculate and render Totals row first
    const totals = {
        totalWaves: 0,
        totalWaves2plus: 0,
        phases: {},
        specialMissions: {}
    };
    for (let i = 1; i <= 6; i++) {
        totals.phases[i] = { waves: 0 };
    }
    for (const mission of SpecialMissions) {
        totals.specialMissions[mission.name] = { win: 0, fail: 0 };
    }

    for (const p of playerData) {
        totals.totalWaves += p.totalWaves;
        totals.totalWaves2plus += p.totalWaves2plus;
        for (let i = 1; i <= 6; i++) {
            totals.phases[i].waves += p.phases[i].waves;
        }
        for (const mission of SpecialMissions) {
            const sm_status = p.specialMissions[mission.name];
            if (sm_status === 'win') totals.specialMissions[mission.name].win++;
            if (sm_status === 'fail') totals.specialMissions[mission.name].fail++;
        }
    }

    html += '<tr>';
    html += '<td><b>0</b></td>';
    html += '<td><b>Totals</b></td>';

    const playersCount = Math.max(playerData.length, 1);
    const activePhasesCount = Math.max(guildActivePhases.size, 1);
    const activePhases2plusCount = Math.max([...guildActivePhases].filter(p => p >= 2).length, 1);

    const normalizedFooterTotal = totals.totalWaves / (activePhasesCount * playersCount);
    const footer_total_class = getWaveCountGroupClass(normalizedFooterTotal);
    html += `<td class="${footer_total_class}"><b>${totals.totalWaves}</b></td>`;

    const normalizedFooterTotal2plus = totals.totalWaves2plus / (activePhases2plusCount * playersCount);
    const footer_total_2plus_class = getWaveCountGroupClass(normalizedFooterTotal2plus);
    html += `<td class="${footer_total_2plus_class}"><b>${totals.totalWaves2plus}</b></td>`;

    for (let i = 1; i <= 6; i++) {
        if (guildActivePhases.has(i)) {
            const phase = totals.phases[i];
            const total_class = getWaveCountGroupClass(phase.waves / playersCount);
            html += `<td class="${total_class}"><b>${phase.waves}</b></td>`;
        } else {
            html += `<td>-</td>`;
        }
    }
    for (const mission of SpecialMissions) {
        const sm_total = totals.specialMissions[mission.name];
        html += `<td>${sm_total.win} W / ${sm_total.fail} F</td>`;
    }
    html += '</tr>';

    // Render player rows
    for (const p of playerData) {
        html += '<tr>';
        html += `<td>${p.rank}</td>`;
        html += `<td>${p.playerName}</td>`;

        const total_waves_class = getWaveCountGroupClass(p.normalizedTotalWaves);
        html += `<td class="${total_waves_class}"><b>${p.totalWaves}</b></td>`;

        const total_waves_2plus_class = getWaveCountGroupClass(p.normalizedTotalWaves2plus);
        html += `<td class="${total_waves_2plus_class}"><b>${p.totalWaves2plus}</b></td>`;

        for (let i = 1; i <= 6; i++) {
            if (guildActivePhases.has(i)) {
                const phase = p.phases[i];
                let total_class = getWaveCountGroupClass(phase.waves);
                html += `<td class="${total_class}"><b>${phase.waves}</b></td>`;
            } else {
                html += `<td>-</td>`;
            }
        }

        for (const mission of SpecialMissions) {
            const sm_status = p.specialMissions[mission.name];
            let sm_class = '';
            if (sm_status === 'win') {
                sm_class = 'sm-win';
            } else if (sm_status === 'fail') {
                sm_class = 'sm-fail';
            } else {
                sm_class = 'sm-not-attempted';
            }
            html += `<td class="${sm_class}">${sm_status}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';

    dashboard.innerHTML = html;

    dashboard.querySelectorAll('th[data-sort]').forEach(th => {
        const sortKey = th.dataset.sort;
        if (sortKey === state.sort.key) {
            th.classList.add('sort-active');
            if (state.sort.direction === 'asc') {
                th.innerHTML += ' &uarr;';
            } else {
                th.innerHTML += ' &darr;';
            }
        }

        th.addEventListener('click', () => {
            const newSortKey = th.dataset.sort;
            if (state.sort.key === newSortKey) {
                state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                state.sort.key = newSortKey;
                const isNumeric = (k) => k === 'totalWaves' || k === 'totalWaves2plus' || k.startsWith('waves-');
                state.sort.direction = isNumeric(newSortKey) ? 'desc' : 'asc';
            }
            sortAndRender();
        });
    });

    setupHighlightEventListeners();
}

function setupHighlightEventListeners() {
    const table = document.querySelector('#dashboard table');
    if (!table) return;

    const headerRows = table.querySelectorAll('thead tr');
    const tBody = table.querySelector('tbody');

    tBody.addEventListener('mouseover', (e) => {
        if (e.target.tagName !== 'TD') return;

        // Clear previous highlights first
        const currentlyHighlighted = table.querySelectorAll('.highlight, .highlight-header');
        currentlyHighlighted.forEach(el => el.classList.remove('highlight', 'highlight-header'));

        const cell = e.target;
        const row = cell.parentElement;
        const cellIndex = cell.cellIndex;
        const rowIndex = row.rowIndex - headerRows.length; // 0 for totals row

        const baseColumnCount = 4;
        // If hovering over player name or total waves, stop here
        if (cellIndex < baseColumnCount) {
            const titleCell = headerRows[0].cells[cellIndex];
            if (titleCell) {
                titleCell.classList.add('highlight-header');
            }
            return;
        }

        // Highlight current column title (light blue)
        const columnTitleCell = headerRows[1].cells[cellIndex - baseColumnCount];
        if (columnTitleCell) {
            columnTitleCell.classList.add('highlight-header');
        }

        const phaseStartIndex = baseColumnCount;
        const numPhaseCols = 6;
        const smStartIndex = phaseStartIndex + numPhaseCols;
        const numSmCols = SpecialMissions.length;

        let primaryTitleCell;
        if (cellIndex >= phaseStartIndex && cellIndex < smStartIndex) { // Phase columns
            primaryTitleCell = headerRows[0].cells[cellIndex];
        } else if (cellIndex >= smStartIndex && cellIndex < smStartIndex + numSmCols) { // SM columns
            primaryTitleCell = headerRows[0].cells[smStartIndex];
        }

        if (primaryTitleCell) {
            primaryTitleCell.classList.add('highlight-header');
        }
    });

    tBody.addEventListener('mouseleave', () => {
        // When the mouse leaves the table body, clear all highlights
        const highlighted = table.querySelectorAll('.highlight-header');
        highlighted.forEach(el => el.classList.remove('highlight-header'));
    });
}

async function loadDefaultData() {
    try {
        const defaultFilePath = './default_data.json';
        const response = await fetch(defaultFilePath);
        if (response.ok) {
            const data = await response.json();
            processData(data);
        } else {
            console.log("No default data file found or failed to load.");
        }
    } catch (error) {
        console.error("Error loading default data:", error);
    }
}

document.addEventListener('DOMContentLoaded', loadDefaultData);

document.getElementById('file-input').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                processData(data);
            } catch (error) {
                alert('Error parsing JSON file.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }
});
