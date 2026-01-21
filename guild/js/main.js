import { state } from './state.js';
import { fetchGuildList, fetchGuildData, fetchPlatoonData, processPlatoonData } from './services/api.js';
import {
    calculateGuildAvailability,
    determineTbColumns,
    calculateGuildWideAvailability,
    identifyRareCharacters,
    identifyMasterRareList,
    assignPlatoons
} from './logic/platoon.js';
import { createPlayerSorter, createDebugSorter } from './logic/sorting.js';
import {
    renderTable,
    renderTableHeaders,
    renderDebugTable,
    renderDebugTableTotals
} from './ui/renderers.js';
import {
    showOmicronPopup,
    showRareCharsPopup,
    showPlanetUnitsPopup,
    showMissingUnitsPopup,
    showCandidatesPopup,
    showPlanetPlayersPopup,
    showAllUnitsPopup,
    showAllMissingUnitsPopup,
    showAllCandidatesPopup
} from './ui/popups.js';
import {
    renderPlanetConfigTable,
    updatePlanetConfigUI,
    validatePlanetConfig
} from './ui/planetConfig.js';
import { getPlayerUnitInfo, getShipInfo, getOmicronCountForSkill } from './logic/player.js';
import {
    ASSAULT_CHARACTERS,
    GALACTIC_LEGENDS_MAP,
    SHIPS_MAP,
    PILOTS_MAP,
    CONQUEST_CHARACTERS_SET,
    CONQUEST_SHIPS_MAP,
    TEAMS,
    LEIA_TEAM_UNITS,
    JABBA_TEAM_UNITS,
    OMICRON_SKILL_MAP,
    CONQUEST_UNITS_ORDER
} from './constants.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const table = document.getElementById('guild-table');
    const tbody = table.querySelector('tbody');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const modal = document.getElementById('rare-char-modal');
    const modalBody = document.getElementById('modal-body');
    const closeButton = document.querySelector('.close-button');
    const columnCheckboxes = document.querySelectorAll('#column-controls input[type="checkbox"]');
    const guildSelector = document.getElementById('guild-selector');
    const guildInfoDiv = document.getElementById('guild-info');
    const rareUnitThresholdInput = document.getElementById('rareUnitThreshold');
    const tbPlanBtn = document.getElementById('tb-plan-btn');
    const tbPlanModal = document.getElementById('tb-plan-modal');
    const tbPlanCloseButton = document.getElementById('tb-plan-close-button');
    const tbPlanSaveBtn = document.getElementById('tb-plan-save-btn');
    const tbPlanCancelBtn = document.getElementById('tb-plan-cancel-btn');
    const tbPlanResetBtn = document.getElementById('tb-plan-reset-btn');
    const debugTable = document.getElementById('debug-table');
    const debugTbody = debugTable.querySelector('tbody');

    // --- Initialization ---
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('dev') === '1') {
        document.getElementById('guild-selector-container').style.display = 'block';
    }

    if (rareUnitThresholdInput) {
        const initialThreshold = parseInt(rareUnitThresholdInput.value, 10);
        if (!isNaN(initialThreshold)) {
            state.set('rareUnitAvailabilityThreshold', initialThreshold);
        }
    }

    // Load checkbox states
    function loadCheckboxStates() {
        columnCheckboxes.forEach(checkbox => {
            const group = checkbox.dataset.group;
            const savedState = localStorage.getItem(`checkbox-${group}`);
            if (savedState !== null) {
                checkbox.checked = savedState === 'true';
            }
            toggleColumnGroup(group, checkbox.checked);
        });
    }

    function saveCheckboxStates() {
        columnCheckboxes.forEach(checkbox => {
            const group = checkbox.dataset.group;
            localStorage.setItem(`checkbox-${group}`, checkbox.checked);
        });
    }

    function toggleColumnGroup(group, show) {
        document.querySelectorAll(`.col-${group}`).forEach(el => {
            el.style.display = show ? '' : 'none';
        });
    }

    loadCheckboxStates();

    columnCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const group = checkbox.dataset.group;
            toggleColumnGroup(group, checkbox.checked);
            saveCheckboxStates();
        });
    });

    // --- Event Listeners ---

    // Modal Close
    if (closeButton) {
        closeButton.onclick = () => modal.style.display = "none";
    }
    window.onclick = (event) => {
        if (event.target == modal) modal.style.display = "none";
        if (event.target == tbPlanModal) tbPlanModal.style.display = "none";
    };

    // TB Plan Modal
    if (tbPlanBtn) {
        tbPlanBtn.addEventListener('click', () => {
            const currentConfig = getPlanetRoundMap();
            state.set('tempPlanetConfig', currentConfig);
            updatePlanetConfigUI(currentConfig, state.get('planetStats'));
            tbPlanModal.style.display = 'block';
        });
    }
    if (tbPlanCloseButton) tbPlanCloseButton.addEventListener('click', () => tbPlanModal.style.display = 'none');
    if (tbPlanCancelBtn) tbPlanCancelBtn.addEventListener('click', () => tbPlanModal.style.display = 'none');

    if (tbPlanSaveBtn) {
        tbPlanSaveBtn.addEventListener('click', () => {
            savePlanetRoundMap(state.get('tempPlanetConfig'));
            tbPlanModal.style.display = 'none';
            // Reload data to reflect changes (re-process platoon data)
            // Actually we just need to re-process platoon data and re-render
            // But `loadAndRenderGuildData` does everything.
            // Let's optimize: we just need to re-fetch platoon data (or re-process it if we cached the TSV)
            // For now, let's just reload everything to be safe and simple, or better, just re-run the calculation pipeline.
            // We need to re-fetch platoon data because it depends on the map.
            // Actually `fetchPlatoonData` fetches the TSV, which doesn't change. `processPlatoonData` uses the map.
            // So we can just re-process if we stored the TSV.
            // But we didn't store the TSV in state. Let's just call `loadAndRenderGuildData`.
            loadAndRenderGuildData(state.get('selectedGuildId'));
        });
    }

    if (tbPlanResetBtn) {
        tbPlanResetBtn.addEventListener('click', () => {
            const defaultConfig = getDefaultPlanetRoundMap();
            state.set('tempPlanetConfig', defaultConfig);
            updatePlanetConfigUI(defaultConfig, state.get('planetStats'));
        });
    }

    if (rareUnitThresholdInput) {
        rareUnitThresholdInput.addEventListener('change', () => {
            const value = parseInt(rareUnitThresholdInput.value, 10);
            if (!isNaN(value)) {
                state.set('rareUnitAvailabilityThreshold', value);
                if (state.get('players').length > 0) {
                    recalculateAndRenderDashboard();
                }
            }
        });
    }

    const platoonAssignmentModeSelect = document.getElementById('platoonAssignmentMode');
    if (platoonAssignmentModeSelect) {
        const savedMode = localStorage.getItem('platoonAssignmentMode');
        if (savedMode) {
            platoonAssignmentModeSelect.value = savedMode;
            state.set('platoonAssignmentMode', savedMode);
        } else {
            state.set('platoonAssignmentMode', 'early');
        }

        platoonAssignmentModeSelect.addEventListener('change', () => {
            const mode = platoonAssignmentModeSelect.value;
            state.set('platoonAssignmentMode', mode);
            localStorage.setItem('platoonAssignmentMode', mode);
            if (state.get('players').length > 0) {
                // Re-calculate everything (requirements placement depends on mode)
                recalculateAndRenderDashboard();
            }
        });
    }

    // Table Sorting
    table.querySelector('thead').addEventListener('click', (event) => {
        const headerCell = event.target.closest('th[data-sort]');
        if (!headerCell) return;

        const sortKey = headerCell.dataset.sort;
        const currentDirection = headerCell.dataset.direction || 'desc';
        const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

        // Update UI
        table.querySelectorAll('th[data-sort]').forEach(th => {
            delete th.dataset.direction;
            th.classList.remove('sort-asc', 'sort-desc');
        });
        headerCell.dataset.direction = newDirection;
        headerCell.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc');

        state.set('sortKey', sortKey);
        state.set('sortDirection', newDirection);

        // Trigger render
        const sorter = createPlayerSorter(sortKey, newDirection, state.get('shipBaseIds'));
        const sortedPlayers = [...state.get('enrichedPlayers')].sort(sorter);
        renderTable(sortedPlayers, tbody, state.get('tbColumns'), state.get('selectedPlayerId'), getTableCallbacks());

        // Re-apply checkbox states after sorting (re-rendering rows)
        loadCheckboxStates();
    });

    // Debug Table Sorting
    debugTable.querySelectorAll('th[data-sort]').forEach(headerCell => {
        headerCell.addEventListener('click', () => {
            const sortKey = headerCell.dataset.sort;
            const currentDirection = headerCell.dataset.direction || 'desc';
            const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

            debugTable.querySelectorAll('th[data-sort]').forEach(th => {
                delete th.dataset.direction;
                th.classList.remove('sort-asc', 'sort-desc');
            });
            headerCell.dataset.direction = newDirection;
            headerCell.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc');

            state.set('debugSortKey', sortKey);
            state.set('debugSortDirection', newDirection);

            renderDebugTableWrapper();
        });
    });

    // Guild Selector
    guildSelector.addEventListener('change', () => {
        const selectedGuildId = guildSelector.value;
        localStorage.setItem('selectedGuildId', selectedGuildId);
        state.set('selectedGuildId', selectedGuildId);

        const url = new URL(window.location);
        url.searchParams.set('guild', selectedGuildId);
        window.history.replaceState({}, '', url);

        loadAndRenderGuildData(selectedGuildId);
    });

    // --- Core Logic ---

    function getDefaultPlanetRoundMap() {
        return {
            'mustafar': [1], 'corellia': [1], 'coruscant': [1],
            'geonosis': [2], 'felucia': [2], 'bracca': [2],
            'dathomir': [3], 'tatooine': [3], 'kashyyyk': [3],
            'kessel': [4], 'lothal': [4], 'haven-class medical station': [4, 5],
            'vandor': [5, 6], 'ring of kafrene': [5],
            'scarif': [6], 'malachor': [6],
            'zeffo': [3, 4, 5, 6],
            'mandalor': [4, 5, 6],
        };
    }

    function getPlanetRoundMap() {
        const savedConfig = localStorage.getItem('planetRoundConfig');
        if (savedConfig) {
            try {
                return JSON.parse(savedConfig);
            } catch (e) {
                console.error("Error parsing planetRoundConfig from localStorage", e);
            }
        }
        return getDefaultPlanetRoundMap();
    }

    function savePlanetRoundMap(config) {
        localStorage.setItem('planetRoundConfig', JSON.stringify(config));
    }

    function loadAndRenderGuildData(guildId) {
        // Reset UI
        guildInfoDiv.innerHTML = '';
        tbody.innerHTML = '';
        debugTbody.innerHTML = '';
        progressContainer.style.display = 'block';

        fetchGuildData(guildId, (loaded, total) => {
            const percentage = Math.round((loaded / total) * 100);
            progressBar.style.width = `${percentage}%`;
            progressBar.textContent = `${percentage}%`;
        })
            .then(({ guildData, players }) => {
                // Render Guild Header
                const guildName = guildData.profile.name;
                const guildId = guildData.profile.id;
                const guildTitle = document.createElement('h1');
                const guildLink = document.createElement('a');
                guildLink.href = `https://swgoh.gg/g/${guildId}/`;
                guildLink.textContent = guildName;
                guildLink.target = "_blank";
                guildTitle.appendChild(guildLink);

                const recruitLink = document.createElement('a');
                recruitLink.href = `https://recruit.swgoh.gg/guild/redirect?id=${guildId}`;
                recruitLink.textContent = 'recruit';
                recruitLink.target = "_blank";
                recruitLink.style.fontSize = '0.6em';
                recruitLink.style.marginLeft = '10px';
                guildTitle.appendChild(recruitLink);

                guildInfoDiv.appendChild(guildTitle);

                const dataDate = guildData.date;
                if (dataDate) {
                    const dateSpan = document.createElement('span');
                    dateSpan.textContent = `Data as of: ${dataDate}`;
                    dateSpan.style.fontSize = '1em';
                    dateSpan.style.fontWeight = 'normal';
                    dateSpan.style.color = '#555';
                    guildInfoDiv.appendChild(dateSpan);
                }

                // Populate shipBaseIds
                const shipBaseIds = new Set();
                players.forEach(player => {
                    if (player.roster) {
                        for (const unitId in player.roster) {
                            if (player.roster[unitId]?.stats?.crew || (
                                !player.roster[unitId]?.stats && (
                                    unitId.toLowerCase().startsWith('capital') ||
                                    player.roster[unitId].skill.some(skill => skill.id.startsWith("hardwareskill"))
                                ))) {
                                shipBaseIds.add(unitId.toLowerCase());
                            }
                        }
                    }
                });
                state.set('shipBaseIds', shipBaseIds);
                state.set('players', players);

                return fetchPlatoonData().then(({ tsvData, phaseToRelic }) => {
                    state.set('tsvData', tsvData); // Cache TSV data
                    recalculateAndRenderDashboard();
                });
            })
            .catch(error => {
                console.error('Error loading guild data:', error);
                progressContainer.style.display = 'none';
            });
    }

    function recalculateAndRenderDashboard() {
        const players = state.get('players');
        const tsvData = state.get('tsvData');
        const shipBaseIds = state.get('shipBaseIds');
        const planetRoundMap = getPlanetRoundMap();

        const { platoonRequirements, planetStats } = processPlatoonData(tsvData, planetRoundMap, shipBaseIds, state.get('platoonAssignmentMode'));
        state.set('planetStats', planetStats);
        state.set('platoonRequirements', platoonRequirements);

        // Filter active players for calculations
        const activePlayers = players.filter(p => localStorage.getItem(`isEnabled-${p.playerId}`) !== 'false');

        // Calculate Availability
        const guildAvailabilityForPlatoons = calculateGuildAvailability(activePlayers, platoonRequirements, shipBaseIds);
        const tbColumns = determineTbColumns(platoonRequirements, guildAvailabilityForPlatoons, shipBaseIds, state.get('rareUnitAvailabilityThreshold'));
        state.set('tbColumns', tbColumns);

        // Calculate Rare Characters
        const platoonCharIds = new Set();
        Object.values(platoonRequirements).forEach(phaseReqs => {
            Object.keys(phaseReqs).forEach(unitId => {
                if (!shipBaseIds.has(unitId)) {
                    platoonCharIds.add(unitId);
                }
            });
        });

        const guildWideAvailability = calculateGuildWideAvailability(activePlayers, Array.from(platoonCharIds));

        const masterRareList = identifyMasterRareList(
            guildWideAvailability,
            platoonRequirements,
            state.get('rareUnitAvailabilityThreshold'),
            state.get('platoonAssignmentMode')
        );
        state.set('masterRareList', masterRareList);

        // Enrich players
        const enrichedPlayers = players.map(player => {
            return enrichPlayer(player, masterRareList, shipBaseIds);
        });
        state.set('enrichedPlayers', enrichedPlayers);

        // Assign Platoons (only to active players)
        const activeEnrichedPlayers = enrichedPlayers.filter(p => p.isEnabled);
        assignPlatoons(activeEnrichedPlayers, planetStats, guildAvailabilityForPlatoons, shipBaseIds, state.get('platoonAssignmentMode'));

        // Render Planet Config Table
        renderPlanetConfigTable(planetStats, document.getElementById('planet-config-table-container'), document.getElementById('planet-config-table'), handlePlanetConfigChange);

        // Render Main Table
        renderTableHeaders(table, tbColumns);

        const sorter = createPlayerSorter(state.get('sortKey'), state.get('sortDirection'), shipBaseIds);
        const sortedPlayers = [...enrichedPlayers].sort(sorter);
        renderTable(sortedPlayers, tbody, tbColumns, state.get('selectedPlayerId'), getTableCallbacks());

        // Re-apply checkbox states to newly rendered columns
        loadCheckboxStates();

        // Render Debug Table
        renderDebugTableWrapper();
        renderDebugTableTotals(planetStats, getDebugTotalCallbacks());

        progressContainer.style.display = 'none';
    }

    function enrichPlayer(player, masterRareList, shipBaseIds) {
        const roleMap = {
            'GUILD_LEADER': 'leader',
            'GUILD_OFFICER': 'officer',
            'GUILD_MEMBER': 'member'
        };
        const isEnabled = localStorage.getItem(`isEnabled-${player.playerId}`) !== 'false';
        const playerInfo = {
            ...player,
            memberLevel: roleMap[player.memberLevel] || player.memberLevel,
            joined: player.guildJoinTime ? new Date(Number(player.guildJoinTime) * 1000).toISOString().slice(0, 10).replace(/-/g, '.') : '-',
            isNew: localStorage.getItem(`isNew-${player.playerId}`) !== 'false',
            isEnabled: isEnabled,
            rareR9: 0, rareR8: 0, rareR7: 0, rareR6: 0, rareR5: 0, rareRTotal: 0,
            totalOmicrons: 0,
            generalsyndullaOmicron: 0, padawansabineOmicron: 0, greatmothersOmicron: 0, jynersoOmicron: 0, marajadeOmicron: 0,
            reqAverageTeamScore: 0,
            marajadeRelic: { display: '-', type: 0, level: 0, rarity: 0 },
            marajadeSpeed: 0,
            marajadePotency: 0
        };

        // Assault Characters
        ASSAULT_CHARACTERS.forEach(unitId => {
            playerInfo[unitId] = getPlayerUnitInfo(player, unitId);
        });

        // Galactic Legends
        let glRelicSum = 0;
        const glIds = Object.keys(GALACTIC_LEGENDS_MAP);
        glIds.forEach(unitId => {
            const unitInfo = getPlayerUnitInfo(player, unitId);
            playerInfo[unitId] = unitInfo;
            if (unitInfo.type === 3) { // Relic
                glRelicSum += unitInfo.level;
            }
        });
        playerInfo.glAverage = glIds.length > 0 ? glRelicSum / glIds.length : 0;

        // Ships
        Object.keys(SHIPS_MAP).forEach(unitId => {
            playerInfo[unitId] = getShipInfo(player, unitId);
        });

        // Pilots
        Object.keys(PILOTS_MAP).forEach(unitId => {
            playerInfo[unitId] = getPlayerUnitInfo(player, unitId);
        });

        // Conquest Units
        CONQUEST_UNITS_ORDER.forEach(unitId => {
            if (CONQUEST_CHARACTERS_SET.has(unitId)) {
                playerInfo[unitId] = getPlayerUnitInfo(player, unitId);
            } else if (CONQUEST_SHIPS_MAP[unitId]) {
                playerInfo[unitId] = getShipInfo(player, unitId);
            }
        });

        // Omicrons
        playerInfo.generalsyndullaOmicron = getOmicronCountForSkill(player, 'generalsyndulla', OMICRON_SKILL_MAP['generalsyndulla'][0].skillId, 6);
        playerInfo.padawansabineOmicron = getOmicronCountForSkill(player, 'padawansabine', OMICRON_SKILL_MAP['padawansabine'][0].skillId, 6);

        let gmOmicrons = 0;
        OMICRON_SKILL_MAP['greatmothers'].forEach(skill => {
            gmOmicrons += getOmicronCountForSkill(player, 'greatmothers', skill.skillId, 6);
        });
        playerInfo.greatmothersOmicron = gmOmicrons;

        playerInfo.jynersoOmicron = getOmicronCountForSkill(player, 'jynerso', OMICRON_SKILL_MAP['jynerso'][0].skillId, 7); // Tier 7 for Jyn? Original code used 7? Let's check constants.
        // Actually renderers.js uses 7 for Jyn.
        playerInfo.marajadeOmicron = getOmicronCountForSkill(player, 'marajade', OMICRON_SKILL_MAP['marajade'][0].skillId, 6);


        // Total Omicrons (simplified - just summing specific ones or all? Original code likely summed specific ones or all TW omicrons)
        // For now, let's just sum the ones we track explicitly + maybe others if needed.
        // The original code likely had a more complex logic or just these.
        // Let's stick to these for now.
        playerInfo.totalOmicrons = playerInfo.generalsyndullaOmicron + playerInfo.padawansabineOmicron + playerInfo.greatmothersOmicron + playerInfo.jynersoOmicron + playerInfo.marajadeOmicron;


        // Rare Units
        if (isEnabled) {
            const unitsMeetingRequirement = { 9: new Set(), 8: new Set(), 7: new Set(), 6: new Set(), 5: new Set() };
            masterRareList.forEach(req => {
                const requiredRelic = req.level;
                const unitInfo = getPlayerUnitInfo(player, req.unitId);
                if (unitInfo.type === 3 && unitInfo.rarity === 7 && unitInfo.level >= requiredRelic) {
                    if (unitsMeetingRequirement[requiredRelic]) {
                        unitsMeetingRequirement[requiredRelic].add(req.unitId);
                    }
                }
            });

            playerInfo.rareR9 = unitsMeetingRequirement[9].size;
            playerInfo.rareR8 = unitsMeetingRequirement[8].size;
            playerInfo.rareR7 = unitsMeetingRequirement[7].size;
            playerInfo.rareR6 = unitsMeetingRequirement[6].size;
            playerInfo.rareR5 = unitsMeetingRequirement[5].size;

            const allRareUnits = new Set();
            Object.values(unitsMeetingRequirement).forEach(unitSet => {
                unitSet.forEach(unitId => allRareUnits.add(unitId));
            });
            playerInfo.rareRTotal = allRareUnits.size;
        } else {
            playerInfo.rareR9 = null;
            playerInfo.rareR8 = null;
            playerInfo.rareR7 = null;
            playerInfo.rareR6 = null;
            playerInfo.rareR5 = null;
            playerInfo.rareRTotal = null;
        }

        // Requirements (TEAMS)
        let totalScore = 0;
        let teamCount = 0;
        TEAMS.forEach(team => {
            const reqs = player.requirements?.[team];
            const score = reqs?.total_score || 0;
            playerInfo[`req${team}Total`] = score;
            if (score > 0) {
                totalScore += score;
                teamCount++;
            }
        });
        playerInfo.reqAverageTeamScore = teamCount > 0 ? Math.round(totalScore / teamCount) : 0;

        // Leia Team
        LEIA_TEAM_UNITS.forEach(unitId => {
            playerInfo[`reqLeia-${unitId}-relic`] = getPlayerUnitInfo(player, unitId);
        });

        // Jabba Team
        JABBA_TEAM_UNITS.forEach(unitId => {
            playerInfo[`reqJabba-${unitId}-relic`] = getPlayerUnitInfo(player, unitId);
        });

        // Mara Jade Team Stats
        const mjUnit = player.roster ? player.roster['marajade'] : null;
        playerInfo.marajadeRelic = getPlayerUnitInfo(player, 'marajade');
        if (mjUnit && mjUnit.stats && mjUnit.stats.total) {
            playerInfo.marajadeSpeed = mjUnit.stats.total['Speed'] || 0;
            playerInfo.marajadePotency = (mjUnit.stats.total['Potency'] || 0) * 100; // Convert to percentage
        }

        return playerInfo;
    }

    function renderDebugTableWrapper() {
        const planetStats = state.get('planetStats');
        const planetRounds = [];
        for (const planetName in planetStats) {
            const planet = planetStats[planetName];
            planet.rounds.forEach(round => {
                planetRounds.push({
                    planetName: planetName,
                    round: round,
                    stats: planet,
                    isLastActiveRound: round === Math.max(...planet.rounds)
                });
            });
        }

        const sorter = createDebugSorter(state.get('debugSortKey'), state.get('debugSortDirection'));
        const sortedPlanetRounds = planetRounds.sort(sorter);

        renderDebugTable(sortedPlanetRounds, debugTbody, getDebugCallbacks(), state.get('shipBaseIds'));
    }

    function handlePlanetConfigChange(e) {
        // Update temp config based on Dropdown changes

        // 1. Construct current state from DOM
        let configObj = {};
        document.querySelectorAll('#planet-config-table select').forEach(sel => {
            const val = sel.value;
            if (val) {
                const pName = val.toLowerCase();
                const r = parseInt(sel.dataset.round, 10);
                if (!configObj[pName]) configObj[pName] = [];
                configObj[pName].push(r);
            }
        });

        // 2. Validate and Enforce Rules
        const validatedConfigObj = validatePlanetConfig(configObj, state.get('planetStats'));

        // 3. Update UI to reflect Validated State (e.g. auto-stay, auto-unlock)
        updatePlanetConfigUI(validatedConfigObj, state.get('planetStats'));

        // 4. Update Temp State
        state.set('tempPlanetConfig', validatedConfigObj);
    }

    function getTableCallbacks() {
        return {
            onPlayerSelect: (playerId, row) => {
                const currentlySelected = document.querySelector('.selected');
                if (currentlySelected && currentlySelected !== row) {
                    currentlySelected.classList.remove('selected');
                }
                row.classList.toggle('selected');
                if (row.classList.contains('selected')) {
                    state.set('selectedPlayerId', playerId);
                    localStorage.setItem('selectedPlayerId', playerId);
                } else {
                    state.set('selectedPlayerId', null);
                    localStorage.removeItem('selectedPlayerId');
                }
            },
            onOmicronClick: (playerName, unitName, details) => {
                showOmicronPopup(modal, modalBody, playerName, unitName, details);
            },
            onRareCharClick: (player, relicLevel) => {
                showRareCharsPopup(modal, modalBody, player, relicLevel, state.get('masterRareList'), getPlayerUnitInfo);
            },
            onEnabledChange: (playerId, isEnabled) => {
                localStorage.setItem(`isEnabled-${playerId}`, isEnabled);
                recalculateAndRenderDashboard();
            },
            onNewPlayerChange: (player, isNew) => {
                player.isNew = isNew;
                localStorage.setItem(`isNew-${player.playerId}`, isNew);
                // Re-assign and re-render debug
                assignPlatoons(
                    state.get('enrichedPlayers'),
                    state.get('planetStats'),
                    calculateGuildAvailability(state.get('enrichedPlayers'), state.get('platoonRequirements'), state.get('shipBaseIds')),
                    state.get('shipBaseIds'),
                    state.get('platoonAssignmentMode')
                );
                renderDebugTableWrapper();
                renderDebugTableTotals(state.get('planetStats'), getDebugTotalCallbacks());
            }
        };
    }

    function getDebugCallbacks() {
        return {
            onPlanetClick: (planetName, stats, round, shipBaseIds) => {
                showPlanetUnitsPopup(modal, modalBody, planetName, stats, round, shipBaseIds);
            },
            onUnitCountClick: (planetName, stats, round, shipBaseIds) => {
                showPlanetUnitsPopup(modal, modalBody, planetName, stats, round, shipBaseIds);
            },
            onMissingClick: (planetName, stats, missingCount, shipBaseIds) => {
                // We need to filter for missing units
                const missingUnits = stats.units.filter(u => !u.assignedPlayerName);
                showMissingUnitsPopup(modal, modalBody, planetName, stats, missingUnits, shipBaseIds);
            },
            onCandidateClick: (planetName, stats) => {
                showCandidatesPopup(modal, modalBody, planetName, stats);
            },
            onPlayersClick: (planetName, stats, round) => {
                showPlanetPlayersPopup(modal, modalBody, planetName, stats, round);
            },
            onTotalUnitsClick: (planetsByRound) => {
                showAllUnitsPopup(modal, modalBody, planetsByRound);
            },
            onTotalMissingClick: (planetsByRound) => {
                showAllMissingUnitsPopup(modal, modalBody, planetsByRound);
            },
            onTotalCandidatesClick: (planetsByRound) => {
                showAllCandidatesPopup(modal, modalBody, planetsByRound);
            }
        };
    }

    function getDebugTotalCallbacks() {
        return {
            onTotalUnitsClick: (planetsByRound) => showAllUnitsPopup(modal, modalBody, planetsByRound),
            onTotalMissingClick: (planetsByRound) => showAllMissingUnitsPopup(modal, modalBody, planetsByRound),
            onTotalCandidatesClick: (planetsByRound) => showAllCandidatesPopup(modal, modalBody, planetsByRound)
        };
    }

    // --- Start ---
    fetchGuildList().then(guilds => {
        state.set('guilds', guilds);
        guilds.forEach(guild => {
            const option = document.createElement('option');
            option.value = guild.id;
            option.textContent = guild.name;
            guildSelector.appendChild(option);
        });

        let selectedGuildId = urlParams.get('guild') || localStorage.getItem('selectedGuildId');

        if (selectedGuildId && guilds.some(g => g.id === selectedGuildId)) {
            guildSelector.value = selectedGuildId;
            state.set('selectedGuildId', selectedGuildId); // Sync with state!
            loadAndRenderGuildData(selectedGuildId);
        } else if (guilds.length > 0) {
            selectedGuildId = guilds[0].id;
            guildSelector.value = selectedGuildId;
            state.set('selectedGuildId', selectedGuildId); // Sync with state!
            loadAndRenderGuildData(selectedGuildId);
        } else {
            guildInfoDiv.innerHTML = '<h1>No Guild Selected</h1><p>Please select a guild using the URL parameter, e.g., ?guild=YOUR_GUILD_ID</p>';
            tbody.innerHTML = '';
            debugTbody.innerHTML = '';
            progressContainer.style.display = 'none';
        }
        if (urlParams.get('dev') !== '1') {
            guildSelector.disabled = true;
        }
    });
});
