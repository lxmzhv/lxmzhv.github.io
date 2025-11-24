import { getUnitDisplayName } from '../logic/player.js';

export function showOmicronPopup(modal, modalBody, playerName, unitDisplayName, details) {
    let popupContent = `<h2>${playerName} - ${unitDisplayName} Omicrons</h2>`;
    if (details.length > 0) {
        popupContent += '<ul>';
        details.forEach(detail => {
            const status = detail.hasOmicron ? '<span style="color: green;">Yes</span>' : '<span style="color: red;">No</span>';
            popupContent += `<li>${detail.name}: ${status}</li>`;
        });
        popupContent += '</ul>';
    } else {
        popupContent += `<p>No omicron skills for this unit.</p>`;
    }

    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}

export function showRareCharsPopup(modal, modalBody, player, relicLevel, allPlatoonRequirements, getPlayerUnitInfo) {
    let charsToList = [];
    const uniqueCharNames = new Set();

    if (relicLevel === 'total') {
        allPlatoonRequirements.forEach(req => {
            if (req.level < 5) return;

            const unitInfo = getPlayerUnitInfo(player, req.unitId);
            if (unitInfo.type === 3 && unitInfo.rarity === 7 && unitInfo.level >= req.level) {
                const charName = getUnitDisplayName(req.unitId);
                if (!uniqueCharNames.has(charName)) {
                    charsToList.push({
                        name: charName,
                        relic: unitInfo.level
                    });
                    uniqueCharNames.add(charName);
                }
            }
        });
    } else {
        allPlatoonRequirements.forEach(req => {
            if (req.level !== relicLevel) return;

            const unitInfo = getPlayerUnitInfo(player, req.unitId);
            if (unitInfo.type === 3 && unitInfo.rarity === 7 && unitInfo.level >= req.level) {
                charsToList.push({
                    name: getUnitDisplayName(req.unitId),
                    relic: unitInfo.level
                });
            }
        });
    }

    let popupContent = `<h2>${player.playerName} - Platoon Characters (Required at R${relicLevel === 'total' ? '5+' : relicLevel})</h2>`;
    if (charsToList.length > 0) {
        popupContent += '<ul>';
        charsToList.sort((a, b) => b.relic - a.relic || a.name.localeCompare(b.name));
        charsToList.forEach(char => {
            popupContent += `<li>${char.name} (R${char.relic})</li>`;
        });
        popupContent += '</ul>';
    } else {
        popupContent += `<p>No platoon characters meeting this requirement.</p>`;
    }

    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}

export function showPlanetUnitsPopup(modal, modalBody, planetName, stats, currentRound, shipBaseIds) {
    const lastActiveRound = stats.rounds[stats.rounds.length - 1];
    let popupContent = `<h2>${planetName} - Units (${stats.relic})</h2>`;
    if (stats.units.length > 0) {
        popupContent += '<ul>';
        const unitsForDisplay = stats.units.filter(unit => {
            if (unit.assignedPlayerName && unit.assignedInRound === currentRound) {
                return true;
            }
            // Show unassigned units that are rolling over (not assigned yet, and planet is active in a future round)
            if (!unit.assignedPlayerName && currentRound < lastActiveRound && stats.rounds.includes(currentRound + 1)) {
                return true;
            }
            // Show unassigned units that are finally missing (last active round)
            if (!unit.assignedPlayerName && currentRound === lastActiveRound) {
                return true;
            }
            return false;
        }).sort((a, b) => a.name.localeCompare(b.name));


        unitsForDisplay.forEach(unit => {
            let statusText = '';

            if (unit.assignedPlayerName && unit.assignedInRound === currentRound) {
                statusText = ` - ${unit.assignedPlayerName}`;
            } else if (!unit.assignedPlayerName && currentRound === lastActiveRound) {
                statusText = ` - <span style="color: red;">Missing</span>`;
            } else if (!unit.assignedPlayerName && currentRound < lastActiveRound && stats.rounds.includes(currentRound + 1)) {
                statusText = ` - <span style="color: green;">Rollover</span>`;
            }

            const isShip = shipBaseIds && shipBaseIds.has(unit.unitId);
            const requirementText = isShip ? '' : ` ${stats.relic}`;
            popupContent += `<li>${unit.name}${requirementText}${statusText}</li>`;
        });
        popupContent += '</ul>';
    } else {
        popupContent += '<p>No units listed for this planet.</p>';
    }
    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}

export function showMissingUnitsPopup(modal, modalBody, planetName, stats, missingUnits, shipBaseIds) {
    let popupContent = `<h2>${planetName} - Missing Units</h2>`;
    if (missingUnits.length > 0) {
        popupContent += '<ul>';
        missingUnits.sort((a, b) => a.name.localeCompare(b.name));
        missingUnits.forEach(unit => {
            const isShip = shipBaseIds && shipBaseIds.has(unit.unitId);
            const requirementText = isShip ? '' : ` (${stats.relic})`;
            popupContent += `<li>${unit.name}${requirementText}</li>`;
        });
        popupContent += '</ul>';
    } else {
        popupContent += '<p>No missing units for this planet.</p>';
    }
    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}

export function showCandidatesPopup(modal, modalBody, planetName, stats) {
    let popupContent = `<h2>${planetName} - Candidates for Missing Units</h2>`;
    if (stats.candidates && stats.candidates.length > 0) {
        popupContent += '<ul>';
        stats.candidates.sort((a, b) => a.unitName.localeCompare(b.name));
        stats.candidates.forEach(candidate => {
            let candidateText;
            if (candidate.candidatePlayer === 'None') {
                candidateText = `<span style="color: red;">No candidate available</span>`;
            } else {
                candidateText = `${candidate.candidatePlayer} (${candidate.candidateUnitInfo})`;
            }
            popupContent += `<li><b>${candidate.unitName}</b> (Req: ${candidate.required}): ${candidateText}</li>`;
        });
        popupContent += '</ul>';
    } else {
        popupContent += '<p>No candidates found for missing units.</p>';
    }
    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}

export function showPlanetPlayersPopup(modal, modalBody, planetName, stats, round) {
    let popupContent = `<h2>${planetName} - Player Assignments (Round ${round})</h2>`;

    const assignmentsByPlayer = {};
    stats.units
        .filter(u => u.assignedInRound === round && u.assignedPlayerName)
        .forEach(u => {
            if (!assignmentsByPlayer[u.assignedPlayerName]) {
                assignmentsByPlayer[u.assignedPlayerName] = [];
            }
            assignmentsByPlayer[u.assignedPlayerName].push(u.name);
        });

    const sortedPlayers = Object.keys(assignmentsByPlayer).sort((a, b) => a.localeCompare(b));

    if (sortedPlayers.length > 0) {
        sortedPlayers.forEach(playerName => {
            const assignments = assignmentsByPlayer[playerName].sort((a, b) => a.localeCompare(b));
            popupContent += `
                <div style="margin-top: 1em;">
                    <strong>${playerName} - ${assignments.length} assignments</strong>
                    <ul style="margin-top: 0.5em;">
                        ${assignments.map(unitName => `<li>${unitName}</li>`).join('')}
                    </ul>
                </div>
            `;
        });
    } else {
        popupContent += '<p>No players assigned for this planet and round.</p>';
    }

    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}

export function showAllUnitsPopup(modal, modalBody, planetsByRound) {
    let popupContent = `<h2>All Required Units by Round</h2>`;
    for (let round = 1; round <= 6; round++) {
        const planetsInThisRound = planetsByRound[round].filter(planet => planet.rounds.includes(round));

        if (planetsInThisRound.length > 0) {
            popupContent += `<h3>Round ${round}</h3>`;
            planetsInThisRound.forEach(planet => {
                popupContent += `<h4>${planet.name} (${planet.relic})</h4><ul>`;
                const lastActiveRound = Math.max(...planet.rounds);

                const unitsForDisplay = planet.units.filter(unit => {
                    // Show units assigned in this specific round
                    if (unit.assignedPlayerName && unit.assignedInRound === round) {
                        return true;
                    }
                    // Show unassigned units that are finally missing (last active round)
                    if (!unit.assignedPlayerName && round === lastActiveRound) {
                        return true;
                    }
                    // Show unassigned units that are rolling over (not assigned yet, and planet is active in a future round)
                    if (!unit.assignedPlayerName && round < lastActiveRound && planet.rounds.includes(round + 1)) {
                        return true;
                    }
                    return false;
                }).sort((a, b) => a.name.localeCompare(b.name));

                unitsForDisplay.forEach(unit => {
                    let assignmentText = '';
                    if (unit.assignedPlayerName && unit.assignedInRound === round) {
                        assignmentText = ` - ${unit.assignedPlayerName}`;
                    } else if (!unit.assignedPlayerName && round === lastActiveRound) {
                        assignmentText = ` - <span style="color: red;">Missing</span>`;
                    } else if (!unit.assignedPlayerName && round < lastActiveRound && planet.rounds.includes(round + 1)) {
                        assignmentText = ` - <span style="color: green;">Rollover</span>`;
                    }
                    popupContent += `<li>${unit.name}${assignmentText}</li>`;
                });
                popupContent += `</ul>`;
            });
        }
    }
    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}

export function showAllMissingUnitsPopup(modal, modalBody, planetsByRound) {
    let popupContent = `<h2>All Missing Units by Round</h2>`;
    for (let round = 1; round <= 6; round++) {
        const missingInRound = planetsByRound[round].flatMap(p => p.units.filter(u => !u.assignedPlayerName));
        if (missingInRound.length > 0) {
            popupContent += `<h3>Round ${round}</h3>`;
            planetsByRound[round].forEach(planet => {
                const missingInPlanet = planet.units.filter(u => !u.assignedPlayerName);
                if (missingInPlanet.length > 0) {
                    popupContent += `<h4>${planet.name} (${planet.relic})</h4><ul>`;
                    missingInPlanet.forEach(unit => {
                        popupContent += `<li>${unit.name}</li>`;
                    });
                    popupContent += `</ul>`;
                }
            });
        }
    }
    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}

export function showAllCandidatesPopup(modal, modalBody, planetsByRound) {
    let popupContent = `<h2>All Candidates for Missing Units by Round</h2>`;
    for (let round = 1; round <= 6; round++) {
        const candidatesInRound = planetsByRound[round].flatMap(p => p.candidates || []);
        if (candidatesInRound.length > 0) {
            popupContent += `<h3>Round ${round}</h3>`;
            planetsByRound[round].forEach(planet => {
                if (planet.candidates && planet.candidates.length > 0) {
                    popupContent += `<h4>${planet.name} (${planet.relic})</h4><ul>`;
                    planet.candidates.forEach(candidate => {
                         let candidateText = (candidate.candidatePlayer === 'None')
                            ? `<span style="color: red;">No candidate available</span>`
                            : `${candidate.candidatePlayer} (${candidate.candidateUnitInfo})`;
                        popupContent += `<li><b>${candidate.unitName}</b> (Req: ${candidate.required}): ${candidateText}</li>`;
                    });
                    popupContent += `</ul>`;
                }
            });
        }
    }
    modalBody.innerHTML = popupContent;
    modal.style.display = 'block';
}
