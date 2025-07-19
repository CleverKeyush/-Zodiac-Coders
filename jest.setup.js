import '@testing-library/jest-dom'

// Mock environment variables
process.env.NEXT_PUBLIC_PROJECT_ID = 'test-project-id'
process.env.ORKES_CONDUCTOR_PRIMARY_URL = 'http://localhost:8080'
process.env.ORKES_CONDUCTOR_SECONDARY_URL = 'http://localhost:1234'
process.env.IPFS_API_URL = 'http://localhost:5001'
process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL = 'http://localhost:8545'
process.env.NEXT_PUBLIC_KYC_CONTRACT_ADDRESS = '0x1234567890123456789012345678901234567890'

// Mock crypto for Node.js environment
const crypto = require('crypto')
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: arr => crypto.randomBytes(arr.length),
    subtle: crypto.webcrypto?.subtle,
  },
})

// Mock fetch
global.fetch = jest.fn()

// Mock file reader
global.FileReader = class {
  readAsDataURL() {
    this.onload({ target: { result: 'data:image/jpeg;base64,test' } })
  }
}

// Mock canvas for face-api.js
HTMLCanvasElement.prototype.getContext = jest.fn()

// Mock image loading
global.Image = class {
  constructor() {
    setTimeout(() => {
      this.onload()
    }, 100)
  }
}