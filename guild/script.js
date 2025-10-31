document.addEventListener('DOMContentLoaded', () => {
    const table = document.getElementById('guild-table');
    const tbody = table.querySelector('tbody');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const modal = document.getElementById('rare-char-modal');
    const modalBody = document.getElementById('modal-body');
    const closeButton = document.querySelector('.close-button');

    if(closeButton) {
        closeButton.onclick = function() {
            modal.style.display = "none";
        }
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    let players = [];
    let selectedPlayerId = null;
    let tbColumns = [];

    const platoonToRosterIdMap = {
        'arc170clonesergeant': 'clonesergeantphasei'
    };

    let shipBaseIds = new Set();

    const unitNameMap = {
        "clonesergeantphasei": "Clone Sergeant",
        "ahsokatanosjedistarfighter": "Ahsoka's Starfighter", "anakinseta2starfighter": "Anakin's Starfighter",
        "b28extinctionclassbomber": "B-28 Bomber", "btlbywingstarfighter": "BTL-B Y-wing", "biggsdarklighterxwing": "Biggs' X-wing",
        "bistansuwing": "Bistan's U-wing", "cassiansuwing": "Cassian's U-wing", "chimaera": "Chimaera",
        "clonesergeantsarc170": "Clone Sergeant's ARC-170", "comeuppance": "Comeuppance", "ebonhawk": "Ebon Hawk",
        "emperorsshuttle": "Emperor's Shuttle", "endurance": "Endurance", "executor": "Executor", "executrix": "Executrix",
        "finalizer": "Finalizer", "firstordersftiefighter": "FO SF TIE Fighter", "firstordertiefighter": "FO TIE Fighter",
        "furyclassinterceptor": "Fury-class Interceptor", "gauntletstarfighter": "Gauntlet Starfighter",
        "geonosiansoldiersstarfighter": "Geonosian Soldier's Starfighter", "geonosianspysstarfighter": "Geonosian Spy's Starfighter",
        "ghost": "Ghost", "hansmillenniumfalcon": "Han's Millennium Falcon", "homeone": "Home One", "houndstooth": "Hound's Tooth",
        "hyenabomber": "Hyena Bomber", "ig2000": "IG-2000", "imperialtiebomber": "Imperial TIE Bomber",
        "imperialtiefighter": "Imperial TIE Fighter", "jediconsularsstarfighter": "Jedi Consular's Starfighter",
        "kylorenscommandshuttle": "Kylo's Command Shuttle", "landosmillenniumfalcon": "Lando's Millennium Falcon",
        "leviathan": "Leviathan", "mg100starfortresssf17": "MG-100 StarFortress", "malevolence": "Malevolence",
        "marauder": "Marauder", "markviinterceptor": "Mark VI Interceptor", "negotiator": "Negotiator", "outrider": "Outrider",
        "phantomii": "Phantom II", "plokoonsjedistarfighter": "Plo Koon's Starfighter", "poedameronsxwing": "Poe's X-wing",
        "profundity": "Profundity", "punishingone": "Punishing One", "raddus": "Raddus", "ravensclaw": "Raven's Claw",
        "razorcrest": "Razor Crest", "rebelbwing": "B-wing", "rebelywing": "Y-wing", "resistancexwing": "Resistance X-wing",
        "rexsarc170": "Rex's ARC-170", "reysmillenniumfalcon": "Rey's Millennium Falcon", "rogueone": "Rogue One",
        "scimitar": "Scimitar", "scythe": "Scythe", "sithfighter": "Sith Fighter", "slavei": "Slave I",
        "sunfacsgeonosianstarfighter": "Sun Fac's Starfighter", "tieadvancedx1": "TIE Advanced x1", "tiedagger": "TIE Dagger",
        "tiedefender": "TIE Defender", "tieechelon": "TIE Echelon", "tiereaper": "TIE Reaper", "tiesilencer": "TIE Silencer",
        "tieininterceptorprototype": "TIE Interceptor Prototype", "umbaranstarfighter": "Umbaran Starfighter",
        "vulturedroid": "Vulture Droid", "wedgeantillesxwing": "Wedge's X-wing", "xanadublood": "Xanadu Blood",
        "glrey": "Rey", "supremeleaderkyloren": "SLKR", "grandmasterluke": "JML", "sithpalpatine": "SEE",
        "jedimasterkenobi": "JMK", "lordvader": "LV", "glleia": "Leia", "jabbathehutt": "Jabba",
        "glahsokatano": "Ahsoka", "glhondo": "Hondo", "capitalleviathan": "Levi", "capitalprofundity": "Prof",
        "capitalexecutor": "Exec", "punishingone": "PO", "marauder": "Marauder", "badbatchhunter": "Hunter",
        "badbatchtech": "Tech", "badbatchwrecker": "Wrecker", "razorcrest": "Razor", "tieinterceptor": "TIE Int",
        "commanderahsoka": "CAT", "maul": "Maul", "bobafettscion": "Boba", "darthmalgus": "Malgus",
        "trench": "Trench", "darthbane": "Bane", "queenamidala": "Amidala", "luthenrael": "Luthen",
        "ezraexile": "Ezra", "darkrey": "DRey", "sm33": "SM33", "jocastanu": "Jocasta", "mazkanata": "Maz",
        "jediknightluke": "JKL", "generalskywalker": "GAS", "wampa": "Wampa", "hermityoda": "Hermit",
        "darthrevan": "DRevan", "bastilashanfallen": "BSF", "darthmalak": "Malak", "kiadimundi": "KAM",
        "monmothma": "Mon Mothma", "chewbacca": "Chewie", "c3po": "C-3PO", "padmeamidala": "Padme",
        "grandmofftarkin": "Tarkin", "sabinewren": "Sabine", "kananjarrus": "Kanan", "herasyndulla": "Hera",
        "chopper": "Chopper", "zeborrelios": "Zeb", "bodhirook": "Bodhi", "pao": "Pao", "bistan": "Bistan",
        "cassianandor": "Cassian", "k2so": "K-2SO", "jynerso": "Jyn", "chirrutimwe": "Chirrut", "bazemalbus": "Baze",
        "dengar": "Dengar", "bossk": "Bossk", "ig88": "IG-88", "bobafett": "Boba Fett", "greedo": "Greedo",
        "gamorreanguard": "Gam Guard", "mobenfocer": "Mob Enforcer", "nightsisterspirit": "Spirit",
        "nightsisterzombie": "Zombie", "motherdalzin": "Talzin", "olddaka": "Daka", "talia": "Talia",
        "nightsisterinitiate": "Initiate", "nightsisteracolyte": "Acolyte", "rose": "Rose Tico",
        "amilynholdo": "Holdo", "reyjakku": "Scav Rey", "finn": "Finn", "poedameron": "Poe", "resistancepilot": "Res Pilot",
        "resistancetrooper": "Res Trooper", "reyjeditraining": "RJ"
    };

    function getUnitDisplayName(unitId) {
        const lowercasedUnitId = unitId.toLowerCase();
        if (unitNameMap[lowercasedUnitId]) {
            return unitNameMap[lowercasedUnitId];
        }
        // Fallback for unmapped units: capitalize first letter of each word
        return lowercasedUnitId.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    }

    function calculateGuildAvailability(players, requirements) {
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
                                const unitInfo = getGLInfo(player, unitId);
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

    function determineTbColumns(requirements, availability) {
        const columns = [];
        for (const phase in requirements) {
            const phaseReqs = requirements[phase];
            const phaseColumns = [];
            for (const unitId in phaseReqs) {
                const isShip = shipBaseIds.has(unitId);
                for (const level in phaseReqs[unitId]) {
                    const requiredCount = phaseReqs[unitId][level];
                    const availableCount = availability[unitId]?.[level] || 0;

                    if (availableCount - requiredCount <= 2) {
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

    const rankMap = {
        'GUILD_LEADER': 'leader',
        'GUILD_OFFICER': 'officer',
        'GUILD_MEMBER': 'member',
    };

    const galacticLegendsMap = {
        "glrey": "Rey",
        "supremeleaderkyloren": "SLKR",
        "grandmasterluke": "JML",
        "sithpalpatine": "SEE",
        "jedimasterkenobi": "JMK",
        "lordvader": "LV",
        "glleia": "Leia",
        "jabbathehutt": "Jabba",
        "glahsokatano": "Ahsoka",
        "glhondo": "Hondo"
    };
    const galacticLegends = Object.keys(galacticLegendsMap);

    const shipsMap = {
        "capitalleviathan": "Levi",
        "capitalprofundity": "Prof",
        "capitalexecutor": "Exec",
        "punishingone": "PO",
        "marauder": "Marauder"
    };
    const ships = Object.keys(shipsMap);

    const pilotsMap = {
        "badbatchhunter": "Hunter",
        "badbatchtech": "Tech",
        "badbatchwrecker": "Wrecker"
    };
    const pilots = Object.keys(pilotsMap);

    const conquestCharactersSet = new Set([
        "commanderahsoka",
        "maul",
        "bobafettscion",
        "darthmalgus",
        "trench",
        "darthbane",
        "queenamidala",
        "luthenrael",
        "ezraexile",
        "darkrey",
        "sm33",
        "jocastanu",
        "mazkanata",
    ]);
    const conquestCharacters = [...conquestCharactersSet];

    const conquestShipsMap = {
        "razorcrest": "Razor",
        "tieinterceptor": " TIE Int"
    };
    const conquestShips = Object.keys(conquestShipsMap);

    const conquestUnitsOrder = [
        "razorcrest", "commanderahsoka", "maul", "bobafettscion", "tieinterceptor",
        "darthmalgus", "trench", "darthbane", "queenamidala", "luthenrael",
        "ezraexile", "darkrey", "sm33", "jocastanu", "mazkanata"
    ];

    function getShipInfo(player, shipName) {
        let shipInfo;
        if (player.roster === undefined) {
            shipInfo = { display: '', type: 0, rarity: 0 }; // No player file
        } else if (player.roster === null || !player.roster[shipName]) {
            shipInfo = { display: '-', type: 1, rarity: 0 }; // Player file, but no ship
        } else {
            const ship = player.roster[shipName];
            const rarity = ship.currentRarity || 0;
            const display = `${rarity}*`;
            shipInfo = { display, type: 2, rarity }; // type 2 for 'has ship'
        }
        return shipInfo;
    }

    function getGLInfo(player, glName) {
        let glInfo;
        if (player.roster === undefined) {
            glInfo = { display: '', type: 0, level: 0, rarity: 7 }; // No player file
        } else if (player.roster === null || !player.roster[glName]) {
            glInfo = { display: '-', type: 1, level: 0, rarity: 7 }; // Player file, but no GL
        } else {
            const gl = player.roster[glName];
            let display, type, level, rarity;

            rarity = gl.currentRarity || 7;

            if (gl.relic && gl.relic.currentTier >= 2) {
                type = 3; // 'R'
                level = gl.relic.currentTier - 2;
                display = `R${level}`;
            } else {
                type = 2; // 'G'
                level = gl.currentTier;
                display = `G${level}`;
            }

            if (rarity > 0 && rarity < 7) {
                display += `, ${rarity}*`;
            }

            glInfo = { display, type, level, rarity };
        }
        return glInfo;
    }

    function getShipBackgroundColor(shipInfo) {
        if (shipInfo.type === 0) return 'black'; // No info
        if (shipInfo.type === 1) return '#FF9999'; // No ship
        if (shipInfo.type === 2) {
            if (shipInfo.rarity < 7) return 'yellow';
            if (shipInfo.rarity === 7) return '#7ACC7A';
        }
        return ''; // Default or unknown
    }

    function getPilotBackgroundColor(pilotInfo) {
        if (pilotInfo.type === 0) return 'black'; // No info
        if (pilotInfo.type === 1) return '#FF9999'; // No unit (red)
        if (pilotInfo.type === 2) return 'orange'; // G level (G1-G13)
        if (pilotInfo.type === 3) { // Relic
            if (pilotInfo.level >= 5) return '#7ACC7A'; // R5+ (slightly darker green)
            if (pilotInfo.level >= 3) return 'lightgreen'; // R3-R4
            if (pilotInfo.level >= 0) return 'yellow'; // R0-R2
        }
        return ''; // Default
    }

    function getGLBackgroundColor(glInfo) {
        if (glInfo.type === 0) return 'black'; // No info
        if (glInfo.type === 1) return '#FF9999'; // No legend (brighter red)
        if (glInfo.type === 2) return 'orange'; // G level (less than R0)
        if (glInfo.type === 3) {
            if (glInfo.level < 7) return 'yellow'; // R0-R6
            if (glInfo.level < 9) return 'lightgreen'; // R7-R8
            if (glInfo.level === 9) return '#7ACC7A'; // R9 (slightly darker green)
        }
        return ''; // Default or unknown
    }

    function getRoleBackgroundColor(role) {
        switch (role) {
            case 'leader': return '#CC99FF'; // Brighter purple
            case 'officer': return '#99CCFF'; // Brighter blue
            case 'member': return 'lightgreen';
        }
        return ''; // Default
    }

    function getRareCharBackgroundColor(count, isTotal = false) {
        let redThreshold = 0;
        let orangeThreshold = 1;
        let yellowThreshold = 2;
        let lightGreenThreshold = 3;

        if (isTotal) {
            redThreshold = 0;
            orangeThreshold = 3;
            yellowThreshold = 6;
            lightGreenThreshold = 9;
        }

        if (count <= redThreshold) return '#FF9999'; // Red
        if (count <= orangeThreshold) return 'orange';
        if (count <= yellowThreshold) return 'yellow';
        if (count <= lightGreenThreshold) return 'lightgreen';
        return '#7ACC7A'; // Green
    }

    fetch('cache/guild_LVmIG5W_RSCmvZYOxdyH_Q.json')
        .then(response => response.json())
        .then(guildData => {
            const guildInfoDiv = document.getElementById('guild-info');
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
            recruitLink.style.fontSize = '0.6em'; // Make it smaller
            recruitLink.style.marginLeft = '10px'; // Add some spacing
            guildTitle.appendChild(recruitLink);

            guildInfoDiv.appendChild(guildTitle);

            progressContainer.style.display = 'block';
            let loadedPlayers = 0;
            const totalPlayers = guildData.member.length;

            if (totalPlayers === 0) {
                progressContainer.style.display = 'none';
                return Promise.resolve([]);
            }

            const playerPromises = guildData.member.map(player => {
                const playerId = player.playerId;
                return fetch(`../cache/player_id_${playerId}.json`)
                    .then(response => {
                        if (!response.ok) {
                            return { ...player, allyCode: '' }; // Player file not found
                        }
                        return response.json().then(playerData => ({ ...playerData, ...player }));
                    })
                    .catch(() => ({ ...player, allyCode: '' })) // Handle fetch error
                    .finally(() => {
                        loadedPlayers++;
                        const percentage = Math.round((loadedPlayers / totalPlayers) * 100);
                        progressBar.style.width = `${percentage}%`;
                        progressBar.textContent = `${percentage}%`;
                    });
            });

            return Promise.all(playerPromises);
        })
        .then(allPlayerData => {
            // Dynamically build the set of ship IDs
            allPlayerData.forEach(player => {
                if (player.roster) {
                    for (const unitId in player.roster) {
                        if (player.roster[unitId].stats.crew) {
                            shipBaseIds.add(unitId.toLowerCase());
                        }
                    }
                }
            });

            // Now that shipBaseIds is populated, load platoon data
            const platoonPromise = loadPlatoonData();
            return Promise.all([Promise.resolve(allPlayerData), platoonPromise]);
        })
        .then(([allPlayerData, platoonRequirements]) => {
            progressContainer.style.display = 'none';

            const guildAvailability = calculateGuildAvailability(allPlayerData, platoonRequirements);
            tbColumns = determineTbColumns(platoonRequirements, guildAvailability);

            players = allPlayerData.map(player => {
                const playerInfo = {
                    playerName: player.playerName,
                    playerId: player.playerId,
                    allyCode: player.allyCode || '',
                    memberLevel: rankMap[player.memberLevel] || player.memberLevel.replace('GUILD_', '').toLowerCase(),
                    galacticPower: Number(player.galacticPower),
                    joined: player.guildJoinTime ? new Date(Number(player.guildJoinTime)*1000).toISOString().slice(0, 10).replace(/-/g, '.') : '-',
                    roster: player.roster,
                };

                galacticLegends.forEach(glName => {
                    playerInfo[glName] = getGLInfo(player, glName);
                });

                ships.forEach(shipName => {
                    playerInfo[shipName] = getShipInfo(player, shipName);
                });

                pilots.forEach(pilotName => {
                    playerInfo[pilotName] = getGLInfo(player, pilotName);
                });

                conquestUnitsOrder.forEach(unitName => {
                    if (conquestCharactersSet.has(unitName)) {
                        playerInfo[unitName] = getGLInfo(player, unitName);
                    } else if (conquestShipsMap[unitName]) {
                        playerInfo[unitName] = getShipInfo(player, unitName);
                    }
                });

                const unitsCountedForRelic = { 9: new Set(), 8: new Set(), 7: new Set(), 6: new Set(), 5: new Set() };
                tbColumns.forEach(col => {
                    if (col.type === 'char') {
                        const requiredRelic = parseInt(col.level, 10);
                        const unitInfo = getGLInfo(player, col.unitId);
                        if (unitInfo.type === 3 && unitInfo.level >= requiredRelic) {
                            if (unitsCountedForRelic[requiredRelic] !== undefined) {
                                unitsCountedForRelic[requiredRelic].add(col.unitId);
                            }
                        }
                    }
                });

                playerInfo.rareR9 = unitsCountedForRelic[9].size;
                playerInfo.rareR8 = unitsCountedForRelic[8].size;
                playerInfo.rareR7 = unitsCountedForRelic[7].size;
                playerInfo.rareR6 = unitsCountedForRelic[6].size;
                playerInfo.rareR5 = unitsCountedForRelic[5].size;

                const allRareUnits = new Set();
                tbColumns.forEach(col => {
                    if (col.type === 'char') {
                        const requiredRelic = parseInt(col.level, 10);
                        if (requiredRelic < 5) return;
                        const unitInfo = getGLInfo(player, col.unitId);
                        if (unitInfo.type === 3 && unitInfo.level >= requiredRelic) {
                            allRareUnits.add(col.unitId);
                        }
                    }
                });
                playerInfo.rareRTotal = allRareUnits.size;

                return playerInfo;
            });
            sortAndRender('memberLevel', 'asc');
            const roleHeader = document.querySelector('th[data-sort="memberLevel"]');
            if (roleHeader) {
                roleHeader.classList.add('sort-asc');
                roleHeader.dataset.direction = 'asc';
            }
        })
        .catch(error => {
            console.error('Error loading guild data:', error);
            progressContainer.style.display = 'none';
        });

    function loadPlatoonData() {
        const platoonPromises = [];
        for (let i = 1; i <= 6; i++) {
            platoonPromises.push(
                fetch(`data/tb/hatori/platoons/wookieebot-ops-P${i}.json`)
                    .then(response => {
                        if (!response.ok) return null;
                        return response.json();
                    })
                    .catch(() => null)
            );
        }

        const phaseToRelic = { 1: 5, 2: 6, 3: 7, 4: 8, 5: 9, 6: 9 };

        return Promise.all(platoonPromises).then(platoonFiles => {
            const platoonRequirements = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} };

            platoonFiles.forEach((fileData, index) => {
                if (!fileData || !fileData.platoonAssignments) return;

                const topLevelPhase = index + 1;

                fileData.platoonAssignments.forEach(assignment => {
                    const match = assignment.zoneId.match(/phase0(\d)/);
                    if (!match || !match[1]) return;

                    let unitId = assignment.unitBaseId.toLowerCase();
                    if (platoonToRosterIdMap[unitId]) {
                        unitId = platoonToRosterIdMap[unitId];
                    }

                    const isShip = shipBaseIds.has(unitId);
                    const assignmentPhase = parseInt(match[1], 10);
                    const requiredLevel = isShip ? 7 : phaseToRelic[assignmentPhase];

                    if (!requiredLevel) return;
                    
                    const reqs = platoonRequirements[topLevelPhase];

                    if (!reqs[unitId]) {
                        reqs[unitId] = {};
                    }
                    if (!reqs[unitId][requiredLevel]) {
                        reqs[unitId][requiredLevel] = 0;
                    }
                    reqs[unitId][requiredLevel]++;
                });
            });
            return platoonRequirements;
        });
    }

    table.querySelectorAll('th[data-sort]').forEach(headerCell => {
        headerCell.addEventListener('click', () => {
            const sortKey = headerCell.dataset.sort;
            const currentDirection = headerCell.dataset.direction || 'desc';
            const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

            table.querySelectorAll('th[data-sort]').forEach(th => {
                delete th.dataset.direction;
                th.classList.remove('sort-asc', 'sort-desc');
            });

            headerCell.dataset.direction = newDirection;
            headerCell.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc');

            sortAndRender(sortKey, newDirection);
        });
    });

    function sortAndRender(key, direction) {
        const sortedData = [...players].sort((a, b) => {
            if (ships.includes(key) || conquestShips.includes(key)) {
                const valA_ship = a[key];
                const valB_ship = b[key];

                if (valA_ship.type < valB_ship.type) return direction === 'asc' ? -1 : 1;
                if (valA_ship.type > valB_ship.type) return direction === 'asc' ? 1 : -1;

                if (valA_ship.rarity < valB_ship.rarity) return direction === 'asc' ? -1 : 1;
                if (valA_ship.rarity > valB_ship.rarity) return direction === 'asc' ? 1 : -1;

                return 0;
            }

            if (galacticLegends.includes(key) || pilots.includes(key) || conquestCharacters.includes(key)) {
                const valA_gl = a[key];
                const valB_gl = b[key];

                if (valA_gl.type < valB_gl.type) return direction === 'asc' ? -1 : 1;
                if (valA_gl.type > valB_gl.type) return direction === 'asc' ? 1 : -1;

                if (valA_gl.level < valB_gl.level) return direction === 'asc' ? -1 : 1;
                if (valA_gl.level > valB_gl.level) return direction === 'asc' ? 1 : -1;

                if (valA_gl.rarity < valB_gl.rarity) return direction === 'asc' ? -1 : 1;
                if (valA_gl.rarity > valB_gl.rarity) return direction === 'asc' ? 1 : -1;

                return 0;
            }

            const valA = a[key];
            const valB = b[key];

            if (key === 'memberLevel') {
                const roleOrder = ['leader', 'officer', 'member'];
                const indexA = roleOrder.indexOf(valA);
                const indexB = roleOrder.indexOf(valB);
                if (indexA < indexB) return direction === 'asc' ? -1 : 1;
                if (indexA > indexB) return direction === 'asc' ? 1 : -1;
                
                // Secondary sort by playerName, always ascending
                if (a.playerName.toLowerCase() < b.playerName.toLowerCase()) return -1;
                if (a.playerName.toLowerCase() > b.playerName.toLowerCase()) return 1;
                return 0;
            }

            if (key === 'allyCode' || key === 'galacticPower' || key.startsWith('rareR')) {
                const numA = Number(valA);
                const numB = Number(valB);
                if (numA < numB) return direction === 'asc' ? -1 : 1;
                if (numA > numB) return direction === 'asc' ? 1 : -1;
                return 0;
            }

            if (String(valA).toLowerCase() < String(valB).toLowerCase()) {
                return direction === 'asc' ? -1 : 1;
            }
            if (String(valA).toLowerCase() > String(valB).toLowerCase()) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        renderTable(sortedData);
    }

    function showRareCharsPopup(player, relicLevel) {
        const rareChars = tbColumns.filter(c => c.type === 'char');
        let charsToList = [];
        const uniqueCharNames = new Set();

        if (relicLevel === 'total') {
            rareChars.forEach(rareChar => {
                const unitInfo = getGLInfo(player, rareChar.unitId);
                const requiredRelic = parseInt(rareChar.level, 10);
                if (unitInfo.type === 3 && unitInfo.level >= requiredRelic && requiredRelic >= 5) {
                    const charName = getUnitDisplayName(rareChar.unitId);
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
            rareChars.forEach(rareChar => {
                const requiredRelic = parseInt(rareChar.level, 10);
                if (requiredRelic !== relicLevel) {
                    return;
                }

                const unitInfo = getGLInfo(player, rareChar.unitId);
                if (unitInfo.type === 3 && unitInfo.level >= requiredRelic) {
                    const charName = getUnitDisplayName(rareChar.unitId);
                    if (!uniqueCharNames.has(charName)) {
                        charsToList.push({
                            name: charName,
                            relic: unitInfo.level
                        });
                        uniqueCharNames.add(charName);
                    }
                }
            });
        }

        let popupContent = `<h2>${player.playerName} - Rare Characters (R${relicLevel === 'total' ? '5+' : relicLevel}+)</h2>`;
        if (charsToList.length > 0) {
            popupContent += '<ul>';
            charsToList.sort((a, b) => b.relic - a.relic || a.name.localeCompare(b.name));
            charsToList.forEach(char => {
                popupContent += `<li>${char.name} (R${char.relic})</li>`;
            });
            popupContent += '</ul>';
        } else {
            popupContent += '<p>No rare characters at this relic level.</p>';
        }

        modalBody.innerHTML = popupContent;
        modal.style.display = 'block';
    }

    function renderTable(data) {
        const thead = table.querySelector('thead');
        const headerRow1 = thead.rows[0];
        const headerRow2 = thead.rows[1];

        // Clear and rebuild TB headers
        headerRow1.querySelectorAll('.col-tb').forEach(th => th.remove());
        headerRow2.querySelectorAll('.col-tb').forEach(th => th.remove());
        const tbGroupHeaderPlaceholder = headerRow1.querySelector('.col-tb-group');
        if (tbGroupHeaderPlaceholder) tbGroupHeaderPlaceholder.remove();

        if (tbColumns.length > 0) {
            const tbGroupHeader = document.createElement('th');
            tbGroupHeader.colSpan = tbColumns.length;
            tbGroupHeader.className = 'separator-left separator-right col-tb';
            tbGroupHeader.textContent = 'Territory Battle Platoons';
            headerRow1.appendChild(tbGroupHeader);

            tbColumns.forEach((col, idx) => {
                const charHeader = document.createElement('th');
                charHeader.className = 'col-tb';
                if (idx === 0 || col.phase !== tbColumns[idx - 1].phase) {
                    charHeader.classList.add('separator-left');
                }
                charHeader.title = `${col.available} available / ${col.required} required`;
                const requirementText = col.type === 'ship' ? `${col.level}*` : `r${col.level}`;
                charHeader.innerHTML = `${col.displayName} ${requirementText}<br>(${col.available}/${col.required})`;
                headerRow2.appendChild(charHeader);
            });
        }

        tbody.innerHTML = '';
        data.forEach((player, index) => {
            const row = tbody.insertRow();

            if (player.playerId === selectedPlayerId) {
                row.classList.add('selected');
            }

            row.addEventListener('click', () => {
                const currentlySelected = document.querySelector('.selected');
                if (currentlySelected && currentlySelected !== row) {
                    currentlySelected.classList.remove('selected');
                }
                row.classList.toggle('selected');
                if (row.classList.contains('selected')) {
                    selectedPlayerId = player.playerId;
                } else {
                    selectedPlayerId = null;
                }
            });

            const indexCell = row.insertCell()
            indexCell.textContent = index + 1;
            indexCell.style.backgroundColor = 'white';

            const playerNameCell = row.insertCell();
            const playerNameLink = document.createElement('a');
            playerNameLink.href = `https://swgoh.gg/p/${player.allyCode}/`;
            playerNameLink.textContent = player.playerName;
            playerNameLink.target = "_blank";
            playerNameCell.appendChild(playerNameLink);
            playerNameCell.style.backgroundColor = 'white';

            const allyCodeCell = row.insertCell();
            allyCodeCell.textContent = player.allyCode;
            allyCodeCell.classList.add('col-player-info', 'separator-left');

            const memberLevelCell = row.insertCell();
            memberLevelCell.textContent = player.memberLevel;
            memberLevelCell.style.backgroundColor = getRoleBackgroundColor(player.memberLevel);
            memberLevelCell.classList.add('col-player-info');

            const gpCell = row.insertCell();
            gpCell.textContent = (player.galacticPower / 1000000).toFixed(1);
            gpCell.classList.add('col-player-info');

            const joinedCell = row.insertCell();
            joinedCell.textContent = player.joined;
            joinedCell.classList.add('col-player-info');

            galacticLegends.forEach((glName, idx) => {
                const glCell = row.insertCell();
                glCell.classList.add('col-gl');
                if (idx === 0) glCell.classList.add('separator-left');
                glCell.textContent = player[glName].display;
                glCell.style.backgroundColor = getGLBackgroundColor(player[glName]);
                if (idx === galacticLegends.length - 1) glCell.classList.add('separator-right');
            });

            ships.forEach((shipName, idx) => {
                const shipCell = row.insertCell();
                shipCell.classList.add('col-ships');
                if (idx === 0) shipCell.classList.add('separator-left');
                shipCell.textContent = player[shipName].display;
                shipCell.style.backgroundColor = getShipBackgroundColor(player[shipName]);
            });

            pilots.forEach(pilotName => {
                const pilotCell = row.insertCell();
                pilotCell.classList.add('col-ships');
                pilotCell.textContent = player[pilotName].display;
                pilotCell.style.backgroundColor = getPilotBackgroundColor(player[pilotName]);
            });

            conquestUnitsOrder.forEach((unitName, idx) => {
                const cell = row.insertCell();
                cell.classList.add('col-conquest');
                if (idx === 0) cell.classList.add('separator-left');
                if (conquestCharactersSet.has(unitName)) {
                    cell.textContent = player[unitName].display;
                    cell.style.backgroundColor = getGLBackgroundColor(player[unitName]);
                } else if (conquestShipsMap[unitName]) {
                    cell.textContent = player[unitName].display;
                    cell.style.backgroundColor = getShipBackgroundColor(player[unitName]);
                }
                if (idx === conquestUnitsOrder.length - 1) cell.classList.add('separator-right');
            });

            const rareRelicLevels = [5, 6, 7, 8, 9];
            rareRelicLevels.forEach((relicLevel, idx) => {
                const cell = row.insertCell();
                cell.classList.add('col-tb-rare');
                if (idx === 0) {
                    cell.classList.add('separator-left');
                }
                const count = player[`rareR${relicLevel}`] || 0;
                cell.textContent = count;
                cell.style.backgroundColor = getRareCharBackgroundColor(count, false);
                cell.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showRareCharsPopup(player, relicLevel);
                });
            });

            const totalCell = row.insertCell();
            totalCell.classList.add('col-tb-rare', 'separator-right');
            totalCell.textContent = player.rareRTotal;
            totalCell.style.backgroundColor = getRareCharBackgroundColor(player.rareRTotal, true);
            totalCell.addEventListener('click', (e) => {
                e.stopPropagation();
                showRareCharsPopup(player, 'total');
            });

            tbColumns.forEach((col, idx) => {
                const tbCell = row.insertCell();
                tbCell.classList.add('col-tb');
                if (idx === 0 || col.phase !== tbColumns[idx - 1].phase) {
                    tbCell.classList.add('separator-left');
                }

                if (col.type === 'ship') {
                    const unitInfo = getShipInfo(player, col.unitId);
                    tbCell.textContent = unitInfo.display;
                    if (unitInfo.rarity >= col.level) {
                        tbCell.style.backgroundColor = '#7ACC7A'; // Green
                    } else if (unitInfo.type > 1) {
                        tbCell.style.backgroundColor = '#FF9999'; // Red
                    }
                } else { // character
                    const unitInfo = getGLInfo(player, col.unitId);
                    tbCell.textContent = unitInfo.display;
                    if (unitInfo.type === 3 && unitInfo.level >= col.level) {
                        tbCell.style.backgroundColor = '#7ACC7A'; // Green
                    } else if (unitInfo.type > 1) {
                        tbCell.style.backgroundColor = '#FF9999'; // Red
                    }
                }
            });
            if (tbColumns.length > 0) {
                const lastTbCell = row.cells[row.cells.length - 1];
                lastTbCell.classList.add('separator-right');
            }
        });

        // Re-apply column visibility
        document.querySelectorAll('#column-controls input[type="checkbox"]').forEach(checkbox => {
            const group = checkbox.dataset.group;
            const show = checkbox.checked;
            document.querySelectorAll(`.col-${group}`).forEach(el => {
                el.style.display = show ? '' : 'none';
            });
        });
    }

    document.querySelectorAll('#column-controls input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const group = checkbox.dataset.group;
            const show = checkbox.checked;
            document.querySelectorAll(`.col-${group}`).forEach(el => {
                el.style.display = show ? '' : 'none';
            });
        });
    });
});
