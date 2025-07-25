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

function zone_id_to_name(zone_id) {
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

    const isNumeric = (k) => k === 'totalWaves' || k.startsWith('waves-');

    sortedData.sort((a, b) => {
        let valA, valB;

        if (key.startsWith('waves-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].waves;
            valB = b.phases[phase].waves;
        } else if (key.startsWith('special-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].sm;
            valB = b.phases[phase].sm;
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
            totalWaves: 0
        };
        for (let i = 1; i <= 6; i++) {
            playerData[pId].phases[i] = { waves: 0, sm: '-' };
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
        const statName = zone_id_to_name(stats.mapStatId);
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
    const attemptedMissions = data.currentStat.filter(s => s.mapStatId.startsWith("covert_round_attempted_mission"));
    for (const roundStats of attemptedMissions) {
        const completeStatId = roundStats.mapStatId.replace('covert_round_attempted_mission', 'covert_complete_mission');
        const completeStats = data.currentStat.find(s => s.mapStatId === completeStatId);
        if (!completeStats) continue;

        const statName = zone_id_to_name(completeStats.mapStatId);
        const match = statName.match(/p(\d+).*_sm\d/);
        if (match) {
            const phase = parseInt(match[1], 10);
            const attemptedPlayers = new Set(roundStats.playerStat.map(p => p.memberId));
            const completedPlayers = new Set(completeStats.playerStat.map(p => p.memberId));

            for (const pId in playerData) {
                if (playerData[pId] && playerData[pId].phases[phase]) {
                    if (completedPlayers.has(pId)) {
                        playerData[pId].phases[phase].sm = 'win';
                    } else if (attemptedPlayers.has(pId)) {
                        playerData[pId].phases[phase].sm = 'fail';
                    }
                }
            }
        }
    }

    // Calculate totals
    state.playerData = Object.values(playerData);
    state.guildActivePhases = guildActivePhases;

    for (const p of state.playerData) {
        let grandTotal = 0;
        for (let i = 1; i <= 6; i++) {
            const phaseData = p.phases[i];
            grandTotal += phaseData.waves;
        }
        p.totalWaves = grandTotal;
    }

    // Calculate normalized total waves using the global active phase count
    for (const p of state.playerData) {
        p.normalizedTotalWaves = p.totalWaves / Math.max(state.guildActivePhases.size, 1);
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
    html += '<th rowspan="2" data-sort="playerName">Player</th>';
    html += '<th rowspan="2" data-sort="totalWaves">Total Waves</th>';
    for (let i = 1; i <= 6; i++) {
        html += `<th colspan="2">Phase ${i}</th>`;
    }
    html += '</tr><tr>';
    for (let i = 1; i <= 6; i++) {
        html += `<th data-sort="waves-${i}">Waves</th>`;
        html += `<th data-sort="special-${i}">Special</th>`;
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';

    // Calculate and render Totals row first
    const totals = {
        totalWaves: 0,
        phases: {}
    };
    for (let i = 1; i <= 6; i++) {
        totals.phases[i] = { waves: 0, win: 0, fail: 0 };
    }

    for (const p of playerData) {
        totals.totalWaves += p.totalWaves;
        for (let i = 1; i <= 6; i++) {
            const playerPhase = p.phases[i];
            const totalPhase = totals.phases[i];
            totalPhase.waves += playerPhase.waves;
            if (playerPhase.sm === 'win') totalPhase.win++;
            if (playerPhase.sm === 'fail') totalPhase.fail++;
        }
    }

    html += '<tr>';
    html += '<td><b>Totals</b></td>';

    const playersCount = Math.max(playerData.length, 1);
    const normalizedFooterTotal = totals.totalWaves / (Math.max(guildActivePhases.size, 1) * playersCount);
    const footer_total_class = getWaveCountGroupClass(normalizedFooterTotal);
    html += `<td class="${footer_total_class}"><b>${totals.totalWaves}</b></td>`;

    for (let i = 1; i <= 6; i++) {
        if (guildActivePhases.has(i)) {
            const phase = totals.phases[i];
            const total_class = getWaveCountGroupClass(phase.waves/playersCount);
            html += `<td class="${total_class}"><b>${phase.waves}</b></td>`;
            html += `<td>${phase.win} W / ${phase.fail} F</td>`;
        } else {
            html += `<td>-</td><td>-</td>`;
        }
    }
    html += '</tr>';

    // Render player rows
    for (const p of playerData) {
        html += '<tr>';
        html += `<td>${p.playerName}</td>`;

        const total_waves_class = getWaveCountGroupClass(p.normalizedTotalWaves);
        html += `<td class="${total_waves_class}"><b>${p.totalWaves}</b></td>`;

        for (let i = 1; i <= 6; i++) {
            if (guildActivePhases.has(i)) {
                const phase = p.phases[i];

                let total_class = getWaveCountGroupClass(phase.waves);
                html += `<td class="${total_class}"><b>${phase.waves}</b></td>`;

                let sm_class = '';
                if (phase.sm === 'win') {
                    sm_class = 'sm-win';
                } else if (phase.sm === 'fail') {
                    sm_class = 'sm-fail';
                } else {
                    sm_class = 'sm-not-attempted';
                }
                html += `<td class="${sm_class}">${phase.sm}</td>`;
            } else {
                // Inactive phase, render placeholders
                html += `<td>-</td>`;
                html += `<td>-</td>`;
            }
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
                const isNumeric = (k) => k === 'totalWaves' || k.startsWith('waves-');
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

        // If hovering over player name or total waves, stop here
        if (cellIndex <= 1) {
            const titleCell = headerRows[0].cells[cellIndex];
            if (titleCell) {
                titleCell.classList.add('highlight-header');
            }
            return;
        }

        // Highlight current column title (light blue)
        const columnTitleCell = headerRows[1].cells[cellIndex - 2];
        if (columnTitleCell) {
            columnTitleCell.classList.add('highlight-header');
        }

        // Highlight phase title (light blue)
        const phaseColumns = 2; // Total, SM
        const phaseHeaderIndex = Math.floor((cellIndex - 2) / phaseColumns) + 2;
        const phaseTitleCell = headerRows[0].cells[phaseHeaderIndex];
        if (phaseTitleCell) {
            phaseTitleCell.classList.add('highlight-header');
        }
    });

    tBody.addEventListener('mouseleave', () => {
        // When the mouse leaves the table body, clear all highlights
        const highlighted = table.querySelectorAll('.highlight-header');
        highlighted.forEach(el => el.classList.remove('highlight-header'));
    });
}

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
