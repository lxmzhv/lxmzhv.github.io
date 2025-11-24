export function renderPlanetConfigTable(planetStats, container, table, onCheckboxChange) {
    if (!container || Object.keys(planetStats).length === 0) return;

    const planets = Object.values(planetStats).map(p => ({...p}));
    const alignmentOrder = { 'DS': 1, 'Mix': 2, 'LS': 3 };
    planets.sort((a, b) => {
        if (a.phase !== b.phase) return a.phase - b.phase;
        return (alignmentOrder[a.alignment] || 99) - (alignmentOrder[b.alignment] || 99);
    });

    let tableHTML = `
        <thead>
            <tr>
                <th style="min-width: 60px;">Round</th>
                ${planets.map(p => `<th title="${p.alignment} - Phase ${p.phase}">${p.name}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
    `;

    for (let round = 1; round <= 6; round++) {
        tableHTML += `<tr><td>${round}</td>`;
        planets.forEach(planet => {
            const planetNameId = planet.name.replace(/["\s-]/g, '_');
            const checkboxId = `cfg-chk-${round}-${planetNameId}`;
            tableHTML += `<td><input type="checkbox" id="${checkboxId}" data-round="${round}" data-planet="${planet.name}"></td>`;
        });
        tableHTML += `</tr>`;
    }
    tableHTML += `</tbody>`;

    table.innerHTML = tableHTML;

    table.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', onCheckboxChange);
    });
}

export function updatePlanetConfigUI(config, planetStats) {
    const exceptionPlanets = new Set(['Zeffo', 'Mandalor']);

    const planetsMap = new Map(Object.values(planetStats).map(p => [p.name, p]));
    const planetsByAlignmentAndPhase = {};
    for (const planet of planetsMap.values()) {
        if (exceptionPlanets.has(planet.name)) continue;
        if (!planetsByAlignmentAndPhase[planet.alignment]) {
            planetsByAlignmentAndPhase[planet.alignment] = {};
        }
        planetsByAlignmentAndPhase[planet.alignment][planet.phase] = planet;
    }

    document.querySelectorAll('#planet-config-table input[type="checkbox"]').forEach(cb => {
        const planetName = cb.dataset.planet;
        const round = parseInt(cb.dataset.round, 10);

        const lowerCasePlanetName = planetName.toLowerCase();
        const isActive = config[lowerCasePlanetName]?.includes(round) || false;
        cb.checked = isActive;
        cb.disabled = false; // Reset disabled state

        // Rule: Round 1 is fixed
        if (round === 1) {
            cb.disabled = true;
            return;
        }

        // Determine if a checkbox should be disabled
        const planet = planetsMap.get(planetName);
        const prereqPhase = planet.phase - 1;
        if (prereqPhase > 0) {
            const prereqPlanet = planetsByAlignmentAndPhase[planet.alignment]?.[prereqPhase];
            if (prereqPlanet) {
                // Check if prereq is active in previous round
                const prereqActive = config[prereqPlanet.name.toLowerCase()]?.includes(round - 1);
                // Check if this planet is already active in a previous round
                const alreadyActive = config[lowerCasePlanetName]?.includes(round - 1);

                if (!alreadyActive && !prereqActive) {
                    cb.disabled = true; // Cannot unlock without prereq
                }
            }
        }

        // Check for locking
        for (const p of planetsMap.values()) {
            if (exceptionPlanets.has(p.name)) continue;
            if (p.alignment === planet.alignment && p.phase === planet.phase + 1) {
                const lockingPlanet = p;
                const unlockRound = config[lockingPlanet.name.toLowerCase()]?.[0];
                if (unlockRound && round >= unlockRound) {
                    cb.disabled = true;
                }
            }
        }
    });
}

export function validatePlanetConfig(currentConfig, planetStats) {
    const exceptionPlanets = new Set(['Zeffo', 'Mandalor']);

    // 2. Apply rules sequentially to correct the state
    const planetsMap = new Map(Object.values(planetStats).map(p => [p.name, p]));
    const planetsByAlignmentAndPhase = {};
    for (const planet of planetsMap.values()) {
        if (exceptionPlanets.has(planet.name)) continue;
        if (!planetsByAlignmentAndPhase[planet.alignment]) {
            planetsByAlignmentAndPhase[planet.alignment] = {};
        }
        planetsByAlignmentAndPhase[planet.alignment][planet.phase] = planet;
    }

    // Rule: Round 1 is always fixed
    planetsMap.forEach(p => {
        const isR1Planet = ['Mustafar', 'Corellia', 'Coruscant'].includes(p.name);
        if (!currentConfig[p.name]) currentConfig[p.name] = {};
        currentConfig[p.name][1] = isR1Planet;
    });

    for (let i = 0; i < 6; i++) { // 6 passes should be enough for changes to propagate
        // Rule: Consecutive rounds (if a gap exists, uncheck everything after the gap)
        planetsMap.forEach(p => {
            let firstActive = 0;
            for(let r = 1; r <= 6; r++) {
                if (currentConfig[p.name]?.[r]) {
                    firstActive = r;
                    break;
                }
            }

            if (firstActive > 0) {
                let gapFound = false;
                for (let r = firstActive + 1; r <= 6; r++) {
                    if (!currentConfig[p.name]?.[r-1] && currentConfig[p.name]?.[r]) {
                        gapFound = true;
                    }
                    if (gapFound) {
                        if (currentConfig[p.name]) currentConfig[p.name][r] = false;
                    }
                }
            }
        });

        // Rule: Unlocking (a planet can only be active if its prereq was active in the previous round)
        for (let r = 2; r <= 6; r++) {
            planetsMap.forEach(p => {
                const isFirstActive = currentConfig[p.name]?.[r] && !currentConfig[p.name]?.[r-1];
                if (isFirstActive) {
                    const prereqPhase = p.phase - 1;
                    if (prereqPhase > 0) {
                        const prereqPlanet = planetsByAlignmentAndPhase[p.alignment]?.[prereqPhase];
                        if (prereqPlanet && !currentConfig[prereqPlanet.name]?.[r-1]) {
                            if (currentConfig[p.name]) currentConfig[p.name][r] = false; // Prereq not met, deactivate
                        }
                    }
                }
            });
        }

        // Rule: Locking (when a planet unlocks, its prereq is locked out from that round onwards)
        planetsMap.forEach(p => {
            if (exceptionPlanets.has(p.name)) return;
            const prereqPhase = p.phase - 1;
            if (prereqPhase > 0) {
                const prereqPlanet = planetsByAlignmentAndPhase[p.alignment]?.[prereqPhase];
                if (prereqPlanet) {
                    for (let r = 2; r <= 6; r++) {
                        const isFirstActive = currentConfig[p.name]?.[r] && !currentConfig[p.name]?.[r-1];
                        if (isFirstActive) {
                            for (let lockRound = r; lockRound <= 6; lockRound++) {
                                if (currentConfig[prereqPlanet.name]) currentConfig[prereqPlanet.name][lockRound] = false;
                            }
                        }
                    }
                }
            }
        });
    }
    
    return currentConfig;
}
