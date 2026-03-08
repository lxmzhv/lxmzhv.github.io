let AppState = {
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

export { AppState };
