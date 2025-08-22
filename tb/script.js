let state = {
    playerData: [],
    guildActivePhases: new Set(),
    visiblePhases: new Set(),
    guildName: '',
    guildGalacticPower: 0,
    sort: {
        key: 'totalWaves',
        direction: 'desc'
    },
    selectedPlayerId: null,
    showGP: false,
    showUnits: false,
    showScore: false,
    showMissionsScore: true,
    showSpecialMissions: true,
    showDeployed: false,
    showUndeployed: false,
    showWaves: false,
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

function isNumericKey(key) {
    return (
        key === 'rank' ||
        key === 'galacticPower' ||
        key === 'totalWaves' ||
        key === 'totalUnits' ||
        key === 'totalScore' ||
        key === 'totalMissionsScore' ||
        key === 'totalDeployed' ||
        key === 'totalUndeployed' ||
        key.startsWith('waves-') ||
        key.startsWith('units-') ||
        key.startsWith('score-') ||
        key.startsWith('missionsScore-') ||
        key.startsWith('deployed-') ||
        key.startsWith('undeployed-')
    );
}

function sortAndRender() {
    const { key, direction } = state.sort;
    const sortedData = [...state.playerData];

    sortedData.sort((a, b) => {
        let valA, valB;

        if (key.startsWith('waves-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].waves;
            valB = b.phases[phase].waves;
        } else if (key.startsWith('units-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].units;
            valB = b.phases[phase].units;
        } else if (key.startsWith('score-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].score;
            valB = b.phases[phase].score;
        } else if (key.startsWith('missionsScore-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].missionsScore;
            valB = b.phases[phase].missionsScore;
        } else if (key.startsWith('deployed-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].deployed;
            valB = b.phases[phase].deployed;
        } else if (key.startsWith('undeployed-')) {
            const phase = key.split('-')[1];
            valA = a.phases[phase].undeployed;
            valB = b.phases[phase].undeployed;
        } else if (key.startsWith('sm-')) {
            const missionName = key.substring(3);
            valA = a.specialMissions[missionName];
            valB = b.specialMissions[missionName];
        } else {
            valA = a[key];
            valB = b[key];
        }

        let result;
        if (isNumericKey(key)) {
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
    if (data.profile && data.profile.name) {
        state.guildName = data.profile.name;
        document.title = `Territory Battle - ${state.guildName}`;
        let titleText = `Territory Battle - ${state.guildName}`;
        if (data.profile.guildGalacticPower) {
            state.guildGalacticPower = parseInt(data.profile.guildGalacticPower, 10) / 1000000;
            titleText += ` (${state.guildGalacticPower.toFixed(1)}M GP)`;
        }
        document.querySelector('h1').textContent = titleText;
    }

    const players = getPlayers(data);
    const playerData = {};

    // Initialize player data structure
    for (const pId in players) {
        playerData[pId] = {
            playerId: pId,
            playerName: players[pId].playerName,
            galacticPower: parseInt(players[pId].galacticPower, 10) / 1000000,
            phases: {},
            specialMissions: {},
            totalWaves: 0,
            totalUnits: 0,
            totalScore: 0,
            totalDeployed: 0,
            totalUndeployed: 0,
            totalMissionsScore: 0
        };
        for (let i = 1; i <= 6; i++) {
            playerData[pId].phases[i] = { waves: 0, units: 0, score: 0, deployed: 0, undeployed: 0, missionsScore: 0 };
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

    // Process unit stats
    for (const stats of data.currentStat) {
        if (!stats.playerStat) {
            continue;
        }
        const match = stats.mapStatId.match(/unit_donated_round_(\d+)/);
        if (match) {
            const phase = parseInt(match[1], 10);
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId] && playerData[pId].phases[phase]) {
                    playerData[pId].phases[phase].units = parseInt(playerStat.score, 10);
                }
            }
        }

        if (stats.mapStatId === 'unit_donated') {
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId]) {
                    playerData[pId].totalUnits = parseInt(playerStat.score, 10);
                }
            }
        }
    }

    // Process score stats
    for (const stats of data.currentStat) {
        if (!stats.playerStat) {
            continue;
        }
        const match = stats.mapStatId.match(/summary_round_(\d+)/);
        if (match) {
            const phase = parseInt(match[1], 10);
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId] && playerData[pId].phases[phase]) {
                    playerData[pId].phases[phase].score = parseInt(playerStat.score, 10) / 1000000;
                }
            }
        }

        if (stats.mapStatId === 'summary') {
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId]) {
                    playerData[pId].totalScore = parseInt(playerStat.score, 10) / 1000000;
                }
            }
        }
    }

    // Process deployed power stats
    for (const stats of data.currentStat) {
        if (!stats.playerStat) {
            continue;
        }
        const match = stats.mapStatId.match(/power_round_(\d+)/);
        if (match) {
            const phase = parseInt(match[1], 10);
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId] && playerData[pId].phases[phase]) {
                    playerData[pId].phases[phase].deployed = parseInt(playerStat.score, 10) / 1000000;
                }
            }
        }

        if (stats.mapStatId === 'power') {
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId]) {
                    playerData[pId].totalDeployed = parseInt(playerStat.score, 10) / 1000000;
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
    state.visiblePhases = new Set(guildActivePhases);

    setupPhaseCheckboxes();
    recalculatePlayerTotals();
    sortAndRender();
}

function recalculatePlayerTotals() {
    const visiblePhasesCount = Math.max(state.visiblePhases.size, 1);
    for (const p of state.playerData) {
        let grandTotal = 0;
        p.totalScore = 0;
        p.totalDeployed = 0;
        p.totalMissionsScore = 0;

        for (let i = 1; i <= 6; i++) {
            const phaseData = p.phases[i];
            if (state.guildActivePhases.has(i)) {
                p.phases[i].undeployed = p.galacticPower - p.phases[i].deployed;
            }
            p.phases[i].missionsScore = p.phases[i].score - p.phases[i].deployed;

            if (state.visiblePhases.has(i)) {
                grandTotal += phaseData.waves;
                p.totalScore += phaseData.score;
                p.totalDeployed += phaseData.deployed;
                p.totalMissionsScore += phaseData.missionsScore;
            }
        }

        p.totalWaves = grandTotal;
        p.totalUndeployed = p.galacticPower * visiblePhasesCount - p.totalDeployed;
        p.totalMissionsScore = p.totalScore - p.totalDeployed;
    }

    // Calculate normalized total waves using the global active phase count
    for (const p of state.playerData) {
        p.normalizedTotalWaves = p.totalWaves / visiblePhasesCount;
        p.normalizedTotalMissionsScore = p.totalMissionsScore / visiblePhasesCount;
    }
}

function setupPhaseCheckboxes() {
    const container = document.getElementById('phase-checkboxes');
    container.innerHTML = '';
    for (let i = 1; i <= 6; i++) {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `phase-${i}-checkbox`;
        checkbox.dataset.phase = i;
        checkbox.checked = state.visiblePhases.has(i);
        checkbox.disabled = !state.guildActivePhases.has(i);

        checkbox.addEventListener('change', (event) => {
            const phase = parseInt(event.target.dataset.phase, 10);
            if (event.target.checked) {
                state.visiblePhases.add(phase);
            } else {
                state.visiblePhases.delete(phase);
            }
            recalculateAndRender();
        });

        label.appendChild(checkbox);
        label.append(` Phase ${i}`);
        label.style.marginRight = '1em';
        container.appendChild(label);
    }
}

function recalculateAndRender() {
    recalculatePlayerTotals();
    sortAndRender();
}

function formatNumber(num) {
    return (num % 1 === 0) ? num : num.toFixed(1);
}

function getWaveCountGroupInfo(waves_count) {
    let className = '';
    let tooltipText = `Waves: ${formatNumber(waves_count)}`;
    if (waves_count === 0) {
        className = 'group-red';
        tooltipText += '\nStatus: Very Poor';
    } else if (waves_count > 0 && waves_count < 5) {
        className = 'group-orange';
        tooltipText += '\nStatus: Poor';
    } else if (waves_count >= 5 && waves_count < 10) {
        className = 'group-yellow';
        tooltipText += '\nStatus: Average';
    } else if (waves_count >= 10 && waves_count < 15) {
        className = 'group-lightgreen';
        tooltipText += '\nStatus: Good';
    } else if (waves_count >= 15) {
        className = 'group-green';
        tooltipText += '\nStatus: Excellent';
    }
    return { className, tooltipText };
}

function getDeployedInfo(deployed, gp) {
    if (gp === 0) return { className: '', tooltipText: '' };
    const ratio = deployed / gp;
    let className = '';
    if (ratio < 0.8) {
        className = 'group-red';
    } else if (ratio < 0.9) {
        className = 'group-orange';
    } else if (ratio < 0.95) {
        className = 'group-yellow';
    } else if (ratio < 0.99) {
        className = 'group-lightgreen';
    } else {
        className = 'group-green';
    }
    const tooltipText = `Deployed: ${deployed.toFixed(1)}M\nTarget (GP): ${gp.toFixed(1)}M\nRatio: ${(ratio * 100).toFixed(1)}%`;
    return { className, tooltipText };
}

function getUndeployedInfo(undeployed, gp) {
    if (gp === 0) return { className: '', tooltipText: '' };
    const ratio = undeployed / gp;
    let className = '';
    if (ratio > 0.20) {
        className = 'group-red';
    } else if (ratio > 0.10) {
        className = 'group-orange';
    } else if (ratio > 0.05) {
        className = 'group-yellow';
    } else if (ratio > 0.01) {
        className = 'group-lightgreen';
    } else {
        className = 'group-green';
    }
    const tooltipText = `Undeployed: ${undeployed.toFixed(1)}M\nGP: ${gp.toFixed(1)}M\nRatio: ${(ratio * 100).toFixed(1)}%`;
    return { className, tooltipText };
}

// Desired mission scores by phase number
const TargetMissionScores = {
    1: 1.0,
    2: 4.0,
    3: 5.5,
    4: 8.3,
    5: 9.9,
    6: 10.2,
};

function getScoreInfo(metricName, score, targetScore) {
    if (!targetScore || targetScore === 0) {
        return { className: '', tooltipText: '' };
    }
    const ratio = score / targetScore;
    let className = '';
    if (ratio >= 0.8) {
        className = 'group-green';
    } else if (ratio >= 0.6) {
        className = 'group-lightgreen';
    } else if (ratio >= 0.4) {
        className = 'group-yellow';
    } else if (ratio >= 0.2) {
        className = 'group-orange';
    } else {
        className = 'group-red';
    }
    const tooltipText = `${metricName}: ${score.toFixed(1)}M\nTarget: ${targetScore.toFixed(1)}M\nRatio: ${(ratio * 100).toFixed(1)}%`;
    return { className, tooltipText };
}

function renderDashboard(playerData, guildActivePhases) {
    const dashboard = document.getElementById('dashboard');
    const { showGP, showUnits, showScore, showMissionsScore, showSpecialMissions, showDeployed, showUndeployed, showWaves } = state;
    const visibleMissions = showSpecialMissions ? SpecialMissions : [];
    const showDataColumns = showUnits || showScore || showMissionsScore || showWaves || showDeployed || showUndeployed;

    let totalTargetMissionScore = 0;
    for (const phase of state.visiblePhases) {
        totalTargetMissionScore += TargetMissionScores[phase] || 0;
    }

    let totalColspan = 0;
    if (showWaves) totalColspan++;
    if (showUnits) totalColspan++;
    if (showScore) totalColspan++;
    if (showMissionsScore) totalColspan++;
    if (showDeployed) totalColspan++;
    if (showUndeployed) totalColspan++;

    let phaseColspan = 0;
    if (showWaves) phaseColspan++;
    if (showUnits) phaseColspan++;
    if (showScore) phaseColspan++;
    if (showMissionsScore) phaseColspan++;
    if (showDeployed) phaseColspan++;
    if (showUndeployed) phaseColspan++;


    let html = '<table>';

    // Header
    html += '<thead><tr>';
    html += '<th rowspan="2" data-sort="rank">#</th>';
    html += '<th rowspan="2" data-sort="playerName">Player</th>';
    if (showGP) {
        html += '<th rowspan="2" data-sort="galacticPower">GP</th>';
    }
    if (showDataColumns) {
        html += `<th colspan="${totalColspan}">Total</th>`;
        for (let i = 1; i <= 6; i++) {
            if (state.visiblePhases.has(i)) {
                html += `<th colspan="${phaseColspan}">Phase ${i}</th>`;
            }
        }
    }
    if (visibleMissions.length > 0) {
        html += `<th colspan="${visibleMissions.length}">Special Missions</th>`;
    }
    html += '</tr><tr>';
    if (showDataColumns) {
        if (showWaves) {
            html += '<th data-sort="totalWaves">Waves</th>';
        }
        if (showUnits) {
            html += '<th data-sort="totalUnits">Units</th>';
        }
        if (showScore) {
            html += '<th data-sort="totalScore">Score</th>';
        }
        if (showMissionsScore) {
            html += '<th data-sort="totalMissionsScore">Missions Score</th>';
        }
        if (showDeployed) {
            html += '<th data-sort="totalDeployed">Deployed</th>';
        }
        if (showUndeployed) {
            html += '<th data-sort="totalUndeployed">Undeployed</th>';
        }
        for (let i = 1; i <= 6; i++) {
            if (state.visiblePhases.has(i)) {
                if (showWaves) {
                    html += `<th data-sort="waves-${i}">Waves</th>`;
                }
                if (showUnits) {
                    html += `<th data-sort="units-${i}">Units</th>`;
                }
                if (showScore) {
                    html += `<th data-sort="score-${i}">Score</th>`;
                }
                if (showMissionsScore) {
                    html += `<th data-sort="missionsScore-${i}">Missions Score</th>`;
                }
                if (showDeployed) {
                    html += `<th data-sort="deployed-${i}">Deployed</th>`;
                }
                if (showUndeployed) {
                    html += `<th data-sort="undeployed-${i}">Undeployed</th>`;
                }
            }
        }
    }
    for (const mission of visibleMissions) {
        html += `<th data-sort="sm-${mission.name}">${mission.name}</th>`;
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';

    // Calculate and render Totals row first
    const totals = {
        totalWaves: 0,
        totalUnits: 0,
        totalScore: 0,
        totalDeployed: 0,
        totalUndeployed: 0,
        totalMissionsScore: 0,
        totalGalacticPower: 0,
        phases: {},
        specialMissions: {}
    };
    for (let i = 1; i <= 6; i++) {
        totals.phases[i] = { waves: 0, units: 0, score: 0, deployed: 0, undeployed: 0, missionsScore: 0 };
    }
    for (const mission of SpecialMissions) {
        totals.specialMissions[mission.name] = { win: 0, fail: 0 };
    }

    for (const p of playerData) {
        totals.totalWaves += p.totalWaves;
        totals.totalUnits += p.totalUnits;
        totals.totalScore += p.totalScore;
        totals.totalDeployed += p.totalDeployed;
        totals.totalUndeployed += p.totalUndeployed;
        totals.totalMissionsScore += p.totalMissionsScore;
        totals.totalGalacticPower += p.galacticPower;
        for (let i = 1; i <= 6; i++) {
            totals.phases[i].waves += p.phases[i].waves;
            totals.phases[i].units += p.phases[i].units;
            totals.phases[i].score += p.phases[i].score;
            totals.phases[i].deployed += p.phases[i].deployed;
            totals.phases[i].undeployed += p.phases[i].undeployed;
            totals.phases[i].missionsScore += p.phases[i].missionsScore;
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
    if (showGP) {
        html += `<td><b>${totals.totalGalacticPower.toFixed(1)}</b></td>`;
    }

    if (showDataColumns) {
        const playersCount = Math.max(playerData.length, 1);
        const visiblePhasesCount = Math.max(state.visiblePhases.size, 1);

        if (showWaves) {
            const normalizedFooterTotal = totals.totalWaves / (visiblePhasesCount * playersCount);
            const waveInfo = getWaveCountGroupInfo(normalizedFooterTotal);
            html += `<td class="${waveInfo.className}" title="${waveInfo.tooltipText}"><b>${totals.totalWaves}</b></td>`;
        }
        if (showUnits) {
            const unitsClass = totals.totalUnits === 0 ? 'group-red' : '';
            html += `<td class="${unitsClass}"><b>${totals.totalUnits}</b></td>`;
        }
        if (showScore) {
            const avgGP = totals.totalGalacticPower / playersCount;
            const avgTargetScore = totalTargetMissionScore + avgGP * visiblePhasesCount;
            const guildTotalTargetScore = avgTargetScore * playersCount;
            const scoreInfo = getScoreInfo('Total Score', totals.totalScore, guildTotalTargetScore);
            html += `<td class="${scoreInfo.className}" title="${scoreInfo.tooltipText}"><b>${totals.totalScore.toFixed(1)}</b></td>`;
        }
        if (showMissionsScore) {
            const guildTotalTargetMissionScore = totalTargetMissionScore * playersCount;
            const missionsScoreInfo = getScoreInfo('Total Missions Score', totals.totalMissionsScore, guildTotalTargetMissionScore);
            html += `<td class="${missionsScoreInfo.className}" title="${missionsScoreInfo.tooltipText}"><b>${totals.totalMissionsScore.toFixed(1)}</b></td>`;
        }
        if (showDeployed) {
            const deployedInfo = getDeployedInfo(totals.totalDeployed, totals.totalGalacticPower * visiblePhasesCount);
            html += `<td class="${deployedInfo.className}" title="${deployedInfo.tooltipText}"><b>${totals.totalDeployed.toFixed(1)}</b></td>`;
        }
        if (showUndeployed) {
            totals.totalUndeployed = totals.totalGalacticPower * visiblePhasesCount - totals.totalDeployed;
            const undeployedInfo = getUndeployedInfo(totals.totalUndeployed, totals.totalGalacticPower * visiblePhasesCount);
            html += `<td class="${undeployedInfo.className}" title="${undeployedInfo.tooltipText}"><b>${totals.totalUndeployed.toFixed(1)}</b></td>`;
        }

        for (let i = 1; i <= 6; i++) {
            if (state.visiblePhases.has(i)) {
                const phase = totals.phases[i];
                if (showWaves) {
                    const waveInfo = getWaveCountGroupInfo(phase.waves / playersCount);
                    html += `<td class="${waveInfo.className}" title="${waveInfo.tooltipText}"><b>${phase.waves}</b></td>`;
                }
                if (showUnits) {
                    const unitsClass = phase.units === 0 ? 'group-red' : '';
                    html += `<td class="${unitsClass}"><b>${phase.units}</b></td>`;
                }
                if (showScore) {
                    const avgGP = totals.totalGalacticPower / playersCount;
                    const targetMissionScoreForPhase = TargetMissionScores[i] || 0;
                    const avgTargetScore = targetMissionScoreForPhase + avgGP;
                    const guildTotalTargetScoreForPhase = avgTargetScore * playersCount;
                    const scoreInfo = getScoreInfo('Total Score', phase.score, guildTotalTargetScoreForPhase);
                    html += `<td class="${scoreInfo.className}" title="${scoreInfo.tooltipText}"><b>${phase.score.toFixed(1)}</b></td>`;
                }
                if (showMissionsScore) {
                    const targetMissionScoreForPhase = TargetMissionScores[i] || 0;
                    const guildTotalTargetMissionScoreForPhase = targetMissionScoreForPhase * playersCount;
                    const missionsScoreInfo = getScoreInfo('Total Missions Score', phase.missionsScore, guildTotalTargetMissionScoreForPhase);
                    html += `<td class="${missionsScoreInfo.className}" title="${missionsScoreInfo.tooltipText}"><b>${phase.missionsScore.toFixed(1)}</b></td>`;
                }
                if (showDeployed) {
                    const deployedInfo = getDeployedInfo(phase.deployed, state.guildGalacticPower);
                    html += `<td class="${deployedInfo.className}" title="${deployedInfo.tooltipText}"><b>${phase.deployed.toFixed(1)}</b></td>`;
                }
                if (showUndeployed) {
                    const undeployedInfo = getUndeployedInfo(phase.undeployed, totals.totalGalacticPower);
                    html += `<td class="${undeployedInfo.className}" title="${undeployedInfo.tooltipText}"><b>${phase.undeployed.toFixed(1)}</b></td>`;
                }
            }
        }
    }
    for (const mission of visibleMissions) {
        const sm_total = totals.specialMissions[mission.name];
        const attempts = sm_total.win + sm_total.fail;
        html += `<td>${sm_total.win}/${attempts}</td>`;
    }
    html += '</tr>';

    // Render player rows
    for (const p of playerData) {
        const isSelected = p.playerId === state.selectedPlayerId;
        html += `<tr class="${isSelected ? 'selected-row' : ''}" data-player-id="${p.playerId}">`;
        html += `<td>${p.rank}</td>`;
        html += `<td class="player-name-cell">${p.playerName}</td>`;
        if (showGP) {
            html += `<td>${p.galacticPower.toFixed(1)}</td>`;
        }

        if (showDataColumns) {
            if (showWaves) {
                const waveInfo = getWaveCountGroupInfo(p.normalizedTotalWaves);
                html += `<td class="${waveInfo.className}" title="${waveInfo.tooltipText}"><b>${p.totalWaves}</b></td>`;
            }
            if (showUnits) {
                const unitsClass = p.totalUnits === 0 ? 'group-red' : '';
                html += `<td class="${unitsClass}"><b>${p.totalUnits}</b></td>`;
            }
            if (showScore) {
                const visiblePhasesCount = Math.max(state.visiblePhases.size, 1);
                const totalTargetScore = totalTargetMissionScore + p.galacticPower * visiblePhasesCount;
                const scoreInfo = getScoreInfo('Score', p.totalScore, totalTargetScore);
                html += `<td class="${scoreInfo.className}" title="${scoreInfo.tooltipText}"><b>${p.totalScore.toFixed(1)}</b></td>`;
            }
            if (showMissionsScore) {
                const missionsScoreInfo = getScoreInfo('Missions Score', p.totalMissionsScore, totalTargetMissionScore);
                html += `<td class="${missionsScoreInfo.className}" title="${missionsScoreInfo.tooltipText}"><b>${p.totalMissionsScore.toFixed(1)}</b></td>`;
            }
            if (showDeployed) {
                const visiblePhasesCount = Math.max(state.visiblePhases.size, 1);
                const deployedInfo = getDeployedInfo(p.totalDeployed, p.galacticPower * visiblePhasesCount);
                html += `<td class="${deployedInfo.className}" title="${deployedInfo.tooltipText}"><b>${p.totalDeployed.toFixed(1)}</b></td>`;
            }
            if (showUndeployed) {
                const visiblePhasesCount = Math.max(state.visiblePhases.size, 1);
                const undeployedInfo = getUndeployedInfo(p.totalUndeployed, p.galacticPower * visiblePhasesCount);
                html += `<td class="${undeployedInfo.className}" title="${undeployedInfo.tooltipText}"><b>${p.totalUndeployed.toFixed(1)}</b></td>`;
            }

            for (let i = 1; i <= 6; i++) {
                if (state.visiblePhases.has(i)) {
                    const phase = p.phases[i];
                    if (showWaves) {
                        const waveInfo = getWaveCountGroupInfo(phase.waves);
                        html += `<td class="${waveInfo.className}" title="${waveInfo.tooltipText}"><b>${phase.waves}</b></td>`;
                    }
                    if (showUnits) {
                        const unitsClass = phase.units === 0 ? 'group-red' : '';
                        html += `<td class="${unitsClass}"><b>${phase.units}</b></td>`;
                    }
                    if (showScore) {
                        const targetMissionScoreForPhase = TargetMissionScores[i] || 0;
                        const targetScore = targetMissionScoreForPhase + p.galacticPower;
                        const scoreInfo = getScoreInfo('Score', phase.score, targetScore);
                        html += `<td class="${scoreInfo.className}" title="${scoreInfo.tooltipText}"><b>${phase.score.toFixed(1)}</b></td>`;
                    }
                    if (showMissionsScore) {
                        const targetScoreForPhase = TargetMissionScores[i] || 0;
                        const missionsScoreInfo = getScoreInfo('Missions Score', phase.missionsScore, targetScoreForPhase);
                        html += `<td class="${missionsScoreInfo.className}" title="${missionsScoreInfo.tooltipText}"><b>${phase.missionsScore.toFixed(1)}</b></td>`;
                    }
                    if (showDeployed) {
                        const deployedInfo = getDeployedInfo(phase.deployed, p.galacticPower);
                        html += `<td class="${deployedInfo.className}" title="${deployedInfo.tooltipText}"><b>${phase.deployed.toFixed(1)}</b></td>`;
                    }
                    if (showUndeployed) {
                        const undeployedInfo = getUndeployedInfo(phase.undeployed, p.galacticPower);
                        html += `<td class="${undeployedInfo.className}" title="${undeployedInfo.tooltipText}"><b>${phase.undeployed.toFixed(1)}</b></td>`;
                    }
                }
            }
        }

        for (const mission of visibleMissions) {
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
                state.sort.direction = isNumericKey(newSortKey) ? 'desc' : 'asc';
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
    const { showGP, showUnits, showScore, showMissionsScore, showSpecialMissions, showDeployed, showUndeployed, showWaves } = state;
    const visibleMissions = showSpecialMissions ? SpecialMissions : [];

    tBody.addEventListener('click', (e) => {
        const cell = e.target.closest('td');
        if (cell && cell.title) {
            showModal(cell.title);
        }

        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow.dataset.playerId) {
            const playerId = targetRow.dataset.playerId;
            if (state.selectedPlayerId === playerId) {
                state.selectedPlayerId = null; // Deselect if clicking the same player
            } else {
                state.selectedPlayerId = playerId;
            }
            sortAndRender();
        }
    });

    tBody.addEventListener('mouseover', (e) => {
        if (e.target.tagName !== 'TD') return;

        // Clear previous highlights first
        const currentlyHighlighted = table.querySelectorAll('.highlight, .highlight-header');
        currentlyHighlighted.forEach(el => el.classList.remove('highlight', 'highlight-header'));

        const cell = e.target;
        const cellIndex = cell.cellIndex;

        // Column definitions
        let baseColumnCount = 2; // #, Player
        if (showGP) baseColumnCount++;

        let totalGroupSize = 0;
        if (showWaves) totalGroupSize++;
        if (showUnits) totalGroupSize++;
        if (showScore) totalGroupSize++;
        if (showMissionsScore) totalGroupSize++;
        if (showDeployed) totalGroupSize++;
        if (showUndeployed) totalGroupSize++;

        let phaseGroupSize = 0;
        if (showWaves) phaseGroupSize++;
        if (showUnits) phaseGroupSize++;
        if (showScore) phaseGroupSize++;
        if (showMissionsScore) phaseGroupSize++;
        if (showDeployed) phaseGroupSize++;
        if (showUndeployed) phaseGroupSize++;

        const numPhaseGroups = 6;

        const totalGroupStartIndex_tbody = baseColumnCount;
        const phaseGroupsStartIndex_tbody = totalGroupStartIndex_tbody + totalGroupSize;
        const smGroupStartIndex_tbody = phaseGroupsStartIndex_tbody + (numPhaseGroups * phaseGroupSize);

        // Highlight secondary title cell (row 2 of thead)
        if (cellIndex >= baseColumnCount) {
            const secondaryTitleCell = headerRows[1].cells[cellIndex - baseColumnCount];
            if (secondaryTitleCell) {
                secondaryTitleCell.classList.add('highlight-header');
            }
        }

        // Highlight primary title cell (row 1 of thead)
        let primaryTitleCell;
        if (cellIndex < baseColumnCount) {
            // # or Player or GP
            primaryTitleCell = headerRows[0].cells[cellIndex];
        } else if (cellIndex >= totalGroupStartIndex_tbody && cellIndex < phaseGroupsStartIndex_tbody) {
            // Total group
            primaryTitleCell = headerRows[0].cells[baseColumnCount];
        } else if (cellIndex >= phaseGroupsStartIndex_tbody && cellIndex < smGroupStartIndex_tbody) {
            // Phase groups
            const phaseGroupIndex = Math.floor((cellIndex - phaseGroupsStartIndex_tbody) / phaseGroupSize);
            primaryTitleCell = headerRows[0].cells[baseColumnCount + 1 + phaseGroupIndex];
        } else {
            // Special Missions group
            const smGroupHeaderIndex = baseColumnCount + 1 + numPhaseGroups;
            primaryTitleCell = headerRows[0].cells[smGroupHeaderIndex];
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

document.addEventListener('DOMContentLoaded', () => {
    loadDefaultData();
    document.getElementById('show-gp-checkbox').addEventListener('change', (event) => {
        state.showGP = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-units-checkbox').addEventListener('change', (event) => {
        state.showUnits = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-score-checkbox').addEventListener('change', (event) => {
        state.showScore = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-missions-score-checkbox').addEventListener('change', (event) => {
        state.showMissionsScore = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-deployed-checkbox').addEventListener('change', (event) => {
        state.showDeployed = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-special-missions-checkbox').addEventListener('change', (event) => {
        state.showSpecialMissions = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-waves-checkbox').addEventListener('change', (event) => {
        state.showWaves = event.target.checked;
        sortAndRender();
    });
    document.getElementById('show-undeployed-checkbox').addEventListener('change', (event) => {
        state.showUndeployed = event.target.checked;
        sortAndRender();
    });

    // Modal setup
    const modal = document.getElementById('cell-info-modal');
    const modalText = document.getElementById('modal-text');
    const closeBtn = modal.querySelector('.close');

    closeBtn.onclick = function() {
        modal.style.display = "none";
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});

function showModal(text) {
    const modal = document.getElementById('cell-info-modal');
    const modalText = document.getElementById('modal-text');
    modalText.textContent = text;
    modal.style.display = 'block';
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
