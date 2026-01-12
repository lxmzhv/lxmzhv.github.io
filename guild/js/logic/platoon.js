import { getPlayerUnitInfo, getShipInfo, getUnitDisplayName } from './player.js';

export function calculateGuildAvailability(players, requirements, shipBaseIds) {
    const availability = {};
    Object.values(requirements).forEach(phaseReqs => {
        Object.keys(phaseReqs).forEach(unitId => {
            if (!availability[unitId]) {
                availability[unitId] = {};
            }
            const isShip = shipBaseIds.has(unitId);
            Object.keys(phaseReqs[unitId]).forEach(level => {
                if (availability[unitId][level] === undefined) {
                    let count = 0;
                    players.forEach(player => {
                        if (isShip) {
                            const unitInfo = getShipInfo(player, unitId);
                            if (unitInfo.rarity >= level) {
                                count++;
                            }
                        } else {
                            const unitInfo = getPlayerUnitInfo(player, unitId);
                            if (unitInfo.type === 3 && unitInfo.level >= level) {
                                count++;
                            }
                        }
                    });
                    availability[unitId][level] = count;
                }
            });
        });
    });
    return availability;
}

export function determineTbColumns(requirements, availability, shipBaseIds, rareUnitAvailabilityThreshold) {
    const columns = [];
    for (const phase in requirements) {
        const phaseReqs = requirements[phase];
        const phaseColumns = [];
        for (const unitId in phaseReqs) {
            const isShip = shipBaseIds.has(unitId);
            for (const level in phaseReqs[unitId]) {
                const requiredCount = phaseReqs[unitId][level];
                const availableCount = availability[unitId]?.[level] || 0;

                if (availableCount - requiredCount <= rareUnitAvailabilityThreshold) {
                    phaseColumns.push({
                        phase: phase,
                        unitId: unitId,
                        level: level,
                        required: requiredCount,
                        available: availableCount,
                        displayName: getUnitDisplayName(unitId),
                        type: isShip ? 'ship' : 'char'
                    });
                }
            }
        }
        phaseColumns.sort((a, b) => a.displayName.localeCompare(b.displayName));
        columns.push(...phaseColumns);
    }
    return columns;
}

export function calculateGuildWideAvailability(players, platoonCharIds) {
    const availability = {};
    platoonCharIds.forEach(unitId => {
        availability[unitId] = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
        players.forEach(player => {
            const unitInfo = getPlayerUnitInfo(player, unitId);
            if (unitInfo.type === 3 && unitInfo.rarity === 7) {
                if (unitInfo.level >= 5) availability[unitId][5]++;
                if (unitInfo.level >= 6) availability[unitId][6]++;
                if (unitInfo.level >= 7) availability[unitId][7]++;
                if (unitInfo.level >= 8) availability[unitId][8]++;
                if (unitInfo.level >= 9) availability[unitId][9]++;
            }
        });
    });
    return availability;
}

export function identifyRareCharacters(availability, totalRequirements, rareUnitAvailabilityThreshold) {
    const rareCharacters = [];
    const rareCheck = new Set();

    for (const unitId in totalRequirements) {
        let usedSoFar = 0;
        for (let relic = 9; relic >= 5; relic--) {
            const requiredCount = totalRequirements[unitId][relic] || 0;
            if (requiredCount === 0) continue;

            const availableCount = availability[unitId]?.[relic] || 0;
            const correctedAvailability = availableCount - usedSoFar;

            if (correctedAvailability - requiredCount <= rareUnitAvailabilityThreshold) {
                const key = `${unitId}-${relic}`;
                if (!rareCheck.has(key)) {
                    rareCharacters.push({ unitId: unitId, level: relic, type: 'char' });
                    rareCheck.add(key);
                }
            }

            const usedForThisRelic = Math.min(Math.max(0, correctedAvailability), requiredCount);
            usedSoFar += usedForThisRelic;
        }
    }
    return rareCharacters;
}

export function assignPlatoons(players, planetStats, guildAvailability, shipBaseIds, assignmentMode = 'early') {
    // Initialize all units as unassigned and clear previous stats
    for (const planetName in planetStats) {
        const planet = planetStats[planetName];
        planet.units.forEach(unit => {
            unit.assignedPlayerName = null;
            unit.assignedInRound = null;
        });
        planet.missingCount = 0;
        planet.candidateCount = 0;
        planet.candidates = [];
    }

    // Determine round order based on mode
    const rounds = assignmentMode === 'late' ? [6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6];

    // Loop through each round to perform assignments
    for (const round of rounds) {
        const assignedUnitsThisRound = new Set(); // Tracks "playerId-unitId" for this round only.
        const playerAssignmentsCountThisRound = {}; // Tracks assignments per player, per planet for this round.

        const planetsActiveThisRound = Object.keys(planetStats)
            .filter(planetName => planetStats[planetName].rounds.includes(round));

        const unassignedUnitsForRound = [];
        planetsActiveThisRound.forEach(planetName => {
            const planet = planetStats[planetName];
            planet.units.forEach(unit => {
                if (!unit.assignedPlayerName) {
                    unassignedUnitsForRound.push({
                        unit: unit,
                        planet: planet,
                        planetName: planetName
                    });
                }
            });
        });

        unassignedUnitsForRound.sort((a, b) => {
            const relicA = parseInt(a.planet.relic.substring(1));
            const relicB = parseInt(b.planet.relic.substring(1));

            const availabilityA = guildAvailability[a.unit.unitId]?.[relicA] || 0;
            const availabilityB = guildAvailability[b.unit.unitId]?.[relicB] || 0;

            if (availabilityA !== availabilityB) {
                return availabilityA - availabilityB; // Rarest first
            }
            if (relicB !== relicA) {
                return relicB - relicA; // Higher relic first
            }
            return a.planetName.localeCompare(b.planetName); // Then by planet name
        });

        // Assignment phase for the current round
        unassignedUnitsForRound.forEach(({ unit, planet, planetName }) => {
            const relicLevel = parseInt(planet.relic.substring(1));
            const isShip = shipBaseIds.has(unit.unitId);

            let eligiblePlayers = [];
            for (const player of players) {
                const assignmentKey = `${player.playerId}-${unit.unitId}`;
                if (assignedUnitsThisRound.has(assignmentKey)) continue;

                const assignmentsOnPlanet = (playerAssignmentsCountThisRound[player.playerId] && playerAssignmentsCountThisRound[player.playerId][planetName]) || 0;
                if (assignmentsOnPlanet >= 10) continue;

                let canAssign = false;
                if (isShip) {
                    const shipInfo = getShipInfo(player, unit.unitId);
                    if (shipInfo.rarity === 7) {
                        canAssign = true;
                    }
                } else {
                    const unitInfo = getPlayerUnitInfo(player, unit.unitId);
                    if (unitInfo.type === 3 && unitInfo.level >= relicLevel) {
                        canAssign = true;
                    }
                }

                if (canAssign) {
                    eligiblePlayers.push(player);
                }
            }

            if (eligiblePlayers.length > 0) {
                const chosenPlayer = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];

                unit.assignedPlayerName = chosenPlayer.playerName;
                unit.assignedInRound = round;
                assignedUnitsThisRound.add(`${chosenPlayer.playerId}-${unit.unitId}`);

                if (!playerAssignmentsCountThisRound[chosenPlayer.playerId]) {
                    playerAssignmentsCountThisRound[chosenPlayer.playerId] = {};
                }
                if (!playerAssignmentsCountThisRound[chosenPlayer.playerId][planetName]) {
                    playerAssignmentsCountThisRound[chosenPlayer.playerId][planetName] = 0;
                }
                playerAssignmentsCountThisRound[chosenPlayer.playerId][planetName]++;
            }
        });

        // Candidate and Missing calculation phase for the current round
        const candidateUnitsThisRound = new Set();
        planetsActiveThisRound.forEach(planetName => {
            const planet = planetStats[planetName];

            // Determine the round to calculate missing units based on mode
            const targetRound = assignmentMode === 'late'
                ? Math.min(...planet.rounds)
                : Math.max(...planet.rounds);

            if (round === targetRound) {
                const missingUnits = planet.units.filter(u => !u.assignedPlayerName);
                planet.missingCount = missingUnits.length;
                const requiredRelic = parseInt(planet.relic.substring(1));

                missingUnits.forEach(missingUnit => {
                    let bestCandidate = null;
                    const isShip = shipBaseIds.has(missingUnit.unitId);

                    if (isShip) {
                        let bestShipCandidates = [];
                        let bestRarity = 0;
                        for (const player of players) {
                            if (!player.isNew) continue;
                            const candidateKey = `${player.playerId}-${missingUnit.unitId}`;
                            if (assignedUnitsThisRound.has(candidateKey) || candidateUnitsThisRound.has(candidateKey)) continue;

                            const shipInfo = getShipInfo(player, missingUnit.unitId);
                            if (shipInfo.rarity > 0) {
                                if (shipInfo.rarity > bestRarity) {
                                    bestRarity = shipInfo.rarity;
                                    bestShipCandidates = [{ player: player, rarity: shipInfo.rarity, display: shipInfo.display }];
                                } else if (shipInfo.rarity === bestRarity) {
                                    bestShipCandidates.push({ player: player, rarity: shipInfo.rarity, display: shipInfo.display });
                                }
                            }
                        }

                        if (bestShipCandidates.length > 0) {
                            const bestShipCandidate = bestShipCandidates[Math.floor(Math.random() * bestShipCandidates.length)];
                            bestCandidate = {
                                unitName: missingUnit.name,
                                required: '7*',
                                candidatePlayer: bestShipCandidate.player.playerName,
                                candidateUnitInfo: bestShipCandidate.display
                            };
                            candidateUnitsThisRound.add(`${bestShipCandidate.player.playerId}-${missingUnit.unitId}`);
                        }
                    } else { // Character
                        let bestRelicCandidates = [];
                        let bestRelicLevel = -1;
                        let bestGearCandidates = [];
                        let bestGearLevel = 0;

                        for (const player of players) {
                            if (!player.isNew) continue;
                            const candidateKey = `${player.playerId}-${missingUnit.unitId}`;
                            if (assignedUnitsThisRound.has(candidateKey) || candidateUnitsThisRound.has(candidateKey)) continue;

                            const unitInfo = getPlayerUnitInfo(player, missingUnit.unitId);
                            if (unitInfo.type === 3 && unitInfo.level < requiredRelic) {
                                if (unitInfo.level > bestRelicLevel) {
                                    bestRelicLevel = unitInfo.level;
                                    bestRelicCandidates = [{ player: player, level: unitInfo.level, display: unitInfo.display }];
                                } else if (unitInfo.level === bestRelicLevel) {
                                    bestRelicCandidates.push({ player: player, level: unitInfo.level, display: unitInfo.display });
                                }
                            } else if (unitInfo.type === 2) {
                                if (unitInfo.level > bestGearLevel) {
                                    bestGearLevel = unitInfo.level;
                                    bestGearCandidates = [{ player: player, level: unitInfo.level, display: unitInfo.display }];
                                } else if (unitInfo.level === bestGearLevel) {
                                    bestGearCandidates.push({ player: player, level: unitInfo.level, display: unitInfo.display });
                                }
                            }
                        }

                        let finalCandidatePlayer = null;
                        let finalCandidateInfo = '';
                        if (bestRelicCandidates.length > 0) {
                            const chosen = bestRelicCandidates[Math.floor(Math.random() * bestRelicCandidates.length)];
                            finalCandidatePlayer = chosen.player;
                            finalCandidateInfo = chosen.display;
                        } else if (bestGearCandidates.length > 0) {
                            const chosen = bestGearCandidates[Math.floor(Math.random() * bestGearCandidates.length)];
                            finalCandidatePlayer = chosen.player;
                            finalCandidateInfo = chosen.display;
                        }

                        if (finalCandidatePlayer) {
                            bestCandidate = {
                                unitName: missingUnit.name,
                                required: `R${requiredRelic}`,
                                candidatePlayer: finalCandidatePlayer.playerName,
                                candidateUnitInfo: finalCandidateInfo
                            };
                            candidateUnitsThisRound.add(`${finalCandidatePlayer.playerId}-${missingUnit.unitId}`);
                        }
                    }

                    if (bestCandidate) {
                        planet.candidates.push(bestCandidate);
                    } else {
                        planet.candidates.push({
                            unitName: missingUnit.name,
                            required: isShip ? '7*' : `R${requiredRelic}`,
                            candidatePlayer: 'None',
                            candidateUnitInfo: '-'
                        });
                    }
                });
                planet.candidateCount = planet.candidates.filter(c => c.candidatePlayer !== 'None').length;
            }
        });
    }
}
