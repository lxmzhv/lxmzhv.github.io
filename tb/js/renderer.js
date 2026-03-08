import { AppState } from './state.js';
import { SpecialMissions, TargetMissionScores } from './constants.js';
import { getDiffColor, formatDiff, getWaveCountGroupInfo, getUnitsInfo, getScoreInfo, getDeployedInfo, getUndeployedInfo, getSpecialMissionsScoreInfo, isNumericKey, getSmDiffClass, formatNumber } from './utils.js';
import { sortAndRender, recalculateAndRender } from './dataProcessor.js';

function renderDashboard(playerData, guildActivePhases) {
    const dashboard = document.getElementById('dashboard');
    const { showGP, showUnits, showScore, showMissionsScore, showSpecialMissions, showDeployed, showUndeployed, showWaves, isDiffMode, showTotals } = AppState;
    const visibleMissions = showSpecialMissions ? SpecialMissions : [];
    const showDataColumns = showUnits || showScore || showMissionsScore || showWaves || showDeployed || showUndeployed || showSpecialMissions;

    let totalTargetMissionScore = 0;
    for (const phase of AppState.visiblePhases) {
        totalTargetMissionScore += TargetMissionScores[phase] || 0;
    }

    let totalColspan = 0;
    if (showWaves) totalColspan++;
    if (showUnits) totalColspan++;
    if (showScore) totalColspan++;
    if (showMissionsScore) totalColspan++;
    if (showDeployed) totalColspan++;
    if (showUndeployed) totalColspan++;
    if (showSpecialMissions) totalColspan++;

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
        if (phaseColspan > 0) {
            for (let i = 1; i <= 6; i++) {
                if (AppState.visiblePhases.has(i)) {
                    html += `<th colspan="${phaseColspan}">Phase ${i}</th>`;
                }
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
            if (showSpecialMissions) html += '<th data-sort="totalSpecialMissionsScore">Special Missions</th>';
        }
        for (let i = 1; i <= 6; i++) {
            if (AppState.visiblePhases.has(i)) {
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
            current: { totalGalacticPower: 0, totalWaves: 0, totalUnits: 0, totalScore: 0, totalDeployed: 0, totalUndeployed: 0, totalMissionsScore: 0, totalSpecialMissionsScore: 0, phases: {}, specialMissions: {} },
            baseline: { totalGalacticPower: 0, totalWaves: 0, totalUnits: 0, totalScore: 0, totalDeployed: 0, totalUndeployed: 0, totalMissionsScore: 0, totalSpecialMissionsScore: 0, phases: {}, specialMissions: {} }
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
            totals.current.totalSpecialMissionsScore += currentP.totalSpecialMissionsScore;
            totals.baseline.totalSpecialMissionsScore += baselineP.totalSpecialMissionsScore;

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

        const playersCount = Math.max(playerData.length, 1);
        const visiblePhasesCount = Math.max(AppState.visiblePhases.size, 1);

        html += '<tr>';
        html += '<td><b>0</b></td>';
        html += '<td><b>Totals</b></td>';

        if (showGP) {
            const diff = totals.current.totalGalacticPower - totals.baseline.totalGalacticPower;
            const tooltip = `Current: ${totals.current.totalGalacticPower.toFixed(1)}M\nBaseline: ${totals.baseline.totalGalacticPower.toFixed(1)}M`;
            const diffColor = getDiffColor(diff, '');
            const diffStr = formatDiff(diff);
            html += `<td title="${tooltip}"><b>${totals.current.totalGalacticPower.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
        }

        if (showDataColumns) {
            if (showTotals) {
                if (showWaves) {
                    const diff = totals.current.totalWaves - totals.baseline.totalWaves;
                    const tooltip = `Current: ${totals.current.totalWaves}\nBaseline: ${totals.baseline.totalWaves}`;
                    const diffStr = formatDiff(diff, 0);
                    const normalizedFooterTotal = totals.current.totalWaves / (visiblePhasesCount * playersCount);
                    const waveInfo = getWaveCountGroupInfo(normalizedFooterTotal);
                    const diffColor = getDiffColor(diff, waveInfo.className);
                    const finalTooltip = `${tooltip}\n${waveInfo.tooltipText}`;
                    html += `<td class="${waveInfo.className}" title="${finalTooltip}"><b>${totals.current.totalWaves} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                }
                if (showUnits) {
                    const diff = totals.current.totalUnits - totals.baseline.totalUnits;
                    const tooltip = `Current: ${totals.current.totalUnits}\nBaseline: ${totals.baseline.totalUnits}`;
                    const diffStr = formatDiff(diff, 0);
                    const normalizedUnits = totals.current.totalUnits / (visiblePhasesCount * playersCount);
                    const unitsInfo = getUnitsInfo(normalizedUnits);
                    const diffColor = getDiffColor(diff, unitsInfo.className);
                    const finalTooltip = `${tooltip}\n${unitsInfo.tooltipText}`;
                    html += `<td class="${unitsInfo.className}" title="${finalTooltip}"><b>${totals.current.totalUnits} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                }
                if (showScore) {
                    const diff = totals.current.totalScore - totals.baseline.totalScore;
                    const tooltip = `Current: ${totals.current.totalScore.toFixed(1)}M\nBaseline: ${totals.baseline.totalScore.toFixed(1)}M`;
                    const diffStr = formatDiff(diff);
                    const avgGP = totals.current.totalGalacticPower / playersCount;
                    const avgTargetScore = totalTargetMissionScore + avgGP * visiblePhasesCount;
                    const guildTotalTargetScore = avgTargetScore * playersCount;
                    const scoreInfo = getScoreInfo(totals.current.totalScore, 'Total Score', guildTotalTargetScore);
                    const diffColor = getDiffColor(diff, scoreInfo.className);
                    const finalTooltip = `${tooltip}\n${scoreInfo.tooltipText}`;
                    html += `<td class="${scoreInfo.className}" title="${finalTooltip}"><b>${totals.current.totalScore.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                }
                if (showMissionsScore) {
                    const diff = totals.current.totalMissionsScore - totals.baseline.totalMissionsScore;
                    const tooltip = `Current: ${totals.current.totalMissionsScore.toFixed(1)}M\nBaseline: ${totals.baseline.totalMissionsScore.toFixed(1)}M`;
                    const diffStr = formatDiff(diff);
                    const guildTotalTargetMissionScore = totalTargetMissionScore * playersCount;
                    const missionsScoreInfo = getScoreInfo(totals.current.totalMissionsScore, 'Total Missions Score', guildTotalTargetMissionScore);
                    const diffColor = getDiffColor(diff, missionsScoreInfo.className);
                    const finalTooltip = `${tooltip}\n${missionsScoreInfo.tooltipText}`;
                    html += `<td class="${missionsScoreInfo.className}" title="${finalTooltip}"><b>${totals.current.totalMissionsScore.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                }
                if (showDeployed) {
                    const diff = totals.current.totalDeployed - totals.baseline.totalDeployed;
                    const tooltip = `Current: ${totals.current.totalDeployed.toFixed(1)}M\nBaseline: ${totals.baseline.totalDeployed.toFixed(1)}M`;
                    const diffStr = formatDiff(diff);
                    const deployedInfo = getDeployedInfo(totals.current.totalDeployed, totals.current.totalGalacticPower * visiblePhasesCount);
                    const diffColor = getDiffColor(diff, deployedInfo.className);
                    const finalTooltip = `${tooltip}\n${deployedInfo.tooltipText}`;
                    html += `<td class="${deployedInfo.className}" title="${finalTooltip}"><b>${totals.current.totalDeployed.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                }
                if (showUndeployed) {
                    const diff = totals.current.totalUndeployed - totals.baseline.totalUndeployed;
                    const tooltip = `Current: ${totals.current.totalUndeployed.toFixed(1)}M\nBaseline: ${totals.baseline.totalUndeployed.toFixed(1)}M`;
                    const diffStr = formatDiff(diff);
                    const undeployedClass = totals.current.totalUndeployed > 0 ? 'group-red' : 'group-green';
                    const diffColor = getDiffColor(diff, undeployedClass);
                    const undeployedTooltip = `Undeployed: ${totals.current.totalUndeployed.toFixed(1)}M`;
                    const finalTooltip = `${tooltip}\n${undeployedTooltip}`;
                    html += `<td class="${undeployedClass}" title="${finalTooltip}"><b>${totals.current.totalUndeployed.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                }
                if (showSpecialMissions) {
                    const diff = totals.current.totalSpecialMissionsScore - totals.baseline.totalSpecialMissionsScore;
                    const tooltip = `Current: ${totals.current.totalSpecialMissionsScore}\nBaseline: ${totals.baseline.totalSpecialMissionsScore}`;
                    const diffStr = formatDiff(diff, 0);
                    const avgScore = totals.current.totalSpecialMissionsScore / playersCount;
                    const { className, tooltipText } = getSpecialMissionsScoreInfo(avgScore);
                    const diffColor = getDiffColor(diff, className);
                    const finalTooltip = `${tooltip}\n${tooltipText}`;
                    html += `<td class="${className}" title="${finalTooltip}"><b>${totals.current.totalSpecialMissionsScore} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                }
            }

            for (let i = 1; i <= 6; i++) {
                if (AppState.visiblePhases.has(i)) {
                    if (showWaves) {
                        const diff = totals.current.phases[i].waves - totals.baseline.phases[i].waves;
                        const tooltip = `Current: ${totals.current.phases[i].waves}\nBaseline: ${totals.baseline.phases[i].waves}`;
                        const diffStr = formatDiff(diff, 0);
                        const waveInfo = getWaveCountGroupInfo(totals.current.phases[i].waves / playersCount);
                        const diffColor = getDiffColor(diff, waveInfo.className);
                        const finalTooltip = `${tooltip}\n${waveInfo.tooltipText}`;
                        html += `<td class="${waveInfo.className}" title="${finalTooltip}"><b>${totals.current.phases[i].waves} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                    }
                    if (showUnits) {
                        const diff = totals.current.phases[i].units - totals.baseline.phases[i].units;
                        const tooltip = `Current: ${totals.current.phases[i].units}\nBaseline: ${totals.baseline.phases[i].units}`;
                        const diffStr = formatDiff(diff, 0);
                        const unitsInfo = getUnitsInfo(totals.current.phases[i].units / playersCount);
                        const diffColor = getDiffColor(diff, unitsInfo.className);
                        const finalTooltip = `${tooltip}\n${unitsInfo.tooltipText}`;
                        html += `<td class="${unitsInfo.className}" title="${finalTooltip}"><b>${totals.current.phases[i].units} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                    }
                    if (showScore) {
                        const diff = totals.current.phases[i].score - totals.baseline.phases[i].score;
                        const tooltip = `Current: ${totals.current.phases[i].score.toFixed(1)}M\nBaseline: ${totals.baseline.phases[i].score.toFixed(1)}M`;
                        const diffStr = formatDiff(diff);
                        const avgGP = totals.current.totalGalacticPower / playersCount;
                        const targetMissionScoreForPhase = TargetMissionScores[i] || 0;
                        const avgTargetScore = targetMissionScoreForPhase + avgGP;
                        const guildTotalTargetScoreForPhase = avgTargetScore * playersCount;
                        const scoreInfo = getScoreInfo(totals.current.phases[i].score, 'Total Score', guildTotalTargetScoreForPhase);
                        const diffColor = getDiffColor(diff, scoreInfo.className);
                        const finalTooltip = `${tooltip}\n${scoreInfo.tooltipText}`;
                        html += `<td class="${scoreInfo.className}" title="${finalTooltip}"><b>${totals.current.phases[i].score.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                    }
                    if (showMissionsScore) {
                        const diff = totals.current.phases[i].missionsScore - totals.baseline.phases[i].missionsScore;
                        const tooltip = `Current: ${totals.current.phases[i].missionsScore.toFixed(1)}M\nBaseline: ${totals.baseline.phases[i].missionsScore.toFixed(1)}M`;
                        const diffStr = formatDiff(diff);
                        const targetMissionScoreForPhase = TargetMissionScores[i] || 0;
                        const guildTotalTargetMissionScoreForPhase = targetMissionScoreForPhase * playersCount;
                        const missionsScoreInfo = getScoreInfo(totals.current.phases[i].missionsScore, 'Total Missions Score', guildTotalTargetMissionScoreForPhase);
                        const diffColor = getDiffColor(diff, missionsScoreInfo.className);
                        const finalTooltip = `${tooltip}\n${missionsScoreInfo.tooltipText}`;
                        html += `<td class="${missionsScoreInfo.className}" title="${finalTooltip}"><b>${totals.current.phases[i].missionsScore.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                    }
                    if (showDeployed) {
                        const diff = totals.current.phases[i].deployed - totals.baseline.phases[i].deployed;
                        const tooltip = `Current: ${totals.current.phases[i].deployed.toFixed(1)}M\nBaseline: ${totals.baseline.phases[i].deployed.toFixed(1)}M`;
                        const diffStr = formatDiff(diff);
                        const deployedInfo = getDeployedInfo(totals.current.phases[i].deployed, AppState.guildGalacticPower);
                        const diffColor = getDiffColor(diff, deployedInfo.className);
                        const finalTooltip = `${tooltip}\n${deployedInfo.tooltipText}`;
                        html += `<td class="${deployedInfo.className}" title="${finalTooltip}"><b>${totals.current.phases[i].deployed.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                    }
                    if (showUndeployed) {
                        const diff = totals.current.phases[i].undeployed - totals.baseline.phases[i].undeployed;
                        const tooltip = `Current: ${totals.current.phases[i].undeployed.toFixed(1)}M\nBaseline: ${totals.baseline.phases[i].undeployed.toFixed(1)}M`;
                        const diffStr = formatDiff(diff);
                        const undeployedClass = totals.current.phases[i].undeployed > 0 ? 'group-red' : 'group-green';
                        const diffColor = getDiffColor(diff, undeployedClass);
                        const undeployedTooltip = `Undeployed: ${totals.current.phases[i].undeployed.toFixed(1)}M`;
                        const finalTooltip = `${tooltip}\n${undeployedTooltip}`;
                        html += `<td class="${undeployedClass}" title="${finalTooltip}"><b>${totals.current.phases[i].undeployed.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span></b></td>`;
                    }
                }
            }
        }

        for (const mission of visibleMissions) {
            const current_sm = totals.current.specialMissions[mission.name];
            const baseline_sm = totals.baseline.specialMissions[mission.name];
            const win_diff = current_sm.win - baseline_sm.win;
            const attempts_diff = (current_sm.win + current_sm.fail) - (baseline_sm.win + baseline_sm.fail);
            const win_diff_str = win_diff === 0 ? '0' : (win_diff > 0 ? `+${win_diff}` : `${win_diff}`);
            const attempts_diff_str = attempts_diff === 0 ? '0' : (attempts_diff > 0 ? `+${attempts_diff}` : `${attempts_diff}`);
            const tooltip = `Current: ${current_sm.win}/${current_sm.win + current_sm.fail}\nBaseline: ${baseline_sm.win}/${baseline_sm.win + baseline_sm.fail}`;
            html += `<td title="${tooltip}">${win_diff_str}/${attempts_diff_str}</td>`;
        }
        html += '</tr>';

    } else {
        const totals = {
            totalWaves: 0, totalUnits: 0, totalScore: 0, totalDeployed: 0, totalUndeployed: 0,
            totalMissionsScore: 0, totalSpecialMissionsScore: 0, totalGalacticPower: 0, phases: {}, specialMissions: {}
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
            totals.totalSpecialMissionsScore += p.totalSpecialMissionsScore;
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
            const visiblePhasesCount = Math.max(AppState.visiblePhases.size, 1);

            if (showTotals) {
                if (showWaves) {
                    const normalizedFooterTotal = totals.totalWaves / (visiblePhasesCount * playersCount);
                    const waveInfo = getWaveCountGroupInfo(normalizedFooterTotal);
                    html += `<td class="${waveInfo.className}" title="${waveInfo.tooltipText}"><b>${totals.totalWaves}</b></td>`;
                }
                if (showUnits) {
                    const normalizedUnits = totals.totalUnits / (visiblePhasesCount * playersCount);
                    const unitsInfo = getUnitsInfo(normalizedUnits);
                    html += `<td class="${unitsInfo.className}" title="${unitsInfo.tooltipText}"><b>${totals.totalUnits}</b></td>`;
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
                if (showSpecialMissions) {
                    const avgScore = totals.totalSpecialMissionsScore / playersCount;
                    const { className, tooltipText } = getSpecialMissionsScoreInfo(avgScore);
                    html += `<td class="${className}" title="${tooltipText}"><b>${totals.totalSpecialMissionsScore}</b></td>`;
                }
            }

            for (let i = 1; i <= 6; i++) {
                if (AppState.visiblePhases.has(i)) {
                    const phase = totals.phases[i];
                    if (showWaves) {
                        const waveInfo = getWaveCountGroupInfo(phase.waves / playersCount);
                        html += `<td class="${waveInfo.className}" title="${waveInfo.tooltipText}"><b>${phase.waves}</b></td>`;
                    }
                    if (showUnits) {
                        const unitsInfo = getUnitsInfo(phase.units / playersCount);
                        html += `<td class="${unitsInfo.className}" title="${unitsInfo.tooltipText}"><b>${phase.units}</b></td>`;
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
                        const deployedInfo = getDeployedInfo(phase.deployed, AppState.guildGalacticPower);
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
        const isSelected = p.playerId === AppState.selectedPlayerId;
        html += `<tr class="${isSelected ? 'selected-row' : ''}" data-player-id="${p.playerId}">`;
        html += `<td>${p.rank}</td>`;
        html += `<td class="player-name-cell">${p.playerName}</td>`;
        if (showGP) {
            let gp_val, gp_cls = '', gp_title = '';
            if (isDiffMode) {
                const diff = p.galacticPower;
                const diffColor = getDiffColor(diff, '');
                const diffStr = formatDiff(diff);
                gp_val = `${p.current.galacticPower.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span>`;
                gp_cls = '';
                gp_title = `Current: ${p.current.galacticPower.toFixed(1)}M\nBaseline: ${p.baseline.galacticPower.toFixed(1)}M`;
            } else {
                gp_val = p.galacticPower.toFixed(1);
            }
            html += `<td class="${gp_cls}" title="${gp_title}">${gp_val}</td>`;
        }

        if (showDataColumns) {
            const renderCell = (val, current, baseline, infoFn, ...args) => {
                if (isDiffMode) {
                    const tooltip = `Current: ${formatNumber(current)}\nBaseline: ${formatNumber(baseline)}`;
                    const diffStr = formatDiff(val, 0);
                    const { className, tooltipText: nonDiffTooltip } = infoFn(current, ...args);
                    const diffColor = getDiffColor(val, className);
                    const displayVal = `${formatNumber(current)} <span style="color: ${diffColor};">(${diffStr})</span>`;
                    const finalTooltip = nonDiffTooltip ? `${tooltip}\n${nonDiffTooltip}` : tooltip;
                    return `<td class="${className}" title="${finalTooltip}"><b>${displayVal}</b></td>`;
                } else {
                    const { className, tooltipText } = infoFn(val, ...args);
                    return `<td class="${className}" title="${tooltipText}"><b>${formatNumber(val)}</b></td>`;
                }
            };

            const renderScoreCell = (val, current, baseline, infoFn, ...args) => {
                if (isDiffMode) {
                    const tooltip = `Current: ${current.toFixed(1)}M\nBaseline: ${baseline.toFixed(1)}M`;
                    const diffStr = formatDiff(val);
                    const { className, tooltipText: nonDiffTooltip } = infoFn(current, ...args);
                    const diffColor = getDiffColor(val, className);
                    const displayVal = `${current.toFixed(1)} <span style="color: ${diffColor};">(${diffStr})</span>`;
                    const finalTooltip = nonDiffTooltip ? `${tooltip}\n${nonDiffTooltip}` : tooltip;
                    return `<td class="${className}" title="${finalTooltip}"><b>${displayVal}</b></td>`;
                } else {
                    const { className, tooltipText } = infoFn(val, ...args);
                    return `<td class="${className}" title="${tooltipText}"><b>${val.toFixed(1)}</b></td>`;
                }
            };

            const gp = isDiffMode ? p.current.galacticPower : p.galacticPower;

            if (showTotals) {
                if (showWaves) html += renderCell(p.totalWaves, p.current?.totalWaves, p.baseline?.totalWaves, getWaveCountGroupInfo, p.normalizedTotalWaves);
                if (showUnits) html += renderCell(p.totalUnits, p.current?.totalUnits, p.baseline?.totalUnits, getUnitsInfo);
                if (showScore) html += renderScoreCell(p.totalScore, p.current?.totalScore, p.baseline?.totalScore, getScoreInfo, 'Score', totalTargetMissionScore + gp * Math.max(AppState.visiblePhases.size, 1));
                if (showMissionsScore) html += renderScoreCell(p.totalMissionsScore, p.current?.totalMissionsScore, p.baseline?.totalMissionsScore, getScoreInfo, 'Missions Score', totalTargetMissionScore);
                if (showDeployed) html += renderScoreCell(p.totalDeployed, p.current?.totalDeployed, p.baseline?.totalDeployed, getDeployedInfo, gp * Math.max(AppState.visiblePhases.size, 1));
                if (showUndeployed) html += renderScoreCell(p.totalUndeployed, p.current?.totalUndeployed, p.baseline?.totalUndeployed, getUndeployedInfo, gp * Math.max(AppState.visiblePhases.size, 1));
                if (showSpecialMissions) html += renderCell(p.totalSpecialMissionsScore, p.current?.totalSpecialMissionsScore, p.baseline?.totalSpecialMissionsScore, getSpecialMissionsScoreInfo);
            }

            for (let i = 1; i <= 6; i++) {
                if (AppState.visiblePhases.has(i)) {
                    const phase = p.phases[i];
                    const currentPhase = p.current?.phases[i];
                    const baselinePhase = p.baseline?.phases[i];

                    if (showWaves) html += renderCell(phase.waves, currentPhase?.waves, baselinePhase?.waves, getWaveCountGroupInfo);
                    if (showUnits) html += renderCell(phase.units, currentPhase?.units, baselinePhase?.units, getUnitsInfo);
                    if (showScore) html += renderScoreCell(phase.score, currentPhase?.score, baselinePhase?.score, getScoreInfo, 'Score', (TargetMissionScores[i] || 0) + gp);
                    if (showMissionsScore) html += renderScoreCell(phase.missionsScore, currentPhase?.missionsScore, baselinePhase?.missionsScore, getScoreInfo, 'Missions Score', TargetMissionScores[i] || 0);
                    if (showDeployed) html += renderScoreCell(phase.deployed, currentPhase?.deployed, baselinePhase?.deployed, getDeployedInfo, gp);
                    if (showUndeployed) html += renderScoreCell(phase.undeployed, currentPhase?.undeployed, baselinePhase?.undeployed, getUndeployedInfo, gp);
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
        if (sortKey === AppState.sort.key) {
            th.classList.add('sort-active');
            th.innerHTML += AppState.sort.direction === 'asc' ? ' &uarr;' : ' &darr;';
        }
        th.addEventListener('click', () => {
            const newSortKey = th.dataset.sort;
            if (AppState.sort.key === newSortKey) {
                AppState.sort.direction = AppState.sort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                AppState.sort.key = newSortKey;
                AppState.sort.direction = isNumericKey(newSortKey) ? 'desc' : 'asc';
            }
            sortAndRender();
        });
    });

    setupHighlightEventListeners();
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
        checkbox.checked = AppState.visiblePhases.has(i);
        checkbox.disabled = !AppState.guildActivePhases.has(i);

        checkbox.addEventListener('change', (event) => {
            const phase = parseInt(event.target.dataset.phase, 10);
            if (event.target.checked) {
                AppState.visiblePhases.add(phase);
            } else {
                AppState.visiblePhases.delete(phase);
            }
            recalculateAndRender();
        });

        label.appendChild(checkbox);
        label.append(` Phase ${i}`);
        label.style.marginRight = '1em';
        container.appendChild(label);
    }
}

function setupHighlightEventListeners() {
    const table = document.querySelector('#dashboard table');
    if (!table) return;

    const headerRows = table.querySelectorAll('thead tr');
    const tBody = table.querySelector('tbody');
    const { showGP, showUnits, showScore, showMissionsScore, showSpecialMissions, showDeployed, showUndeployed, showWaves } = AppState;
    const visibleMissions = showSpecialMissions ? SpecialMissions : [];

    tBody.addEventListener('click', (e) => {
        const cell = e.target.closest('td');
        if (cell && cell.title) {
            showModal(cell.title);
        }

        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow.dataset.playerId) {
            const playerId = targetRow.dataset.playerId;
            if (AppState.selectedPlayerId === playerId) {
                AppState.selectedPlayerId = null;
            } else {
                AppState.selectedPlayerId = playerId;
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

function showModal(text) {
    const modal = document.getElementById('cell-info-modal');
    const modalText = document.getElementById('modal-text');
    modalText.textContent = text;
    modal.style.display = 'block';
}

export { renderDashboard, setupPhaseCheckboxes };
