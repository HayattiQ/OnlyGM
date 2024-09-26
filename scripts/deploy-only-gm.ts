import { ethers } from 'hardhat'

async function main() {
  // Role
  const ROLE_ADMIN = ethers.utils.formatBytes32String('ADMIN')
  const ADMIN_ADDRESSES = [
    '0x474f057fFd4184cE80236d39C88E8ECFe8589931'
  ]

  // Fee
  const TREASURY_ADDRESS = '0x474f057fFd4184cE80236d39C88E8ECFe8589931'
  const BASIS_POINT_FEE_MINT = 250
  const BASIS_POINT_FEE_BURN = 250

  // Metadata
  const TITLE = 'gm'
  const DESCRIPTION = 'Only gm!'
  const SVG_IMAGES = [
    '<svg width="640" height="640" viewBox="0 0 640 640" fill="none" xmlns="http://www.w3.org/2000/svg">',
    '<rect y="213.333" width="640" height="213.333" fill="#E2F50B"/>',
    '<rect y="426.667" width="640" height="213.333" fill="#F50BB4"/>',
    '<rect width="640" height="213.333" fill="#0BF5CB"/>',
    '</svg>'
  ]

  const [deployer] = await ethers.getSigners()
  console.log(`DeployerAddress - ${deployer.address}`)

  // Main
  const MainContract = await ethers.getContractFactory('OnlyGm')
  const mainContract = await MainContract.deploy()
  await mainContract.deployed()
  console.log(`■ MainContract : ${mainContract.address}`)

  // GrantRole
  for (const adminAddress of ADMIN_ADDRESSES) {
    await mainContract.grantRole(ROLE_ADMIN, adminAddress)
  }
  console.log('GrantRole ... DONE')

  // Metadata
  await mainContract.setTitle(TITLE)
  await mainContract.setDescription(DESCRIPTION)
  await mainContract.setSvgImage(SVG_IMAGES.join(''))
  await mainContract.setTokenIdToWord(1, 'gm')
  console.log('SetMetadata ... DONE')

  // Treasury
  await mainContract.setTreasury(TREASURY_ADDRESS)
  await mainContract.setBasisPointFeeMint(BASIS_POINT_FEE_MINT)
  await mainContract.setBasisPointFeeBurn(BASIS_POINT_FEE_BURN)
  console.log('SetTreasury ... DONE')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
