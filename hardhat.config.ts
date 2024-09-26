import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import { config as dotenvConfig } from 'dotenv'
dotenvConfig()

const {
  RPC_PROVIDER_URL_SEPOLIA,
  RPC_PROVIDER_URL_MINATO,
  ETHERSCAN_API_KEY,
  PRIVATE_KEY,
} = process.env

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  solidity: {
    version: '0.8.20',
    settings: {
      metadata: {
        bytecodeHash: 'none',
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  gasReporter: {
    enabled: true,
    currency: 'JPY',
    gasPrice: 10,
    gasPriceApi: 'https://api.etherscan.io/api?module=proxy&action=eth_gasPrice',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  networks: {
    sepolia: {
      url: RPC_PROVIDER_URL_SEPOLIA,
      accounts: [`0x${PRIVATE_KEY}`]
    },
    minato: {
      url: RPC_PROVIDER_URL_MINATO,
      accounts: [`0x${PRIVATE_KEY}`]
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY || '',
    },
  },
}

export default config
