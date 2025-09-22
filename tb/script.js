let state = {
    playerData: [],
    currentData: null,
    baselineData: null,
    isDiffMode: false,
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
    showTotals: true,
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

function formatDiff(value, precision = 1) {
    if (value === 0) return '0';
    const sign = value > 0 ? '+' : '';
    const num = (value % 1 === 0) ? value : value.toFixed(precision);
    return sign + num;
}

function getDiffClass(value) {
    if (value > 0) return 'group-green';
    if (value < 0) return 'group-red';
    return '';
}

function getSmDiff(current, baseline) {
    if (current === baseline) return current;
    if (!baseline || baseline === '-') {
        return `- => ${current}`;
    }
    if (!current || current === '-') {
        return `${baseline} => -`;
    }
    if (current === 'win' && baseline === 'fail') return 'fail => win';
    if (current === 'fail' && baseline === 'win') return 'win => fail';
    return current;
}

function getSmDiffClass(current, baseline) {
    if (current === baseline) return `sm-${current}`;
    if (!baseline || baseline === '-') {
        return current === 'win' ? 'sm-win' : (current === 'fail' ? 'sm-fail' : 'sm-not-attempted');
    }
    if (!current || current === '-') {
        return baseline === 'win' ? 'sm-fail' : 'sm-win';
    }
    if (current === 'win' && baseline === 'fail') return 'sm-win';
    if (current === 'fail' && baseline === 'win') return 'sm-fail';
    return 'sm-not-attempted';
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

    sortedData.forEach((p, index) => {
        p.rank = index + 1;
    });

    renderDashboard(sortedData, state.guildActivePhases);
}

function extractPlayerData(data) {
    let guildName = '';
    let guildGalacticPower = 0;

    if (data.profile && data.profile.name) {
        guildName = data.profile.name;
        if (data.profile.guildGalacticPower) {
            guildGalacticPower = parseInt(data.profile.guildGalacticPower, 10) / 1000000;
        }
    }

    const players = getPlayers(data);
    const playerData = {};

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
        return { playerData: [], guildActivePhases: new Set(), guildName, guildGalacticPower };
    }

    const guildActivePhases = new Set();

    for (const stats of data.currentStat) {
        if (!stats.playerStat) continue;
        const statName = zoneIdToName(stats.mapStatId);
        const match = statName.match(/strike_encounter_round_(\d+)/);
        if (match) {
            const phase = parseInt(match[1], 10);
            if (stats.playerStat.length > 0) guildActivePhases.add(phase);
            for (const playerStat of stats.playerStat) {
                const pId = playerStat.memberId;
                if (playerData[pId] && playerData[pId].phases[phase]) {
                    playerData[pId].phases[phase].waves = parseInt(playerStat.score, 10);
                }
            }
        }
    }

    for (const stats of data.currentStat) {
        if (!stats.playerStat) continue;
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
                if (playerData[pId]) playerData[pId].totalUnits = parseInt(playerStat.score, 10);
            }
        }
    }

    for (const stats of data.currentStat) {
        if (!stats.playerStat) continue;
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
                if (playerData[pId]) playerData[pId].totalScore = parseInt(playerStat.score, 10) / 1000000;
            }
        }
    }

    for (const stats of data.currentStat) {
        if (!stats.playerStat) continue;
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
                if (playerData[pId]) playerData[pId].totalDeployed = parseInt(playerStat.score, 10) / 1000000;
            }
        }
    }

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
                if (completedPlayers.has(pId)) playerData[pId].specialMissions[mission.name] = 'win';
                else if (attemptedPlayers.has(pId)) playerData[pId].specialMissions[mission.name] = 'fail';
                else playerData[pId].specialMissions[mission.name] = '-';
            }
        }
    }

    return { playerData: Object.values(playerData), guildActivePhases, guildName, guildGalacticPower };
}

function processSingleData(data) {
    state.isDiffMode = false;
    const { playerData, guildActivePhases, guildName, guildGalacticPower } = extractPlayerData(data);
    
    state.guildName = guildName;
    state.guildGalacticPower = guildGalacticPower;
    document.title = `Territory Battle - ${state.guildName}`;
    let titleText = `Territory Battle - ${state.guildName}`;
    if (state.guildGalacticPower) {
        titleText += ` (${state.guildGalacticPower.toFixed(1)}M GP)`;
    }
    document.querySelector('h1').textContent = titleText;

    state.playerData = playerData;
    state.guildActivePhases = guildActivePhases;
    state.visiblePhases = new Set(guildActivePhases);

    setupPhaseCheckboxes();
    recalculatePlayerTotals();
    sortAndRender();
}

function processDiffData(currentData, baselineData) {
    state.isDiffMode = true;
    const current = extractPlayerData(currentData);
    recalculatePlayerTotals(current.playerData, current.guildActivePhases, new Set(current.guildActivePhases));
    
    const baseline = extractPlayerData(baselineData);
    recalculatePlayerTotals(baseline.playerData, baseline.guildActivePhases, new Set(baseline.guildActivePhases));

    state.guildName = current.guildName;
    state.guildGalacticPower = current.guildGalacticPower;
    document.title = `Territory Battle Diff - ${state.guildName}`;
    let titleText = `TB Diff - ${state.guildName}`;
    if (state.guildGalacticPower) {
        titleText += ` (${state.guildGalacticPower.toFixed(1)}M GP)`;
    }
    document.querySelector('h1').textContent = titleText;

    const allPhases = new Set([...current.guildActivePhases, ...baseline.guildActivePhases]);
    state.guildActivePhases = allPhases;
    state.visiblePhases = new Set(allPhases);

    const baselinePlayers = new Map(baseline.playerData.map(p => [p.playerId, p]));
    const currentPlayers = new Map(current.playerData.map(p => [p.playerId, p]));
    const allPlayerIds = new Set([...currentPlayers.keys(), ...baselinePlayers.keys()]);
    
    const diffPlayerData = [];

    const zeroPlayer = {
        galacticPower: 0, phases: {}, specialMissions: {}, totalWaves: 0, totalUnits: 0, totalScore: 0,
        totalDeployed: 0, totalUndeployed: 0, totalMissionsScore: 0, playerName: ''
    };
    for (let i = 1; i <= 6; i++) {
        zeroPlayer.phases[i] = { waves: 0, units: 0, score: 0, deployed: 0, undeployed: 0, missionsScore: 0 };
    }
    for (const mission of SpecialMissions) {
        zeroPlayer.specialMissions[mission.name] = '-';
    }

    for (const pId of allPlayerIds) {
        const currentP = currentPlayers.get(pId) || { ...zeroPlayer, playerId: pId, playerName: baselinePlayers.get(pId)?.playerName || 'Unknown' };
        const baselineP = baselinePlayers.get(pId) || { ...zeroPlayer, playerId: pId, playerName: currentP.playerName };

        const diffP = {
            playerId: pId,
            playerName: currentP.playerName,
            galacticPower: currentP.galacticPower - baselineP.galacticPower,
            phases: {},
            specialMissions: {},
            baseline: baselineP,
            current: currentP
        };

        diffP.totalWaves = currentP.totalWaves - baselineP.totalWaves;
        diffP.totalUnits = currentP.totalUnits - baselineP.totalUnits;
        diffP.totalScore = currentP.totalScore - baselineP.totalScore;
        diffP.totalDeployed = currentP.totalDeployed - baselineP.totalDeployed;
        diffP.totalUndeployed = currentP.totalUndeployed - baselineP.totalUndeployed;
        diffP.totalMissionsScore = currentP.totalMissionsScore - baselineP.totalMissionsScore;

        for (let i = 1; i <= 6; i++) {
            diffP.phases[i] = {
                waves: currentP.phases[i].waves - baselineP.phases[i].waves,
                units: currentP.phases[i].units - baselineP.phases[i].units,
                score: currentP.phases[i].score - baselineP.phases[i].score,
                deployed: currentP.phases[i].deployed - baselineP.phases[i].deployed,
                undeployed: currentP.phases[i].undeployed - baselineP.phases[i].undeployed,
                missionsScore: currentP.phases[i].missionsScore - baselineP.phases[i].missionsScore,
            };
        }

        for (const mission of SpecialMissions) {
            diffP.specialMissions[mission.name] = getSmDiff(currentP.specialMissions[mission.name], baselineP.specialMissions[mission.name]);
        }
        diffPlayerData.push(diffP);
    }

    state.playerData = diffPlayerData;
    setupPhaseCheckboxes();
    sortAndRender();
}


function recalculatePlayerTotals(playerData = state.playerData, guildActivePhases = state.guildActivePhases, visiblePhases = state.visiblePhases) {
    const visiblePhasesCount = Math.max(visiblePhases.size, 1);
    for (const p of playerData) {
        let grandTotal = 0;
        p.totalScore = 0;
        p.totalDeployed = 0;
        p.totalMissionsScore = 0;

        for (let i = 1; i <= 6; i++) {
            const phaseData = p.phases[i];
            if (guildActivePhases.has(i)) {
                p.phases[i].undeployed = p.galacticPower - p.phases[i].deployed;
            }
            p.phases[i].missionsScore = p.phases[i].score - p.phases[i].deployed;

            if (visiblePhases.has(i)) {
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

    for (const p of playerData) {
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
    if (!state.isDiffMode) {
        recalculatePlayerTotals();
    } else {
        for (const p of state.playerData) {
            recalculatePlayerTotals([p.current], state.guildActivePhases, state.visiblePhases);
            recalculatePlayerTotals([p.baseline], state.guildActivePhases, state.visiblePhases);

            p.totalWaves = p.current.totalWaves - p.baseline.totalWaves;
            p.totalScore = p.current.totalScore - p.baseline.totalScore;
            p.totalDeployed = p.current.totalDeployed - p.baseline.totalDeployed;
            p.totalUndeployed = p.current.totalUndeployed - p.baseline.totalUndeployed;
            p.totalMissionsScore = p.current.totalMissionsScore - p.baseline.totalMissionsScore;
        }
    }
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

const TargetMissionScores = {
    1: 1.0,
    2: 4.0,
    3: 5.5,
    4: 8.3,
    5: 9.9,
    6: 10.2,
};

function getScoreInfo(score, metricName, targetScore) {
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
    const { showGP, showUnits, showScore, showMissionsScore, showSpecialMissions, showDeployed, showUndeployed, showWaves, isDiffMode, showTotals } = state;
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

    html += '<thead><tr>';
    html += '<th rowspan="2" data-sort="rank">#</th>';
    html += '<th rowspan="2" data-sort="playerName">Player</th>';
    if (showGP) {
        html += '<th rowspan="2" data-sort="galacticPower">GP</th>';
    }
    if (showDataColumns) {
        if (showTotals) {
            html += `<th colspan="${totalColspan}">Total</th>`;
        }
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
        if (showTotals) {
            if (showWaves) html += '<th data-sort="totalWaves">Waves</th>';
            if (showUnits) html += '<th data-sort="totalUnits">Units</th>';
            if (showScore) html += '<th data-sort="totalScore">Score</th>';
            if (showMissionsScore) html += '<th data-sort="totalMissionsScore">Missions Score</th>';
            if (showDeployed) html += '<th data-sort="totalDeployed">Deployed</th>';
            if (showUndeployed) html += '<th data-sort="totalUndeployed">Undeployed</th>';
        }
        for (let i = 1; i <= 6; i++) {
            if (state.visiblePhases.has(i)) {
                if (showWaves) html += `<th data-sort="waves-${i}">Waves</th>`;
                if (showUnits) html += `<th data-sort="units-${i}">Units</th>`;
                if (showScore) html += `<th data-sort="score-${i}">Score</th>`;
                if (showMissionsScore) html += `<th data-sort="missionsScore-${i}">Missions Score</th>`;
                if (showDeployed) html += `<th data-sort="deployed-${i}">Deployed</th>`;
                if (showUndeployed) html += `<th data-sort="undeployed-${i}">Undeployed</th>`;
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
    if (isDiffMode) {
        const totals = {
            current: { totalGalacticPower: 0, totalWaves: 0, totalUnits: 0, totalScore: 0, totalDeployed: 0, totalUndeployed: 0, totalMissionsScore: 0, phases: {}, specialMissions: {} },
            baseline: { totalGalacticPower: 0, totalWaves: 0, totalUnits: 0, totalScore: 0, totalDeployed: 0, totalUndeployed: 0, totalMissionsScore: 0, phases: {}, specialMissions: {} }
        };

        for (let i = 1; i <= 6; i++) {
            totals.current.phases[i] = { waves: 0, units: 0, score: 0, deployed: 0, undeployed: 0, missionsScore: 0 };
            totals.baseline.phases[i] = { waves: 0, units: 0, score: 0, deployed: 0, undeployed: 0, missionsScore: 0 };
        }
        for (const mission of SpecialMissions) {
            totals.current.specialMissions[mission.name] = { win: 0, fail: 0 };
            totals.baseline.specialMissions[mission.name] = { win: 0, fail: 0 };
        }

        for (const p of playerData) {
            const currentP = p.current;
            const baselineP = p.baseline;

            totals.current.totalGalacticPower += currentP.galacticPower;
            totals.baseline.totalGalacticPower += baselineP.galacticPower;
            totals.current.totalWaves += currentP.totalWaves;
            totals.baseline.totalWaves += baselineP.totalWaves;
            totals.current.totalUnits += currentP.totalUnits;
            totals.baseline.totalUnits += baselineP.totalUnits;
            totals.current.totalScore += currentP.totalScore;
            totals.baseline.totalScore += baselineP.totalScore;
            totals.current.totalDeployed += currentP.totalDeployed;
            totals.baseline.totalDeployed += baselineP.totalDeployed;
            totals.current.totalUndeployed += currentP.totalUndeployed;
            totals.baseline.totalUndeployed += baselineP.totalUndeployed;
            totals.current.totalMissionsScore += currentP.totalMissionsScore;
            totals.baseline.totalMissionsScore += baselineP.totalMissionsScore;

            for (let i = 1; i <= 6; i++) {
                totals.current.phases[i].waves += currentP.phases[i].waves;
                totals.baseline.phases[i].waves += baselineP.phases[i].waves;
                totals.current.phases[i].units += currentP.phases[i].units;
                totals.baseline.phases[i].units += baselineP.phases[i].units;
                totals.current.phases[i].score += currentP.phases[i].score;
                totals.baseline.phases[i].score += baselineP.phases[i].score;
                totals.current.phases[i].deployed += currentP.phases[i].deployed;
                totals.baseline.phases[i].deployed += baselineP.phases[i].deployed;
                totals.current.phases[i].undeployed += currentP.phases[i].undeployed;
                totals.baseline.phases[i].undeployed += baselineP.phases[i].undeployed;
                totals.current.phases[i].missionsScore += currentP.phases[i].missionsScore;
                totals.baseline.phases[i].missionsScore += baselineP.phases[i].missionsScore;
            }

            for (const mission of SpecialMissions) {
                if (currentP.specialMissions[mission.name] === 'win') totals.current.specialMissions[mission.name].win++;
                if (currentP.specialMissions[mission.name] === 'fail') totals.current.specialMissions[mission.name].fail++;
                if (baselineP.specialMissions[mission.name] === 'win') totals.baseline.specialMissions[mission.name].win++;
                if (baselineP.specialMissions[mission.name] === 'fail') totals.baseline.specialMissions[mission.name].fail++;
            }
        }

        html += '<tr>';
        html += '<td><b>0</b></td>';
        html += '<td><b>Totals</b></td>';

        if (showGP) {
            const diff = totals.current.totalGalacticPower - totals.baseline.totalGalacticPower;
            const tooltip = `Current: ${totals.current.totalGalacticPower.toFixed(1)}M\nBaseline: ${totals.baseline.totalGalacticPower.toFixed(1)}M`;
            html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
        }

        if (showDataColumns) {
            if (showTotals) {
                if (showWaves) {
                    const diff = totals.current.totalWaves - totals.baseline.totalWaves;
                    const tooltip = `Current: ${totals.current.totalWaves}\nBaseline: ${totals.baseline.totalWaves}`;
                    html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff, 0)}</b></td>`;
                }
                if (showUnits) {
                    const diff = totals.current.totalUnits - totals.baseline.totalUnits;
                    const tooltip = `Current: ${totals.current.totalUnits}\nBaseline: ${totals.baseline.totalUnits}`;
                    html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff, 0)}</b></td>`;
                }
                if (showScore) {
                    const diff = totals.current.totalScore - totals.baseline.totalScore;
                    const tooltip = `Current: ${totals.current.totalScore.toFixed(1)}M\nBaseline: ${totals.baseline.totalScore.toFixed(1)}M`;
                    html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
                }
                if (showMissionsScore) {
                    const diff = totals.current.totalMissionsScore - totals.baseline.totalMissionsScore;
                    const tooltip = `Current: ${totals.current.totalMissionsScore.toFixed(1)}M\nBaseline: ${totals.baseline.totalMissionsScore.toFixed(1)}M`;
                    html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
                }
                if (showDeployed) {
                    const diff = totals.current.totalDeployed - totals.baseline.totalDeployed;
                    const tooltip = `Current: ${totals.current.totalDeployed.toFixed(1)}M\nBaseline: ${totals.baseline.totalDeployed.toFixed(1)}M`;
                    html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
                }
                if (showUndeployed) {
                    const diff = totals.current.totalUndeployed - totals.baseline.totalUndeployed;
                    const tooltip = `Current: ${totals.current.totalUndeployed.toFixed(1)}M\nBaseline: ${totals.baseline.totalUndeployed.toFixed(1)}M`;
                    html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
                }
            }

            for (let i = 1; i <= 6; i++) {
                if (state.visiblePhases.has(i)) {
                    if (showWaves) {
                        const diff = totals.current.phases[i].waves - totals.baseline.phases[i].waves;
                        const tooltip = `Current: ${totals.current.phases[i].waves}\nBaseline: ${totals.baseline.phases[i].waves}`;
                        html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff, 0)}</b></td>`;
                    }
                    if (showUnits) {
                        const diff = totals.current.phases[i].units - totals.baseline.phases[i].units;
                        const tooltip = `Current: ${totals.current.phases[i].units}\nBaseline: ${totals.baseline.phases[i].units}`;
                        html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff, 0)}</b></td>`;
                    }
                    if (showScore) {
                        const diff = totals.current.phases[i].score - totals.baseline.phases[i].score;
                        const tooltip = `Current: ${totals.current.phases[i].score.toFixed(1)}M\nBaseline: ${totals.baseline.phases[i].score.toFixed(1)}M`;
                        html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
                    }
                    if (showMissionsScore) {
                        const diff = totals.current.phases[i].missionsScore - totals.baseline.phases[i].missionsScore;
                        const tooltip = `Current: ${totals.current.phases[i].missionsScore.toFixed(1)}M\nBaseline: ${totals.baseline.phases[i].missionsScore.toFixed(1)}M`;
                        html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
                    }
                    if (showDeployed) {
                        const diff = totals.current.phases[i].deployed - totals.baseline.phases[i].deployed;
                        const tooltip = `Current: ${totals.current.phases[i].deployed.toFixed(1)}M\nBaseline: ${totals.baseline.phases[i].deployed.toFixed(1)}M`;
                        html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
                    }
                    if (showUndeployed) {
                        const diff = totals.current.phases[i].undeployed - totals.baseline.phases[i].undeployed;
                        const tooltip = `Current: ${totals.current.phases[i].undeployed.toFixed(1)}M\nBaseline: ${totals.baseline.phases[i].undeployed.toFixed(1)}M`;
                        html += `<td class="${getDiffClass(diff)}" title="${tooltip}"><b>${formatDiff(diff)}</b></td>`;
                    }
                }
            }
        }

        for (const mission of visibleMissions) {
            const current_sm = totals.current.specialMissions[mission.name];
            const baseline_sm = totals.baseline.specialMissions[mission.name];
            const win_diff = current_sm.win - baseline_sm.win;
            const attempts_diff = (current_sm.win + current_sm.fail) - (baseline_sm.win + baseline_sm.fail);
            const win_diff_str = win_diff === 0 ? '0' : (win_diff > 0 ? `+${win_diff}`: `${win_diff}`);
            const attempts_diff_str = attempts_diff === 0 ? '0' : (attempts_diff > 0 ? `+${attempts_diff}`: `${attempts_diff}`);
            const tooltip = `Current: ${current_sm.win}/${current_sm.win + current_sm.fail}\nBaseline: ${baseline_sm.win}/${baseline_sm.win + baseline_sm.fail}`;
            html += `<td title="${tooltip}">${win_diff_str}/${attempts_diff_str}</td>`;
        }
        html += '</tr>';

    } else {
        const totals = {
            totalWaves: 0, totalUnits: 0, totalScore: 0, totalDeployed: 0, totalUndeployed: 0,
            totalMissionsScore: 0, totalGalacticPower: 0, phases: {}, specialMissions: {}
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

            if (showTotals) {
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
                    const scoreInfo = getScoreInfo(totals.totalScore, 'Total Score', guildTotalTargetScore);
                    html += `<td class="${scoreInfo.className}" title="${scoreInfo.tooltipText}"><b>${totals.totalScore.toFixed(1)}</b></td>`;
                }
                if (showMissionsScore) {
                    const guildTotalTargetMissionScore = totalTargetMissionScore * playersCount;
                    const missionsScoreInfo = getScoreInfo(totals.totalMissionsScore, 'Total Missions Score', guildTotalTargetMissionScore);
                    html += `<td class="${missionsScoreInfo.className}" title="${missionsScoreInfo.tooltipText}"><b>${totals.totalMissionsScore.toFixed(1)}</b></td>`;
                }
                if (showDeployed) {
                    const deployedInfo = getDeployedInfo(totals.totalDeployed, totals.totalGalacticPower * visiblePhasesCount);
                    html += `<td class="${deployedInfo.className}" title="${deployedInfo.tooltipText}"><b>${totals.totalDeployed.toFixed(1)}</b></td>`;
                }
                if (showUndeployed) {
                    totals.totalUndeployed = totals.totalGalacticPower * visiblePhasesCount - totals.totalDeployed;
                    const undeployedClass = totals.totalUndeployed > 0 ? 'group-red' : 'group-green';
                    const undeployedTooltip = `Undeployed: ${totals.totalUndeployed.toFixed(1)}M`;
                    html += `<td class="${undeployedClass}" title="${undeployedTooltip}"><b>${totals.totalUndeployed.toFixed(1)}</b></td>`;
                }
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
                        const scoreInfo = getScoreInfo(phase.score, 'Total Score', guildTotalTargetScoreForPhase);
                        html += `<td class="${scoreInfo.className}" title="${scoreInfo.tooltipText}"><b>${phase.score.toFixed(1)}</b></td>`;
                    }
                    if (showMissionsScore) {
                        const targetMissionScoreForPhase = TargetMissionScores[i] || 0;
                        const guildTotalTargetMissionScoreForPhase = targetMissionScoreForPhase * playersCount;
                        const missionsScoreInfo = getScoreInfo(phase.missionsScore, 'Total Missions Score', guildTotalTargetMissionScoreForPhase);
                        html += `<td class="${missionsScoreInfo.className}" title="${missionsScoreInfo.tooltipText}"><b>${phase.missionsScore.toFixed(1)}</b></td>`;
                    }
                    if (showDeployed) {
                        const deployedInfo = getDeployedInfo(phase.deployed, state.guildGalacticPower);
                        html += `<td class="${deployedInfo.className}" title="${deployedInfo.tooltipText}"><b>${phase.deployed.toFixed(1)}</b></td>`;
                    }
                    if (showUndeployed) {
                        const undeployedClass = phase.undeployed > 0 ? 'group-red' : 'group-green';
                        const undeployedTooltip = `Undeployed: ${phase.undeployed.toFixed(1)}M`;
                        html += `<td class="${undeployedClass}" title="${undeployedTooltip}"><b>${phase.undeployed.toFixed(1)}</b></td>`;
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
    }

    // Render player rows
    for (const p of playerData) {
        const isSelected = p.playerId === state.selectedPlayerId;
        html += `<tr class="${isSelected ? 'selected-row' : ''}" data-player-id="${p.playerId}">`;
        html += `<td>${p.rank}</td>`;
        html += `<td class="player-name-cell">${p.playerName}</td>`;
        if (showGP) {
            const gp_val = isDiffMode ? formatDiff(p.galacticPower) : p.galacticPower.toFixed(1);
            const gp_cls = isDiffMode ? getDiffClass(p.galacticPower) : '';
            const gp_title = isDiffMode ? `Current: ${p.current.galacticPower.toFixed(1)}M\nBaseline: ${p.baseline.galacticPower.toFixed(1)}M` : '';
            html += `<td class="${gp_cls}" title="${gp_title}">${gp_val}</td>`;
        }

        if (showDataColumns) {
            const renderCell = (val, current, baseline, infoFn, ...args) => {
                if (isDiffMode) {
                    const tooltip = `Current: ${formatNumber(current)}
Baseline: ${formatNumber(baseline)}`;
                    return `<td class="${getDiffClass(val)}" title="${tooltip}"><b>${formatDiff(val, 0)}</b></td>`;
                } else {
                    const { className, tooltipText } = infoFn(val, ...args);
                    return `<td class="${className}" title="${tooltipText}"><b>${formatNumber(val)}</b></td>`;
                }
            };
            
            const renderScoreCell = (val, current, baseline, infoFn, ...args) => {
                if (isDiffMode) {
                    const tooltip = `Current: ${current.toFixed(1)}M\nBaseline: ${baseline.toFixed(1)}M`;
                    return `<td class="${getDiffClass(val)}" title="${tooltip}"><b>${formatDiff(val)}</b></td>`;
                } else {
                    const { className, tooltipText } = infoFn(val, ...args);
                    return `<td class="${className}" title="${tooltipText}"><b>${val.toFixed(1)}</b></td>`;
                }
            };

            if (showTotals) {
                if (showWaves) html += renderCell(p.totalWaves, p.current?.totalWaves, p.baseline?.totalWaves, getWaveCountGroupInfo, p.normalizedTotalWaves);
                if (showUnits) html += renderCell(p.totalUnits, p.current?.totalUnits, p.baseline?.totalUnits, (u) => ({ className: u === 0 ? 'group-red' : '', tooltipText: '' }));
                if (showScore) html += renderScoreCell(p.totalScore, p.current?.totalScore, p.baseline?.totalScore, getScoreInfo, 'Score', totalTargetMissionScore + p.galacticPower * Math.max(state.visiblePhases.size, 1));
                if (showMissionsScore) html += renderScoreCell(p.totalMissionsScore, p.current?.totalMissionsScore, p.baseline?.totalMissionsScore, getScoreInfo, 'Missions Score', totalTargetMissionScore);
                if (showDeployed) html += renderScoreCell(p.totalDeployed, p.current?.totalDeployed, p.baseline?.totalDeployed, getDeployedInfo, p.galacticPower * Math.max(state.visiblePhases.size, 1));
                if (showUndeployed) html += renderScoreCell(p.totalUndeployed, p.current?.totalUndeployed, p.baseline?.totalUndeployed, getUndeployedInfo, p.galacticPower * Math.max(state.visiblePhases.size, 1));
            }

            for (let i = 1; i <= 6; i++) {
                if (state.visiblePhases.has(i)) {
                    const phase = p.phases[i];
                    const currentPhase = p.current?.phases[i];
                    const baselinePhase = p.baseline?.phases[i];
                    
                    if (showWaves) html += renderCell(phase.waves, currentPhase?.waves, baselinePhase?.waves, getWaveCountGroupInfo);
                    if (showUnits) html += renderCell(phase.units, currentPhase?.units, baselinePhase?.units, (u) => ({ className: u === 0 ? 'group-red' : '', tooltipText: '' }));
                    if (showScore) html += renderScoreCell(phase.score, currentPhase?.score, baselinePhase?.score, getScoreInfo, 'Score', (TargetMissionScores[i] || 0) + p.galacticPower);
                    if (showMissionsScore) html += renderScoreCell(phase.missionsScore, currentPhase?.missionsScore, baselinePhase?.missionsScore, getScoreInfo, 'Missions Score', TargetMissionScores[i] || 0);
                    if (showDeployed) html += renderScoreCell(phase.deployed, currentPhase?.deployed, baselinePhase?.deployed, getDeployedInfo, p.galacticPower);
                    if (showUndeployed) html += renderScoreCell(phase.undeployed, currentPhase?.undeployed, baselinePhase?.undeployed, getUndeployedInfo, p.galacticPower);
                }
            }
        }

        for (const mission of visibleMissions) {
            const sm_status = p.specialMissions[mission.name];
            if (isDiffMode) {
                const currentStatus = p.current.specialMissions[mission.name];
                const baselineStatus = p.baseline.specialMissions[mission.name];
                const sm_class = getSmDiffClass(currentStatus, baselineStatus);
                const tooltip = `Current: ${currentStatus}\nBaseline: ${baselineStatus}`;
                html += `<td class="${sm_class}" title="${tooltip}">${sm_status}</td>`;
            } else {
                const sm_class = sm_status === 'win' ? 'sm-win' : (sm_status === 'fail' ? 'sm-fail' : 'sm-not-attempted');
                html += `<td class="${sm_class}">${sm_status}</td>`;
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
            th.innerHTML += state.sort.direction === 'asc' ? ' &uarr;' : ' &darr;';
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
                state.selectedPlayerId = null;
            } else {
                state.selectedPlayerId = playerId;
            }
            sortAndRender();
        }
    });

    tBody.addEventListener('mouseover', (e) => {
        if (e.target.tagName !== 'TD') return;
        const currentlyHighlighted = table.querySelectorAll('.highlight, .highlight-header');
        currentlyHighlighted.forEach(el => el.classList.remove('highlight', 'highlight-header'));
        const cell = e.target;
        const cellIndex = cell.cellIndex;
        let baseColumnCount = 2;
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
        if (cellIndex >= baseColumnCount) {
            const secondaryTitleCell = headerRows[1].cells[cellIndex - baseColumnCount];
            if (secondaryTitleCell) {
                secondaryTitleCell.classList.add('highlight-header');
            }
        }
        let primaryTitleCell;
        if (cellIndex < baseColumnCount) {
            primaryTitleCell = headerRows[0].cells[cellIndex];
        } else if (cellIndex >= totalGroupStartIndex_tbody && cellIndex < phaseGroupsStartIndex_tbody) {
            primaryTitleCell = headerRows[0].cells[baseColumnCount];
        } else if (cellIndex >= phaseGroupsStartIndex_tbody && cellIndex < smGroupStartIndex_tbody) {
            const phaseGroupIndex = Math.floor((cellIndex - phaseGroupsStartIndex_tbody) / phaseGroupSize);
            primaryTitleCell = headerRows[0].cells[baseColumnCount + 1 + phaseGroupIndex];
        } else {
            const smGroupHeaderIndex = baseColumnCount + 1 + numPhaseGroups;
            primaryTitleCell = headerRows[0].cells[smGroupHeaderIndex];
        }
        if (primaryTitleCell) {
            primaryTitleCell.classList.add('highlight-header');
        }
    });

    tBody.addEventListener('mouseleave', () => {
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
            state.currentData = data;
            onDataLoaded();
        } else {
            console.log("No default data file found or failed to load.");
        }
    } catch (error) {
        console.error("Error loading default data:", error);
    }
}

function clearDashboard() {
    document.getElementById('dashboard').innerHTML = '';
    document.querySelector('h1').textContent = 'Territory Battle Status';
    document.title = 'TB Status Dashboard';
    state.playerData = [];
    state.guildActivePhases = new Set();
    state.visiblePhases = new Set();
    state.guildName = '';
    state.guildGalacticPower = 0;
    state.isDiffMode = false;
    setupPhaseCheckboxes();
}

function onDataLoaded() {
    if (state.currentData && state.baselineData) {
        processDiffData(state.currentData, state.baselineData);
    } else if (state.currentData) {
        processSingleData(state.currentData);
    } else if (state.baselineData) {
        processSingleData(state.baselineData);
    } else {
        clearDashboard();
    }
}

function handleFileSelect(file, type) {
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (type === 'current') {
                    state.currentData = data;
                    document.getElementById('clear-current-button').style.display = 'inline-block';
                } else {
                    state.baselineData = data;
                    document.getElementById('clear-baseline-button').style.display = 'inline-block';
                }
                onDataLoaded();
            } catch (error) {
                alert('Error parsing JSON file.');
                console.error(error);
            }
        };
        reader.readAsText(file);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDefaultData();
    document.getElementById('show-totals-checkbox').addEventListener('change', (event) => {
        state.showTotals = event.target.checked;
        sortAndRender();
    });
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

    document.getElementById('current-file-input').addEventListener('change', (event) => {
        handleFileSelect(event.target.files[0], 'current');
    });
    document.getElementById('baseline-file-input').addEventListener('change', (event) => {
        handleFileSelect(event.target.files[0], 'baseline');
    });

    document.getElementById('clear-current-button').addEventListener('click', () => {
        state.currentData = null;
        const fileInput = document.getElementById('current-file-input');
        fileInput.value = '';
        document.getElementById('clear-current-button').style.display = 'none';
        onDataLoaded();
    });

    document.getElementById('clear-baseline-button').addEventListener('click', () => {
        state.baselineData = null;
        const fileInput = document.getElementById('baseline-file-input');
        fileInput.value = '';
        document.getElementById('clear-baseline-button').style.display = 'none';
        onDataLoaded();
    });

    const modal = document.getElementById('cell-info-modal');
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
