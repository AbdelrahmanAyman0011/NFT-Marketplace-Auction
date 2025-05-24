import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers"; // Imports testing utilities from hardhat
import { expect } from "chai"; // Imports assertion library
import { ethers } from "hardhat"; // Imports ethers from hardhat for blockchain interaction

/**
 * Creates and deploys an NFT Collection contract for testing
 * Returns:
 * - NFTCollection: The deployed NFT contract instance
 * - ownerNFTCollection: First signer account that deploys the contract and becomes owner
 * - USER1, USER2: Additional test accounts for testing transfers and permissions
 */
async function deployNFTCollectionFixture() {
  const [ownerNFTCollection, USER1, USER2] = await ethers.getSigners(); // Gets test accounts from hardhat
  const NFTCollectionFactory = await ethers.getContractFactory("NFTCollection"); // Creates contract factory for deployment
  const NFTCollection = await NFTCollectionFactory.deploy(); // Deploys NFT Collection contract with no constructor parameters

  return { NFTCollection, ownerNFTCollection, USER1, USER2 };
}

describe("NFT Collection contract", () => {
  describe("Mint NFT - Success", () => {
    /**
     * Tests the NFT minting functionality
     * Verifies that a new token can be minted and ownership is correctly assigned to the minter
     */
    it("Can mint new NFT ", async () => {
      const { NFTCollection, ownerNFTCollection } = await loadFixture(
        deployNFTCollectionFixture
      );
      // Calls mintNFT function with:
      // - "NFTName": Name of the NFT token being minted
      // - "nft.uri": URI pointing to the metadata of the NFT
      await NFTCollection.mintNFT("NFTName", "nft.uri");

      // Verifies that the owner of token ID 0 is the account that minted it
      expect(await NFTCollection.ownerOf(0)).to.equal(
        ownerNFTCollection.address
      );
    });
  });

  describe("transferNFTFrom - Success", () => {
    /**
     * Tests the NFT transfer functionality
     * Verifies that an NFT can be transferred between addresses after approval
     */
    it("Can mint and transfer an NFT from one address to another ", async () => {
      const { NFTCollection, ownerNFTCollection, USER1, USER2 } =
        await loadFixture(deployNFTCollectionFixture);

      // Mint a new NFT owned by ownerNFTCollection
      await NFTCollection.mintNFT("NFTName", "nft.uri");

      // Verify initial ownership of the minted token
      expect(await NFTCollection.ownerOf(0)).to.equal(
        ownerNFTCollection.address
      );

      // Approves USER2 to transfer token ID 0 on behalf of the owner
      // approve(operator, tokenId) - Allows operator to transfer the specific token
      await NFTCollection.approve(USER2.address, 0);
      
      // USER2 transfers the token from ownerNFTCollection to USER1
      // transferNFTFrom(from, to, tokenId) - Transfers token between accounts:
      //    - from: Current owner address
      //    - to: New owner address
      //    - tokenId: ID of the NFT to transfer
      await NFTCollection.connect(USER2).transferNFTFrom(
        ownerNFTCollection.address,
        USER1.address,
        0
      );
      
      // Verify that USER1 is now the owner of the NFT
      let ownerNFTAfterTransfer = await NFTCollection.ownerOf(0);
      expect(ownerNFTAfterTransfer).to.equal(USER1.address);
    });
  });
});
