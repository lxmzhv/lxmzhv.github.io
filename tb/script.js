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
            playerData[pId].phases[i] = { left: 0, middle: 0, right: 0, total: 0, sm: '-', right_bonus: 0, middle_bonus: 0 };
        }
    }

    if (!data.currentStat) {
        console.error("data.currentStat is not found");
        return;
    }

    // Process wave stats
    for (const stats of data.currentStat) {
        if (!stats.playerStat || !stats.mapStatId.startsWith("strike_encounter")) {
            continue;
        }
        const statName = zone_id_to_name(stats.mapStatId);
        const match = statName.match(/p(\d+)_(right_bonus|middle_bonus|left|right|middle)/);
        if (match) {
            const phase = parseInt(match[1], 10);
            const zoneType = match[2];
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId] && playerData[pId].phases[phase]) {
                    playerData[pId].phases[phase][zoneType] = parseInt(playerStat.score, 10);
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

    // Calculate totals and determine globally active phases
    let sortedPlayers = Object.values(playerData);
    const guildActivePhases = new Set();

    for (const p of sortedPlayers) {
        let grandTotal = 0;
        for (let i = 1; i <= 6; i++) {
            const phaseData = p.phases[i];
            phaseData.total = phaseData.left + phaseData.middle + phaseData.right + phaseData.right_bonus + phaseData.middle_bonus;
            grandTotal += phaseData.total;
            if (phaseData.total > 0) {
                guildActivePhases.add(i);
            }
        }
        p.totalWaves = grandTotal;
    }

    // Calculate normalized total waves using the global active phase count
    const globalActivePhasesCount = guildActivePhases.size;
    for (const p of sortedPlayers) {
        p.normalizedTotalWaves = p.totalWaves / globalActivePhasesCount;
    }

    // Sort by total waves
    sortedPlayers.sort((a, b) => b.totalWaves - a.totalWaves);

    renderDashboard(sortedPlayers, guildActivePhases);
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
    html += '<th rowspan="2">Player</th>';
    html += '<th rowspan="2">Total Waves</th>';
    for (let i = 1; i <= 6; i++) {
        html += `<th colspan="2">Phase ${i}</th>`;
    }
    html += '</tr><tr>';
    for (let i = 1; i <= 6; i++) {
        html += '<th>Waves</th>';
        html += '<th>Special</th>';
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
        totals.phases[i] = { left: 0, middle: 0, right: 0, right_bonus: 0, middle_bonus: 0, total: 0, win: 0, fail: 0 };
    }

    for (const p of playerData) {
        totals.totalWaves += p.totalWaves;
        for (let i = 1; i <= 6; i++) {
            const playerPhase = p.phases[i];
            const totalPhase = totals.phases[i];
            totalPhase.left += playerPhase.left;
            totalPhase.middle += playerPhase.middle;
            totalPhase.right += playerPhase.right;
            totalPhase.middle_bonus += playerPhase.middle_bonus;
            totalPhase.right_bonus += playerPhase.right_bonus;
            totalPhase.total += playerPhase.total;
            if (playerPhase.sm === 'win') totalPhase.win++;
            if (playerPhase.sm === 'fail') totalPhase.fail++;
        }
    }

    html += '<tr>';
    html += '<td><b>Totals</b></td>';

    const players_count = Math.max(playerData.length, 1);

    const normalizedFooterTotal = totals.totalWaves / (guildActivePhases.size * players_count);
    const footer_total_class = getWaveCountGroupClass(normalizedFooterTotal);
    html += `<td class="${footer_total_class}"><b>${totals.totalWaves}</b></td>`;

    for (let i = 1; i <= 6; i++) {
        if (guildActivePhases.has(i)) {
            const phase = totals.phases[i];
            const total_class = getWaveCountGroupClass(phase.total/players_count);
            const wave_details = JSON.stringify({
                left: phase.left,
                middle: phase.middle,
                right: phase.right,
                right_bonus: phase.right_bonus,
                middle_bonus: phase.middle_bonus
            });
            let cell_class = total_class;
            if (phase.total > 0) {
                cell_class += ' phase-total-cell';
            }
            html += `<td class="${cell_class}" data-player="Total" data-phase="${i}" data-waves='${wave_details}'><b>${phase.total}</b></td>`;
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

                let total_class = getWaveCountGroupClass(phase.total);
                const wave_details = JSON.stringify({
                    left: phase.left,
                    middle: phase.middle,
                    right: phase.right,
                    right_bonus: phase.right_bonus,
                    middle_bonus: phase.middle_bonus
                });
                let cell_class = total_class;
                if (phase.total > 0) {
                    cell_class += ' phase-total-cell';
                }
                html += `<td class="${cell_class}" data-player="${p.playerName}" data-phase="${i}" data-waves='${wave_details}'><b>${phase.total}</b></td>`;

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
    setupModalEventListeners();
    setupHighlightEventListeners();
}

function setupModalEventListeners() {
    const modal = document.getElementById('wavesModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const span = document.getElementsByClassName("close")[0];

    if (!modal || !modalTitle || !modalBody || !span) {
        console.error("Modal elements not found!");
        return;
    }

    span.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    const cells = document.getElementsByClassName('phase-total-cell');
    for (const cell of cells) {
        cell.onclick = function() {
            const playerName = this.getAttribute('data-player');
            const phase = this.getAttribute('data-phase');
            const waves = JSON.parse(this.getAttribute('data-waves'));

            modalTitle.innerText = `${playerName} - Phase ${phase} Details`;
            modalBody.innerHTML = `
                <p><strong>Left Planet:</strong> ${waves.left} waves</p>
                <p><strong>Middle Planet:</strong> ${waves.middle} waves</p>
                <p><strong>Right Planet:</strong> ${waves.right} waves</p>
                <p><strong>Mandalore:</strong> ${waves.middle_bonus} waves</p>
                <p><strong>Zeffo:</strong> ${waves.right_bonus} waves</p>
            `;
            modal.style.display = "block";
        }
    }
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
