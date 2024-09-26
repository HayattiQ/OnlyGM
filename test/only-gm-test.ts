import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

// Role
const ROLE_ADMIN  = ethers.utils.formatBytes32String('ADMIN')

// Fee
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


/**
 * コントラクト初期化
 */
async function initializeFixture() {
  const [owner, admin, authorizedAccount1, authorizedAccount2, authorizedAccount3, authorizedAccount4, unAuthorizedAccount, ...others] = await ethers.getSigners()
  const treasury = authorizedAccount4

  const MainContract = await ethers.getContractFactory('OnlyGm')
  const mainContract = await MainContract.connect(owner).deploy()
  await mainContract.connect(owner).grantRole(ROLE_ADMIN, admin.address)

  await mainContract.connect(admin).setTitle(TITLE)
  await mainContract.connect(admin).setDescription(DESCRIPTION)
  await mainContract.connect(admin).setSvgImage(SVG_IMAGES.join(''))
  await mainContract.connect(admin).setTokenIdToWord(1, 'gm')

  await mainContract.connect(admin).setTreasury(treasury.address)
  await mainContract.connect(admin).setBasisPointFeeMint(BASIS_POINT_FEE_MINT)
  await mainContract.connect(admin).setBasisPointFeeBurn(BASIS_POINT_FEE_BURN)

  return {
    mainContract,
    owner,
    admin,
    treasury,
    authorizedAccount1,
    authorizedAccount2,
    authorizedAccount3,
    unAuthorizedAccount
  }
}

describe('Onlygm', function() {
  const tokenId = 1
  const wrongTokenId = 2
  const burnAmount = 1

  describe('Mint機能テスト', function() {
    it('ミントが成功しイベントがemitされる', async function() {
      const { mainContract, authorizedAccount1 } = await loadFixture(initializeFixture)
      const mintAmount = 3
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await expect(mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost }))
        .to.emit(mainContract, "TokenMinted")
        .withArgs(authorizedAccount1.address, tokenId, mintAmount)
      expect(await mainContract.balanceOf(authorizedAccount1.address, tokenId)).to.equal(mintAmount)
    })
    it('未設定のトークンIDはミントが失敗する', async function() {
      const { mainContract, authorizedAccount1 } = await loadFixture(initializeFixture)
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(wrongTokenId, mintAmount)
      await expect(mainContract.connect(authorizedAccount1).mint(wrongTokenId, mintAmount, { value: mintCost }))
        .to.be.revertedWith('Word is not set')
    })
    it('valueが不足している場合はミントが失敗する', async function() {
      const { mainContract, authorizedAccount1 } = await loadFixture(initializeFixture)
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await expect(mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost.sub(1) }))
        .to.be.revertedWith('Not enough ETH')
    })
    it('ミント後にtotalMintedが増加する', async function() {
      const { mainContract, authorizedAccount1 } = await loadFixture(initializeFixture)
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost })
      expect(await mainContract.totalMinted(tokenId)).to.equal(mintAmount)
    })
    it('ミント時にTreasuryに正しいfeeが送金される', async function() {
      const { mainContract, treasury, authorizedAccount1 } = await loadFixture(initializeFixture)
      const treasuryBalanceBefore = await treasury.getBalance()
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost })
      const treasuryBalanceAfter = await treasury.getBalance()
      const fee = mintCost.mul(BASIS_POINT_FEE_MINT).div(10000)
      expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore.add(fee))
    })
  })

  describe('Burn機能テスト', function() {
    it('Mintしていない場合はBurnが失敗する', async function() {
      const { mainContract, authorizedAccount1 } = await loadFixture(initializeFixture)
      await expect(mainContract.connect(authorizedAccount1).burn(tokenId))
        .to.be.revertedWith('Not enough tokens to burn')
    })

    it('Burnが成功しイベントがemitされる', async function() {
      const { mainContract, authorizedAccount1 } = await loadFixture(initializeFixture)
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost })
      await expect(mainContract.connect(authorizedAccount1).burn(tokenId))
        .to.emit(mainContract, "TokenBurned")
        .withArgs(authorizedAccount1.address, tokenId, burnAmount)
      expect(await mainContract.balanceOf(authorizedAccount1.address, tokenId)).to.equal(0)
    })

    it('Burn後に正しく払い戻しされる', async function() {
      const { mainContract, authorizedAccount1 } = await loadFixture(initializeFixture)

      // ミント
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost })
      const balanceBefore = await authorizedAccount1.getBalance()

      // 引き出し額を事前に計算
      const expectedWithdrawValue = await mainContract.getBurnWithdrawValue(tokenId)

      // Burn
      const burnFee = expectedWithdrawValue.mul(BASIS_POINT_FEE_BURN).div(10000)
      const burnTx = await mainContract.connect(authorizedAccount1).burn(tokenId)
      const receipt = await burnTx.wait()
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

      // 残高を確認
      const balanceAfter = await authorizedAccount1.getBalance()
      expect(balanceBefore.sub(gasUsed).add(expectedWithdrawValue).sub(burnFee)).to.equal(balanceAfter)
    })

    it('Burn後にtotalBurnedが増加する', async function() {
      const { mainContract, authorizedAccount1 } = await loadFixture(initializeFixture)

      // ミント
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost })

      // Burn
      await mainContract.connect(authorizedAccount1).burn(tokenId)
      expect(await mainContract.totalBurned(tokenId)).to.equal(burnAmount)
    })

    it('Burn時にTreasuryにfeeが送金される', async function() {
      const { mainContract, treasury, authorizedAccount1 } = await loadFixture(initializeFixture)

      // ミント
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost })

      // 引き出し額を事前に計算
      const treasuryBalanceBefore = await treasury.getBalance()
      const expectedWithdrawValue = await mainContract.getBurnWithdrawValue(tokenId)
      const expectedBurnFee = expectedWithdrawValue.mul(BASIS_POINT_FEE_BURN).div(10000)

      // Burn
      await mainContract.connect(authorizedAccount1).burn(tokenId)

      // 残高を確認
      const treasuryBalanceAfter = await treasury.getBalance()
      expect(treasuryBalanceBefore.add(expectedBurnFee)).to.equal(treasuryBalanceAfter)
    })
  })


  describe("Cost計算テスト", function () {
    it("getMintCostが正しいコストを返す", async function () {
      const { mainContract } =await loadFixture(initializeFixture)

      // 1つのトークンをミントする場合のコスト
      const cost1 = await mainContract.getMintCost(tokenId, 1)
      expect(cost1).to.equal(ethers.utils.parseEther("0.0001"))

      // 3つのトークンをミントする場合のコスト
      const cost3 = await mainContract.getMintCost(tokenId, 3)
      const expected3 = ethers.utils.parseEther("0.0001")
        .add(ethers.utils.parseEther("0.00011"))
        .add(ethers.utils.parseEther("0.00012"))
      expect(cost3).to.equal(expected3)
    })

    it("getBurnWithdrawValueが正しい払い戻し額を返す", async function () {
      const { mainContract, authorizedAccount1 } =await loadFixture(initializeFixture)

      // トークンをミント
      const mintAmount = 1
      const mintCost = await mainContract.getMintCost(tokenId, mintAmount)
      await mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount, { value: mintCost })

      // バーンの払い戻し額を計算
      const burnWithdrawValue = await mainContract.getBurnWithdrawValue(1)
      const expectedWithdrawValue = mintCost.sub(mintCost.mul(BASIS_POINT_FEE_BURN).div(10000))
      expect(burnWithdrawValue).to.equal(expectedWithdrawValue)
    })

    it("calculateCostが正しいコストを返す", async function () {
      const { mainContract } =await loadFixture(initializeFixture)

      // 0個目のトークンのコスト
      const cost0 = await mainContract.calculateCost(0)
      expect(cost0).to.equal(ethers.utils.parseEther("0.0001"))

      // 10個目のトークンのコスト
      const cost10 = await mainContract.calculateCost(10)
      expect(cost10).to.equal(ethers.utils.parseEther("0.0002"))

      // 100個目のトークンのコスト
      const cost100 = await mainContract.calculateCost(100)
      expect(cost100).to.equal(ethers.utils.parseEther("0.0011"))
    })


    it("すべてのトークンがBurnされたときにコントラクトの残高が0に", async function () {
      const { mainContract, authorizedAccount1, authorizedAccount2, treasury } = await loadFixture(initializeFixture)

      // 複数のアカウントで複数のトークンをミント
      const mintAmount1 = 3
      const mintCost1 = await mainContract.getMintCost(tokenId, mintAmount1)
      await mainContract.connect(authorizedAccount1).mint(tokenId, mintAmount1, { value: mintCost1 })

      const mintAmount2 = 2
      const mintCost2 = await mainContract.getMintCost(tokenId, mintAmount2)
      await mainContract.connect(authorizedAccount2).mint(tokenId, mintAmount2, { value: mintCost2 })

      // すべてのトークンをバーン
      for (let i = 0; i < mintAmount1; i++) {
        await mainContract.connect(authorizedAccount1).burn(tokenId)
      }
      for (let i = 0; i < mintAmount2; i++) {
        await mainContract.connect(authorizedAccount2).burn(tokenId)
      }

      // コントラクトの最終残高を確認
      const finalContractBalance = await ethers.provider.getBalance(mainContract.address)
      expect(finalContractBalance).to.equal(0)
    })
  })
})



