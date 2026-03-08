import { ZoneAliases } from './constants.js';

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
        key === 'totalSpecialMissionsScore' ||
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

function getDiffColor(diff, className) {
    const isLightBg = className === 'group-orange' || className === 'group-yellow' || className === 'group-lightgreen' || className === '';

    if (diff > 0) {
        return isLightBg ? 'darkgreen' : 'lightgreen';
    }
    if (diff < 0) {
        return isLightBg ? 'darkred' : '#ffd0d0';
    }
    return isLightBg ? '#404040' : 'lightgrey';
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

function getUnitsInfo(units) {
    let className = '';
    let tooltipText = `Units: ${formatNumber(units)}`;
    if (units >= 6) {
        className = 'group-green';
        tooltipText += '\nStatus: Excellent';
    } else if (units >= 3) {
        className = 'group-lightgreen';
        tooltipText += '\nStatus: Good';
    } else if (units === 2) {
        className = 'group-yellow';
        tooltipText += '\nStatus: Average';
    } else if (units === 1) {
        className = 'group-orange';
        tooltipText += '\nStatus: Poor';
    } else if (units === 0) {
        className = 'group-red';
        tooltipText += '\nStatus: Very Poor';
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

function getSpecialMissionsScoreInfo(score) {
    let className = '';
    let tooltipText = `Special Missions Score: ${score % 1 === 0 ? score : score.toFixed(1)}`;
    if (score >= 2) {
        className = 'group-green';
    } else if (score > 0) {
        className = 'group-lightgreen';
    } else if (score === 0) {
        className = 'group-yellow';
    } else if (score >= -1) {
        className = 'group-orange';
    } else {
        className = 'group-red';
    }
    return { className, tooltipText };
}

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

export { zoneIdToName, getPlayers, isNumericKey, formatDiff, getSmDiff, getSmDiffClass, getDiffColor, formatNumber, getWaveCountGroupInfo, getUnitsInfo, getDeployedInfo, getUndeployedInfo, getSpecialMissionsScoreInfo, getScoreInfo };
