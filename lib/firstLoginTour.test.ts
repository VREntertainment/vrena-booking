import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldStartFirstLoginTour } from './firstLoginTour.ts'

test('the tour starts automatically for a player who has not seen it', () => {
  assert.equal(shouldStartFirstLoginTour({ completed: false, isManualReplay: false, resumeStep: null }), true)
})

test('the tour does not restart automatically after it is completed or dismissed', () => {
  assert.equal(shouldStartFirstLoginTour({ completed: true, isManualReplay: false, resumeStep: null }), false)
})

test('an interrupted first tour resumes on the stored step', () => {
  assert.equal(shouldStartFirstLoginTour({ completed: false, isManualReplay: false, resumeStep: 4 }), true)
})

test('the Profile replay action can start a completed tour again', () => {
  assert.equal(shouldStartFirstLoginTour({ completed: true, isManualReplay: true, resumeStep: null }), true)
})
