import { PLANET_TRACKS, BONUS_PLANETS } from '../constants.js';

export function renderPlanetConfigTable(planetStats, container, table, onConfigChange) {
    if (!container || Object.keys(planetStats).length === 0) return;

    // Define rows: Dark, Mixed, Light, Bonus Light, Bonus Mixed
    const rows = [
        { label: 'Dark Side', trackId: 'Dark Side' },
        { label: 'Mixed', trackId: 'Mixed' },
        { label: 'Light Side', trackId: 'Light Side' },
        { label: 'Bonus Light (Zeffo)', trackId: 'Bonus Light' },
        { label: 'Bonus Mixed (Mandalor)', trackId: 'Bonus Mixed' }
    ];

    let tableHTML = `
        <thead>
            <tr>
                <th style="min-width: 150px;">Track</th>
                ${[1, 2, 3, 4, 5, 6].map(r => `<th>Round ${r}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
    `;

    rows.forEach(row => {
        tableHTML += `<tr><td style="font-weight:bold;">${row.label}</td>`;
        for (let round = 1; round <= 6; round++) {
            const selectId = `cfg-sel-${row.trackId.replace(/\s/g, '_')}-${round}`;
            tableHTML += `<td><select id="${selectId}" data-track="${row.trackId}" data-round="${round}" style="width: 100%;"></select></td>`;
        }
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody>`;
    table.innerHTML = tableHTML;

    table.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('change', onConfigChange);
    });
}

// Helper to determine available planets for a specific cell
function getAvailableOptions(trackId, round, currentConfig) {
    // Current config is map: planetName -> [rounds]
    // We need to know the state of Round R-1 to determine R.

    // Helper: isPlanetActiveInRound(planetName, r)
    const isPlanetActive = (pName, r) => currentConfig[pName.toLowerCase()]?.includes(r);

    let options = []; // Array of { value: planetName, label: planetName }

    if (trackId === 'Bonus Light' || trackId === 'Bonus Mixed') {
        const bonusPlanetName = trackId === 'Bonus Light' ? 'Zeffo' : 'Mandalor';
        const bonusInfo = BONUS_PLANETS[bonusPlanetName];

        options.push({ value: '', label: '-' }); // Always can be inactive

        // Check Unlock Condition (Parent active in R-1)
        if (round > 1 && isPlanetActive(bonusInfo.parent, round - 1)) {
            options.push({ value: bonusPlanetName, label: bonusPlanetName });
        }

        // Check Stay Condition (Self active in R-1)
        if (round > 1 && isPlanetActive(bonusPlanetName, round - 1)) {
            // If not already added
            if (!options.some(o => o.value === bonusPlanetName)) {
                options.push({ value: bonusPlanetName, label: bonusPlanetName });
            }
        }
    } else {
        // Regular Tracks
        const trackPlanets = PLANET_TRACKS[trackId];

        if (round === 1) {
            // Round 1 is fixed to the first planet
            // User requirement: "In the first round only the first 3 planets are available"
            const firstPlanet = trackPlanets[0];
            options.push({ value: firstPlanet, label: firstPlanet });
        } else {
            // Round > 1
            // Find active planet in R-1
            const activePrev = trackPlanets.find(p => isPlanetActive(p, round - 1));

            if (activePrev) {
                // Option 1: Stay
                options.push({ value: activePrev, label: activePrev });

                // Option 2: Advance (if next exists)
                const idx = trackPlanets.indexOf(activePrev);
                if (idx !== -1 && idx < trackPlanets.length - 1) {
                    const nextPlanet = trackPlanets[idx + 1];
                    options.push({ value: nextPlanet, label: nextPlanet });
                }
            } else {
                // If previous round had no active planet?
                // Should not happen in standard flow, but if user clears selection?
                // Fallback: If R-1 is empty, R is empty? 
                // Or treat as "Start"? No, can't jump.
                options.push({ value: '', label: '-' });
            }
        }
    }

    // De-duplicate (Stay + Unlock might be same logic if handling bonus, but for regular stay!=advance)
    return options;
}

export function updatePlanetConfigUI(config, planetStats) {
    // Render/Update options for all selects based on current config state
    // We must do this carefully: updating R1 might change R2 options.
    // The UI should reflect the Valid Options for the CURRENT state.
    // However, if the current selection is INVALID, we might need to reset it?
    // Let's assume validatePlanetConfig cleans up the state first.

    const rows = [
        { trackId: 'Dark Side' },
        { trackId: 'Mixed' },
        { trackId: 'Light Side' },
        { trackId: 'Bonus Light' },
        { trackId: 'Bonus Mixed' }
    ];

    rows.forEach(row => {
        for (let round = 1; round <= 6; round++) {
            const select = document.querySelector(`select[data-track="${row.trackId}"][data-round="${round}"]`);
            if (!select) continue;

            const available = getAvailableOptions(row.trackId, round, config);

            // Save current value
            // We reconstruct options every time because availability changes dynamicallly
            const currentVal = Object.keys(config).find(pName =>
                config[pName].includes(round) && (
                    (row.trackId.startsWith('Bonus') && (pName === 'zeffo' || pName === 'mandalor')) ||
                    (!row.trackId.startsWith('Bonus') && PLANET_TRACKS[row.trackId]?.includes(Object.values(planetStats).find(p => p.name.toLowerCase() === pName)?.name))
                )
            );

            // Actually, comparing lowercase keys to Title Case names in constants?
            // PLANET_TRACKS has Title Case. config keys are lower case.
            // We need a helper to match.

            // Helper to get formatted name of currently active planet for this track/round
            let activePlanetName = '';
            // For bonus tracks
            if (row.trackId === 'Bonus Light') {
                if (config['zeffo']?.includes(round)) activePlanetName = 'Zeffo';
            } else if (row.trackId === 'Bonus Mixed') {
                if (config['mandalor']?.includes(round)) activePlanetName = 'Mandalor';
            } else {
                // Regular
                const trackPlanets = PLANET_TRACKS[row.trackId];
                trackPlanets.forEach(p => {
                    if (config[p.toLowerCase()]?.includes(round)) activePlanetName = p;
                });
            }

            // Populate options
            select.innerHTML = '';
            available.forEach(opt => {
                const optEl = document.createElement('option');
                optEl.value = opt.value;
                optEl.textContent = opt.label;
                if (opt.value === activePlanetName) optEl.selected = true;
                select.appendChild(optEl);
            });

            // If activePlanetName is not in available (invalid state), select index 0?
            // validatePlanetConfig should have handled specific data validity, 
            // but if UI options don't include current value, we default to first.
            if (activePlanetName && !available.some(o => o.value === activePlanetName)) {
                // Determine sensible default?
                // Often the first option is the "safe" one (Stay or Empty).
                select.options[0].selected = true;
            }
        }
    });
}

export function validatePlanetConfig(currentConfig, planetStats) {
    // Return a clean config object ensuring validity.
    // Logic similar to getAvailableOptions but enforcing it iteratively.

    // 1. Ensure keys exist
    // 2. Iterate rounds 1 -> 6

    const validated = JSON.parse(JSON.stringify(currentConfig));
    const tracks = ['Dark Side', 'Mixed', 'Light Side'];
    const bonusTracks = ['Bonus Light', 'Bonus Mixed']; // Zeffo, Mandalor

    // Helper
    const isActive = (cfg, pName, r) => cfg[pName.toLowerCase()]?.includes(r);
    const setActive = (cfg, pName, r, val) => {
        const key = pName.toLowerCase();
        if (!cfg[key]) cfg[key] = [];
        if (val) {
            if (!cfg[key].includes(r)) cfg[key].push(r);
        } else {
            cfg[key] = cfg[key].filter(x => x !== r);
        }
    };

    // Pass 1: Regular Tracks
    tracks.forEach(track => {
        const planets = PLANET_TRACKS[track];

        // Round 1: Force first planet
        const p1 = planets[0];
        // Ensure only p1 is active for this track in R1
        planets.forEach(p => {
            if (p === p1) setActive(validated, p, 1, true);
            else setActive(validated, p, 1, false);
        });

        // Rounds 2..6
        for (let r = 2; r <= 6; r++) {
            // Find what was active in R-1
            const activePrev = planets.find(p => isActive(validated, p, r - 1));

            // Find what is requested active in R
            const activeCurr = planets.find(p => isActive(validated, p, r));

            // Determine if valid
            let isValid = false;

            if (activePrev) {
                // Valid if Stay
                if (activeCurr === activePrev) isValid = true;
                // Valid if Advance
                const idx = planets.indexOf(activePrev);
                if (idx !== -1 && idx < planets.length - 1) {
                    if (activeCurr === planets[idx + 1]) isValid = true;
                }
            }

            if (!isValid) {
                // Correct it: Default to Stay if possible, else Advance?
                // Logic: If current selection is invalid, we must pick a valid one.
                // If nothing was selected/valid, we Default to activePrev (Stay).
                // If activePrev is null (impossible due to R1 enforcement?), then empty.

                // Clear any invalid selections for this track/round
                planets.forEach(p => setActive(validated, p, r, false));

                if (activePrev) {
                    setActive(validated, activePrev, r, true); // Default to Stay
                }
            } else {
                // Ensure *only* the valid one is active? (Already checked activeCurr logic, but clean up others)
                planets.forEach(p => {
                    if (p !== activeCurr) setActive(validated, p, r, false);
                });
            }
        }
    });

    // Pass 2: Bonus Tracks
    // We do this AFTER regular because bonus depends on regular parents
    const bonuses = [
        { name: 'Zeffo', info: BONUS_PLANETS['Zeffo'] },
        { name: 'Mandalor', info: BONUS_PLANETS['Mandalor'] }
    ];

    bonuses.forEach(b => {
        // Round 1: Never active?
        setActive(validated, b.name, 1, false);

        for (let r = 2; r <= 6; r++) {
            const wasActive = isActive(validated, b.name, r - 1);
            const parentActive = isActive(validated, b.info.parent, r - 1);
            const isRequested = isActive(validated, b.name, r);

            // Valid if: (Stay: wasActive) OR (Unlock: parentActive)
            // AND isRequested (User wants it)

            // But if User requested it, and it's valid, keep it.
            // If User did NOT request it (select empty), keep it empty.
            // If User requested it, but INVALID, clear it.

            const canBeActive = wasActive || parentActive;

            if (isRequested && !canBeActive) {
                setActive(validated, b.name, r, false);
            } else if (!isRequested) {
                setActive(validated, b.name, r, false);
            }
            // If isRequested && canBeActive, leave true.
        }
    });

    // Clean up empty arrays
    Object.keys(validated).forEach(k => {
        if (validated[k].length === 0) delete validated[k];
    });

    return validated;
}
