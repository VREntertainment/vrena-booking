'use client'

import { createTournamentActions, type TournamentActionsContext } from '../../lib/booking/tournamentActions'

type TournamentActions = ReturnType<typeof createTournamentActions>

/** Bind commands without running their context factory during rendering. */
export function bindBookingTournamentActions(getContext: () => TournamentActionsContext) {
  function addTournamentEditor(...args: Parameters<TournamentActions['addTournamentEditor']>) {
    return createTournamentActions(getContext()).addTournamentEditor(...args)
  }

  function setupTournamentPools(...args: Parameters<TournamentActions['setupTournamentPools']>) {
    return createTournamentActions(getContext()).setupTournamentPools(...args)
  }

  function generateTournamentMatches(...args: Parameters<TournamentActions['generateTournamentMatches']>) {
    return createTournamentActions(getContext()).generateTournamentMatches(...args)
  }

  function updateTournamentPoolEntry(...args: Parameters<TournamentActions['updateTournamentPoolEntry']>) {
    return createTournamentActions(getContext()).updateTournamentPoolEntry(...args)
  }

  function updateTournamentMatch(...args: Parameters<TournamentActions['updateTournamentMatch']>) {
    return createTournamentActions(getContext()).updateTournamentMatch(...args)
  }

  function advanceTournamentRound(...args: Parameters<TournamentActions['advanceTournamentRound']>) {
    return createTournamentActions(getContext()).advanceTournamentRound(...args)
  }

  function finishTournament(...args: Parameters<TournamentActions['finishTournament']>) {
    return createTournamentActions(getContext()).finishTournament(...args)
  }

  function createThirdPlaceMatch(...args: Parameters<TournamentActions['createThirdPlaceMatch']>) {
    return createTournamentActions(getContext()).createThirdPlaceMatch(...args)
  }

  function claimPrize(...args: Parameters<TournamentActions['claimPrize']>) {
    return createTournamentActions(getContext()).claimPrize(...args)
  }

  return {
    addTournamentEditor,
    setupTournamentPools,
    generateTournamentMatches,
    updateTournamentPoolEntry,
    updateTournamentMatch,
    advanceTournamentRound,
    finishTournament,
    createThirdPlaceMatch,
    claimPrize,
  }
}
