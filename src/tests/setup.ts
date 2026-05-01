import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Suppress console.error from action code during error-path tests
vi.spyOn(console, 'error').mockImplementation(() => {})
