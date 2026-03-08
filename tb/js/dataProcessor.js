import { AppState } from './state.js';
import { SpecialMissions } from './constants.js';
import { zoneIdToName, getPlayers, getSmDiff, isNumericKey } from './utils.js';
import { setupPhaseCheckboxes, renderDashboard } from './renderer.js';

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
            totalMissionsScore: 0,
            totalSpecialMissionsScore: 0
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
    AppState.isDiffMode = false;
    const { playerData, guildActivePhases, guildName, guildGalacticPower } = extractPlayerData(data);

    AppState.guildName = guildName;
    AppState.guildGalacticPower = guildGalacticPower;
    document.title = `Territory Battle - ${AppState.guildName}`;
    let titleText = `Territory Battle - ${AppState.guildName}`;
    if (AppState.guildGalacticPower) {
        titleText += ` (${AppState.guildGalacticPower.toFixed(1)}M GP)`;
    }
    document.querySelector('h1').textContent = titleText;

    AppState.playerData = playerData;
    AppState.guildActivePhases = guildActivePhases;
    AppState.visiblePhases = new Set(guildActivePhases);

    setupPhaseCheckboxes();
    recalculatePlayerTotals();
    sortAndRender();
}

function processDiffData(currentData, baselineData) {
    AppState.isDiffMode = true;
    const current = extractPlayerData(currentData);
    recalculatePlayerTotals(current.playerData, current.guildActivePhases, new Set(current.guildActivePhases));

    const baseline = extractPlayerData(baselineData);
    recalculatePlayerTotals(baseline.playerData, baseline.guildActivePhases, new Set(baseline.guildActivePhases));

    AppState.guildName = current.guildName;
    AppState.guildGalacticPower = current.guildGalacticPower;
    document.title = `Territory Battle Diff - ${AppState.guildName}`;
    let titleText = `TB Diff - ${AppState.guildName}`;
    if (AppState.guildGalacticPower) {
        titleText += ` (${AppState.guildGalacticPower.toFixed(1)}M GP)`;
    }
    document.querySelector('h1').textContent = titleText;

    const allPhases = new Set([...current.guildActivePhases, ...baseline.guildActivePhases]);
    AppState.guildActivePhases = allPhases;
    AppState.visiblePhases = new Set(allPhases);

    const baselinePlayers = new Map(baseline.playerData.map(p => [p.playerId, p]));
    const currentPlayers = new Map(current.playerData.map(p => [p.playerId, p]));
    const allPlayerIds = new Set([...currentPlayers.keys(), ...baselinePlayers.keys()]);

    const diffPlayerData = [];

    const zeroPlayer = {
        galacticPower: 0, phases: {}, specialMissions: {}, totalWaves: 0, totalUnits: 0, totalScore: 0,
        totalDeployed: 0, totalUndeployed: 0, totalMissionsScore: 0, totalSpecialMissionsScore: 0, playerName: ''
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
        diffP.totalSpecialMissionsScore = currentP.totalSpecialMissionsScore - baselineP.totalSpecialMissionsScore;

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

    AppState.playerData = diffPlayerData;
    setupPhaseCheckboxes();
    sortAndRender();
}


function recalculatePlayerTotals(playerData = AppState.playerData, guildActivePhases = AppState.guildActivePhases, visiblePhases = AppState.visiblePhases) {
    const visiblePhasesCount = Math.max(visiblePhases.size, 1);
    for (const p of playerData) {
        let grandTotal = 0;
        p.totalScore = 0;
        p.totalDeployed = 0;
        p.totalMissionsScore = 0;
        p.totalSpecialMissionsScore = 0;
        p.totalUnits = 0;

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
                p.totalUnits += phaseData.units;
            }
        }

        p.totalWaves = grandTotal;
        p.totalUndeployed = p.galacticPower * visiblePhasesCount - p.totalDeployed;
        p.totalMissionsScore = p.totalScore - p.totalDeployed;

        let smScore = 0;
        for (const mission of SpecialMissions) {
            const status = p.specialMissions[mission.name];
            if (status === 'win') {
                smScore += 1;
            } else if (status === 'fail') {
                smScore += 0;
            } else {
                smScore -= 1;
            }
        }
        p.totalSpecialMissionsScore = smScore;
    }

    for (const p of playerData) {
        p.normalizedTotalWaves = p.totalWaves / visiblePhasesCount;
        p.normalizedTotalMissionsScore = p.totalMissionsScore / visiblePhasesCount;
    }
}

function recalculateAndRender() {
    if (!AppState.isDiffMode) {
        recalculatePlayerTotals();
    } else {
        for (const p of AppState.playerData) {
            recalculatePlayerTotals([p.current], AppState.guildActivePhases, AppState.visiblePhases);
            recalculatePlayerTotals([p.baseline], AppState.guildActivePhases, AppState.visiblePhases);

            p.totalWaves = p.current.totalWaves - p.baseline.totalWaves;
            p.totalUnits = p.current.totalUnits - p.baseline.totalUnits;
            p.totalScore = p.current.totalScore - p.baseline.totalScore;
            p.totalDeployed = p.current.totalDeployed - p.baseline.totalDeployed;
            p.totalUndeployed = p.current.totalUndeployed - p.baseline.totalUndeployed;
            p.totalMissionsScore = p.current.totalMissionsScore - p.baseline.totalMissionsScore;
            p.totalSpecialMissionsScore = p.current.totalSpecialMissionsScore - p.baseline.totalSpecialMissionsScore;
        }
    }
    sortAndRender();
}

function sortAndRender() {
    const { key, direction } = AppState.sort;
    const sortedData = [...AppState.playerData];

    sortedData.sort((a, b) => {
        let valA, valB;

        const playerA = AppState.isDiffMode ? a.current : a;
        const playerB = AppState.isDiffMode ? b.current : b;

        if (key.startsWith('waves-')) {
            const phase = key.split('-')[1];
            valA = playerA.phases[phase].waves;
            valB = playerB.phases[phase].waves;
        } else if (key.startsWith('units-')) {
            const phase = key.split('-')[1];
            valA = playerA.phases[phase].units;
            valB = playerB.phases[phase].units;
        } else if (key.startsWith('score-')) {
            const phase = key.split('-')[1];
            valA = playerA.phases[phase].score;
            valB = playerB.phases[phase].score;
        } else if (key.startsWith('missionsScore-')) {
            const phase = key.split('-')[1];
            valA = playerA.phases[phase].missionsScore;
            valB = playerB.phases[phase].missionsScore;
        } else if (key.startsWith('deployed-')) {
            const phase = key.split('-')[1];
            valA = playerA.phases[phase].deployed;
            valB = playerB.phases[phase].deployed;
        } else if (key.startsWith('undeployed-')) {
            const phase = key.split('-')[1];
            valA = playerA.phases[phase].undeployed;
            valB = playerB.phases[phase].undeployed;
        } else if (key.startsWith('sm-')) {
            const missionName = key.substring(3);
            valA = playerA.specialMissions[missionName];
            valB = playerB.specialMissions[missionName];
        } else {
            valA = playerA[key];
            valB = playerB[key];
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

    renderDashboard(sortedData, AppState.guildActivePhases);
}

export { extractPlayerData, processSingleData, processDiffData, recalculatePlayerTotals, recalculateAndRender, sortAndRender };
