export type FirstLoginTourStartState = {
  completed: boolean
  isManualReplay: boolean
  resumeStep: number | null
}

export function shouldStartFirstLoginTour({ completed, isManualReplay, resumeStep }: FirstLoginTourStartState) {
  return isManualReplay || resumeStep !== null || !completed
}
