import { isUndef } from '../src/utils'

describe('isUndef', () => {
  test(' "" ', () => {
    expect(isUndef('')).toBe(true)
  })
  test('Careteen', () => {
    expect(isUndef('Careteen')).toBe(false)
  })
})