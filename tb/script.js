let state = {
    playerData: [],
    guildActivePhases: new Set(),
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
    showMissionsScore: false,
    showReva: false,
    showDeployed: false,
    showUndeployed: false,
    showWaves: true
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

    const isNumeric = (k) => k === 'rank' || k === 'galacticPower' || k === 'totalWaves' || k === 'totalWaves2plus' || k === 'totalUnits' || k === 'totalScore' || k === 'totalMissionsScore' || k === 'totalDeployed' || k === 'totalUndeployed' || k.startsWith('waves-') || k.startsWith('units-') || k.startsWith('score-') || k.startsWith('missionsScore-') || k.startsWith('deployed-') || k.startsWith('undeployed-');

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
            totalWaves2plus: 0,
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

    const activePhasesCount = Math.max(state.guildActivePhases.size, 1);
    for (const p of state.playerData) {
        let grandTotal = 0;
        let grandTotal2plus = 0;
        for (let i = 1; i <= 6; i++) {
            const phaseData = p.phases[i];
            grandTotal += phaseData.waves;
            if (i >= 2) {
                grandTotal2plus += phaseData.waves;
            }
            if (state.guildActivePhases.has(i)) {
                p.phases[i].undeployed = p.galacticPower - p.phases[i].deployed;
            }
            p.phases[i].missionsScore = p.phases[i].score - p.phases[i].deployed;
        }
        p.totalWaves = grandTotal;
        p.totalWaves2plus = grandTotal2plus;
        p.totalUndeployed = p.galacticPower * activePhasesCount - p.totalDeployed;
        p.totalMissionsScore = p.totalScore - p.totalDeployed;
    }

    // Calculate normalized total waves using the global active phase count
    const activePhases2plusCount = Math.max([...state.guildActivePhases].filter(p => p >= 2).length, 1);

    for (const p of state.playerData) {
        p.normalizedTotalWaves = p.totalWaves / activePhasesCount;
        p.normalizedTotalWaves2plus = p.totalWaves2plus / activePhases2plusCount;
    }

    sortAndRender();
}

function getWaveCountGroupClass(waves_count) {
    if (waves_count === 0) {
        return 'group-red';
    } else if (waves_count > 0 && waves_count < 5) {
        return 'group-orange';
    } else if (waves_count >= 5 && waves_count < 10) {
        return 'group-yellow';
    } else if (waves_count >= 10 && waves_count < 15) {
        return 'group-lightgreen';
    } else if (waves_count >= 15) {
        return 'group-green';
    }
    return '';
}

function getDeployedColorClass(deployed, gp) {
    if (gp === 0) return ''; // Avoid division by zero
    const ratio = deployed / gp;
    if (ratio < 0.8) {
        return 'group-red'; // red
    } else if (ratio < 0.9) {
        return 'group-orange'; // orange
    } else if (ratio < 0.95) {
        return 'group-yellow'; // yellow
    } else if (ratio < 0.99) {
        return 'group-lightgreen'; // lightgreen
    } else {
        return 'group-green'; // green
    }
}

function getUndeployedColorClass(undeployed, gp) {
    if (gp === 0) return '';
    const ratio = undeployed / gp;
    if (ratio > 0.20) {
        return 'group-red';
    } else if (ratio > 0.10) {
        return 'group-orange';
    } else if (ratio > 0.05) {
        return 'group-yellow';
    } else if (ratio > 0.01) {
        return 'group-lightgreen';
    } else {
        return 'group-green';
    }
}

function renderDashboard(playerData, guildActivePhases) {
    const dashboard = document.getElementById('dashboard');
    const { showGP, showUnits, showScore, showMissionsScore, showReva, showDeployed, showUndeployed, showWaves } = state;
    const visibleMissions = SpecialMissions.filter(m => m.name !== 'Reva' || showReva);
    const showDataColumns = showUnits || showScore || showMissionsScore || showWaves || showDeployed || showUndeployed;

    let totalColspan = 0;
    if (showWaves) totalColspan += 2;
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
            html += `<th colspan="${phaseColspan}">Phase ${i}</th>`;
        }
    }
    html += `<th colspan="${visibleMissions.length}">Special Missions</th>`;
    html += '</tr><tr>';
    if (showDataColumns) {
        if (showWaves) {
            html += '<th data-sort="totalWaves">Waves</th>';
            html += '<th data-sort="totalWaves2plus">Waves 2+</th>';
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
    for (const mission of visibleMissions) {
        html += `<th data-sort="sm-${mission.name}">${mission.name}</th>`;
    }
    html += '</tr></thead>';

    // Body
    html += '<tbody>';

    // Calculate and render Totals row first
    const totals = {
        totalWaves: 0,
        totalWaves2plus: 0,
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
        totals.totalWaves2plus += p.totalWaves2plus;
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
        const activePhasesCount = Math.max(guildActivePhases.size, 1);
        const activePhases2plusCount = Math.max([...guildActivePhases].filter(p => p >= 2).length, 1);

        if (showWaves) {
            const normalizedFooterTotal = totals.totalWaves / (activePhasesCount * playersCount);
            const footer_total_class = getWaveCountGroupClass(normalizedFooterTotal);
            html += `<td class="${footer_total_class}"><b>${totals.totalWaves}</b></td>`;

            const normalizedFooterTotal2plus = totals.totalWaves2plus / (activePhases2plusCount * playersCount);
            const footer_total_2plus_class = getWaveCountGroupClass(normalizedFooterTotal2plus);
            html += `<td class="${footer_total_2plus_class}"><b>${totals.totalWaves2plus}</b></td>`;
        }
        if (showUnits) {
            const unitsClass = totals.totalUnits === 0 ? 'group-red' : '';
            html += `<td class="${unitsClass}"><b>${totals.totalUnits}</b></td>`;
        }
        if (showScore) {
            const scoreClass = totals.totalScore === 0 ? 'group-red' : '';
            html += `<td class="${scoreClass}"><b>${totals.totalScore.toFixed(1)}</b></td>`;
        }
        if (showMissionsScore) {
            const missionsScoreClass = totals.totalMissionsScore <= 0 ? 'group-red' : '';
            html += `<td class="${missionsScoreClass}"><b>${totals.totalMissionsScore.toFixed(1)}</b></td>`;
        }
        if (showDeployed) {
            const deployedClass = getDeployedColorClass(totals.totalDeployed, totals.totalGalacticPower * activePhasesCount);
            html += `<td class="${deployedClass}"><b>${totals.totalDeployed.toFixed(1)}</b></td>`;
        }
        if (showUndeployed) {
            totals.totalUndeployed = totals.totalGalacticPower * activePhasesCount - totals.totalDeployed;
            const undeployedClass = getUndeployedColorClass(totals.totalUndeployed, totals.totalGalacticPower * activePhasesCount);
            html += `<td class="${undeployedClass}"><b>${totals.totalUndeployed.toFixed(1)}</b></td>`;
        }

        for (let i = 1; i <= 6; i++) {
            if (guildActivePhases.has(i)) {
                const phase = totals.phases[i];
                if (showWaves) {
                    const total_class = getWaveCountGroupClass(phase.waves / playersCount);
                    html += `<td class="${total_class}"><b>${phase.waves}</b></td>`;
                }
                if (showUnits) {
                    const unitsClass = phase.units === 0 ? 'group-red' : '';
                    html += `<td class="${unitsClass}"><b>${phase.units}</b></td>`;
                }
                if (showScore) {
                    const scoreClass = phase.score === 0 ? 'group-red' : '';
                    html += `<td class="${scoreClass}"><b>${phase.score.toFixed(1)}</b></td>`;
                }
                if (showMissionsScore) {
                    const missionsScoreClass = phase.missionsScore <= 0 ? 'group-red' : '';
                    html += `<td class="${missionsScoreClass}"><b>${phase.missionsScore.toFixed(1)}</b></td>`;
                }
                if (showDeployed) {
                    const deployedClass = getDeployedColorClass(phase.deployed, state.guildGalacticPower);
                    html += `<td class="${deployedClass}"><b>${phase.deployed.toFixed(1)}</b></td>`;
                }
                if (showUndeployed) {
                    const undeployedClass = getUndeployedColorClass(phase.undeployed, totals.totalGalacticPower);
                    html += `<td class="${undeployedClass}"><b>${phase.undeployed.toFixed(1)}</b></td>`;
                }
            } else {
                let content = '';
                if (showWaves) content += `<td>-</td>`;
                if (showUnits) content += `<td>-</td>`;
                if (showScore) content += `<td>-</td>`;
                if (showMissionsScore) content += `<td>-</td>`;
                if (showDeployed) content += `<td>-</td>`;
                if (showUndeployed) content += `<td>-</td>`;
                html += content;
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
                const total_waves_class = getWaveCountGroupClass(p.normalizedTotalWaves);
                html += `<td class="${total_waves_class}"><b>${p.totalWaves}</b></td>`;

                const total_waves_2plus_class = getWaveCountGroupClass(p.normalizedTotalWaves2plus);
                html += `<td class="${total_waves_2plus_class}"><b>${p.totalWaves2plus}</b></td>`;
            }
            if (showUnits) {
                const unitsClass = p.totalUnits === 0 ? 'group-red' : '';
                html += `<td class="${unitsClass}"><b>${p.totalUnits}</b></td>`;
            }
            if (showScore) {
                const scoreClass = p.totalScore === 0 ? 'group-red' : '';
                html += `<td class="${scoreClass}"><b>${p.totalScore.toFixed(1)}</b></td>`;
            }
            if (showMissionsScore) {
                const missionsScoreClass = p.totalMissionsScore <= 0 ? 'group-red' : '';
                html += `<td class="${missionsScoreClass}"><b>${p.totalMissionsScore.toFixed(1)}</b></td>`;
            }
            if (showDeployed) {
                const activePhasesCount = Math.max(state.guildActivePhases.size, 1);
                const deployedClass = getDeployedColorClass(p.totalDeployed, p.galacticPower * activePhasesCount);
                html += `<td class="${deployedClass}"><b>${p.totalDeployed.toFixed(1)}</b></td>`;
            }
            if (showUndeployed) {
                const activePhasesCount = Math.max(state.guildActivePhases.size, 1);
                const undeployedClass = getUndeployedColorClass(p.totalUndeployed, p.galacticPower * activePhasesCount);
                html += `<td class="${undeployedClass}"><b>${p.totalUndeployed.toFixed(1)}</b></td>`;
            }

            for (let i = 1; i <= 6; i++) {
                if (guildActivePhases.has(i)) {
                    const phase = p.phases[i];
                    if (showWaves) {
                        let total_class = getWaveCountGroupClass(phase.waves);
                        html += `<td class="${total_class}"><b>${phase.waves}</b></td>`;
                    }
                    if (showUnits) {
                        const unitsClass = phase.units === 0 ? 'group-red' : '';
                        html += `<td class="${unitsClass}"><b>${phase.units}</b></td>`;
                    }
                    if (showScore) {
                        const scoreClass = phase.score === 0 ? 'group-red' : '';
                        html += `<td class="${scoreClass}"><b>${phase.score.toFixed(1)}</b></td>`;
                    }
                    if (showMissionsScore) {
                        const missionsScoreClass = phase.missionsScore <= 0 ? 'group-red' : '';
                        html += `<td class="${missionsScoreClass}"><b>${phase.missionsScore.toFixed(1)}</b></td>`;
                    }
                    if (showDeployed) {
                        const deployedClass = getDeployedColorClass(phase.deployed, p.galacticPower);
                        html += `<td class="${deployedClass}"><b>${phase.deployed.toFixed(1)}</b></td>`;
                    }
                    if (showUndeployed) {
                        const undeployedClass = getUndeployedColorClass(phase.undeployed, p.galacticPower);
                        html += `<td class="${undeployedClass}"><b>${phase.undeployed.toFixed(1)}</b></td>`;
                    }
                } else {
                    let content = '';
                    if (showWaves) content += `<td>-</td>`;
                    if (showUnits) content += `<td>-</td>`;
                    if (showScore) content += `<td>-</td>`;
                    if (showMissionsScore) content += `<td>-</td>`;
                    if (showDeployed) content += `<td>-</td>`;
                    if (showUndeployed) content += `<td>-</td>`;
                    html += content;
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
                const isNumeric = (k) => k === 'totalWaves' || k === 'totalWaves2plus' || k.startsWith('waves-') || k.startsWith('units-') || k === 'totalUnits' || k.startsWith('score-') || k === 'totalScore' || k.startsWith('missionsScore-') || k === 'totalMissionsScore' || k.startsWith('deployed-') || k === 'totalDeployed' || k === 'totalUndeployed' || k.startsWith('undeployed-');
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
    const { showGP, showUnits, showScore, showMissionsScore, showReva, showDeployed, showUndeployed, showWaves } = state;
    const visibleMissions = SpecialMissions.filter(m => m.name !== 'Reva' || showReva);

    tBody.addEventListener('click', (e) => {
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
        if (showWaves) totalGroupSize += 2;
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
    document.getElementById('show-reva-checkbox').addEventListener('change', (event) => {
        state.showReva = event.target.checked;
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
});

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
