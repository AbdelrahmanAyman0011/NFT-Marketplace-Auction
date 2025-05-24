import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

/**
 * Deploy a Marketplace contract
 * Returns: 
 *  - Marketplace: The deployed marketplace contract instance
 *  - owner: The contract deployer (default signer)
 *  - USER1, USER2: Additional test accounts
 */
async function deployNFTMarketplaceFixture() {
  const [owner, USER1, USER2] = await ethers.getSigners(); // Gets test accounts from hardhat
  const MarketplaceFactory = await ethers.getContractFactory("Marketplace"); // Creates factory for contract deployment
  const Marketplace = await MarketplaceFactory.deploy("My NFT Marketplace"); // Deploys with marketplace name parameter

  return { Marketplace, owner, USER1, USER2 };
}

/**
 * Deploy Marketplace, NFT Collection, Payment Token contracts and mint 1 NFT
 * Returns:
 *  - Marketplace: The deployed marketplace contract
 *  - NFTCollection: Deployed NFT contract 
 *  - PaymentToken: Deployed ERC20 token contract for payments
 *  - owner, USER1, USER2: Test accounts
 */
async function deployFixture1() {
  const { Marketplace, owner, USER1, USER2 } =
    await deployNFTMarketplaceFixture();

  const NFTCollectionFactory = await ethers.getContractFactory("NFTCollection");
  const NFTCollection = await NFTCollectionFactory.deploy(); // Deploy NFT collection contract

  const PaymentTokenFactory = await ethers.getContractFactory("ERC20");
  const PaymentToken = await PaymentTokenFactory.deploy(
    1000000, // Initial token supply
    "Test Token", // Token name
    "XTS" // Token symbol
  );
  await NFTCollection.mintNFT("Test NFT", "test.uri.domain.io"); // Mint a test NFT with name and URI
  return { Marketplace, NFTCollection, PaymentToken, owner, USER1, USER2 };
}

/**
 * Deploy contracts, mint NFT, and create an auction
 * Returns marketplace setup with an active auction:
 *  - All contracts and accounts from deployFixture1
 *  - NFT approved for marketplace to transfer
 *  - Auction already created with NFT ID 0
 */
async function deployFixture2() {
  const { Marketplace, NFTCollection, PaymentToken, owner, USER1, USER2 } =
    await deployFixture1();
  
  // Approve NFT transfer by the marketplace for token ID 0
  await NFTCollection.approve(Marketplace.address, 0);

  // Create new auction with:
  let endAuction = Math.floor(Date.now() / 1000) + 3600; // End time 1 hour from now
  await Marketplace.createAuction(
    NFTCollection.address, // NFT contract address
    PaymentToken.address, // Payment token contract address
    0, // NFT ID
    50, // Initial bid price
    endAuction // Auction end timestamp
  );
  return { Marketplace, NFTCollection, PaymentToken, owner, USER1, USER2 };
}

/**
 * Deploy contracts, create auction, and place a bid
 * Returns marketplace with auction that has one bid already:
 *  - All contracts and accounts from deployFixture2
 *  - USER1 has tokens and has placed a bid of 500 on auction ID 0
 */
async function deployFixture3() {
  const { Marketplace, NFTCollection, PaymentToken, owner, USER1, USER2 } =
    await deployFixture2();

  // Approve token spending by marketplace for USER1
  await PaymentToken.connect(USER1).approve(Marketplace.address, 10000);
  
  // Credit USER1 balance with tokens from owner
  await PaymentToken.transfer(USER1.address, 10000);
  
  // Place new bid with USER1 on auction 0 with amount 500
  await Marketplace.connect(USER1).bid(0, 500);

  return { Marketplace, NFTCollection, PaymentToken, owner, USER1, USER2 };
}

/**
 * Setup for testing claim functions (claimNFT and claimToken)
 * @param bider - Boolean flag: if true, includes a bid on the auction; if false, creates auction without bids
 * Returns testing environment for claim functions with:
 *  - USER1 creates the NFT and the auction
 *  - USER2 places a bid of 500 (if bider=true)
 *  - All necessary approvals and transfers set up
 */
async function claimFunctionSetUp(bider: boolean) {
  const { Marketplace, USER1, USER2 } = await deployNFTMarketplaceFixture();
  const NFTCollectionFactory = await ethers.getContractFactory("NFTCollection");
  const NFTCollection = await NFTCollectionFactory.deploy();

  const PaymentTokenFactory = await ethers.getContractFactory("ERC20");
  const PaymentToken = await PaymentTokenFactory.deploy(
    1000000, // Initial token supply
    "Test Token", // Token name
    "XTS" // Token symbol
  );
  
  // USER1 mints an NFT
  await NFTCollection.connect(USER1).mintNFT("Test NFT", "test.uri.domain.io");
  
  // USER1 approves marketplace for NFT transfer
  await NFTCollection.connect(USER1).approve(Marketplace.address, 0);

  // Get current blockchain timestamp
  const currentTimestamp = await time.latest();
  let endAuction = currentTimestamp + 3600; // Auction ends 1 hour from now
  
  // USER1 creates auction for NFT ID 0 with min price 50
  await Marketplace.connect(USER1).createAuction(
    NFTCollection.address,
    PaymentToken.address,
    0,
    50,
    endAuction
  );

  // If bider flag is true, set up USER2 to place a bid
  if (bider) {
    // Allow marketplace contract to transfer tokens from USER2
    await PaymentToken.connect(USER2).approve(Marketplace.address, 10000);
    
    // Credit USER2 balance with tokens
    await PaymentToken.transfer(USER2.address, 20000);
    
    // USER2 places bid of 500 on auction ID 0
    await Marketplace.connect(USER2).bid(0, 500);
  }
  return { Marketplace, NFTCollection, PaymentToken, USER1, USER2 };
}

// Test specific functions within describe blocks:

// createAuction(nftContract, tokenContract, tokenId, initialPrice, endTime)
// Creates a new auction for an NFT with specified payment token and parameters

// bid(auctionId, bidAmount)
// Places a new bid on an existing auction

// claimNFT(auctionId)
// Allows auction winner to claim their NFT after auction ends

// claimToken(auctionId)
// Allows auction creator to claim payment tokens after auction ends

// refund(auctionId)
// Allows auction creator to reclaim NFT if no bids were placed and auction ended

// getCurrentBid(auctionId) 
// Returns the current highest bid amount for an auction

// getCurrentBidOwner(auctionId)
// Returns the address of the current highest bidder
describe("Marketplace contract tests", () => {
  describe("Deployment", () => {
    it("Should set the correct name", async () => {
      const { Marketplace } = await loadFixture(
        deployNFTMarketplaceFixture.bind(null, false)
      );
      expect(await Marketplace.name()).to.equal("My NFT Marketplace");
    });

    it("Should intialize auction sequence to 0", async () => {
      const { Marketplace } = await loadFixture(
        deployNFTMarketplaceFixture.bind(null, false)
      );

      expect(await Marketplace.index()).to.equal(0);
    });
  });

  describe("Transactions - Create Auction", () => {
    describe("Create Auction - Failure", () => {
      let endAuction = Math.floor(Date.now() / 1000) + 10000;

      it("Should reject Auction because the NFT collection contract address is invalid", async () => {
        const { Marketplace, PaymentToken, USER1 } = await loadFixture(
          deployFixture1
        );

        await expect(
          Marketplace.createAuction(
            USER1.address,
            PaymentToken.address,
            0,
            50,
            endAuction
          )
        ).to.be.revertedWith("Invalid NFT Collection contract address");
      });

      it("Should reject Auction because the Payment token contract address is invalid", async () => {
        const { Marketplace, NFTCollection, USER1 } = await loadFixture(
          deployFixture1
        );

        await expect(
          Marketplace.createAuction(
            NFTCollection.address,
            USER1.address,
            0,
            50,
            endAuction
          )
        ).to.be.revertedWith("Invalid Payment Token contract address");
      });

      it("Should reject Auction because the end date of the auction is invalid", async () => {
        let invalidEndAuction = 1111111111;
        const { Marketplace, NFTCollection, PaymentToken } = await loadFixture(
          deployFixture1
        );

        await expect(
          Marketplace.createAuction(
            NFTCollection.address,
            PaymentToken.address,
            0,
            50,
            invalidEndAuction
          )
        ).to.be.revertedWith("Invalid end date for auction");
      });

      it("Should reject Auction because the initial bid price is invalid", async () => {
        const { Marketplace, NFTCollection, PaymentToken } = await loadFixture(
          deployFixture1
        );

        await expect(
          Marketplace.createAuction(
            NFTCollection.address,
            PaymentToken.address,
            1,
            0,
            endAuction
          )
        ).to.be.revertedWith("Invalid initial bid price");
      });

      it("Should reject Auction because caller is not the owner of the NFT", async () => {
        const { Marketplace, NFTCollection, PaymentToken, USER1 } =
          await loadFixture(deployFixture1);

        await expect(
          Marketplace.connect(USER1).createAuction(
            NFTCollection.address,
            PaymentToken.address,
            0,
            50,
            endAuction
          )
        ).to.be.revertedWith("Caller is not the owner of the NFT");
      });

      it("Should reject Auction because owner of the NFT hasnt approved ownership transfer", async () => {
        const { Marketplace, NFTCollection, PaymentToken } = await loadFixture(
          deployFixture1
        );

        await expect(
          Marketplace.createAuction(
            NFTCollection.address,
            PaymentToken.address,
            0,
            50,
            endAuction
          )
        ).to.be.revertedWith("Require NFT ownership transfer approval");
      });
    });

    describe("Create Auction - Success", () => {
      let endAuction = Math.floor(Date.now() / 1000) + 10000;

      it("Check if auction is created", async () => {
        const { Marketplace, NFTCollection, PaymentToken } = await loadFixture(
          deployFixture1
        );
        await NFTCollection.approve(Marketplace.address, 0);

        await Marketplace.createAuction(
          NFTCollection.address,
          PaymentToken.address,
          0,
          50,
          endAuction
        );
        const currentBid = await Marketplace.getCurrentBid(0);
        expect(currentBid).to.equal(50);
      });

      it("Owner of NFT should be the marketplace contract ", async () => {
        const { Marketplace, NFTCollection, PaymentToken } = await loadFixture(
          deployFixture1
        );
        await NFTCollection.approve(Marketplace.address, 0);
        await Marketplace.createAuction(
          NFTCollection.address,
          PaymentToken.address,
          0,
          50,
          endAuction
        );
        const ownerNFT = await NFTCollection.ownerOf(0);
        expect(ownerNFT).to.equal(Marketplace.address);
      });
    });
  });
  describe("Transactions - Place new Bid on auction", () => {
    describe("Place new Bid on an auction - Failure", () => {
      it("Should reject new Bid because the auction index is invalid", async () => {
        const { Marketplace, USER1 } = await loadFixture(deployFixture2);

        await expect(
          Marketplace.connect(USER1).bid(4545, 100)
        ).to.be.revertedWith("Invalid auction index");
      });

      it("Should reject new Bid because the new bid amount is invalid", async () => {
        const { Marketplace, USER1 } = await loadFixture(deployFixture2);
        await expect(Marketplace.connect(USER1).bid(0, 25)).to.be.revertedWith(
          "New bid price must be higher than the current bid"
        );
      });

      it("Should reject new Bid because caller is the creator of the auction", async () => {
        const { Marketplace } = await loadFixture(deployFixture2);
        await expect(Marketplace.bid(0, 60)).to.be.revertedWith(
          "Creator of the auction cannot place new bid"
        );
      });

      it("Should reject new Bid because marketplace contract has no approval for token transfer", async () => {
        const { Marketplace, USER1 } = await loadFixture(deployFixture2);
        await expect(Marketplace.connect(USER1).bid(0, 60)).to.be.revertedWith(
          "Invalid allowance"
        );
      });

      it("Should reject new Bid because new bider has not enought balances", async () => {
        const { Marketplace, PaymentToken, USER1 } = await loadFixture(
          deployFixture2
        );

        await PaymentToken.connect(USER1).approve(Marketplace.address, 10000);

        await expect(Marketplace.connect(USER1).bid(0, 60)).to.be.reverted;
      });
    });

    describe("Place new Bid on an auction - Success", () => {
      it("Token balance of new bider must be debited with the bid amount", async () => {
        const { PaymentToken, USER1 } = await loadFixture(deployFixture3);
        let USER1Bal = await PaymentToken.balanceOf(USER1.address);
        expect(USER1Bal).to.equal(9500);
      });

      it("Token balance of Marketplace contract must be updated with new bid amount", async () => {
        const { Marketplace, PaymentToken } = await loadFixture(deployFixture3);
        let marketplaceBal = await PaymentToken.balanceOf(Marketplace.address);
        expect(marketplaceBal).to.equal(500);
      });

      it("Auction info are correctly updated", async () => {
        const { Marketplace, USER1 } = await loadFixture(deployFixture3);
        let currentBidOwner = await Marketplace.getCurrentBidOwner(0);
        expect(currentBidOwner).to.equal(USER1.address);
        let currentBid = await Marketplace.getCurrentBid(0);
        expect(currentBid).to.equal(500);
      });

      it("Current bid owner must be refunded after a new successful bid is placed", async () => {
        const { Marketplace, PaymentToken, USER1, USER2 } = await loadFixture(
          deployFixture3
        );
        // Allow marketplace contract to tranfer token of USER2

        await PaymentToken.connect(USER2).approve(Marketplace.address, 20000);
        // Credit USER2 balance with some tokens
        await PaymentToken.transfer(USER2.address, 20000);
        // Place new bid with USER2
        await Marketplace.connect(USER2).bid(0, 1000);

        let USER1Bal = await PaymentToken.balanceOf(USER1.address);
        expect(USER1Bal).to.equal(10000);

        let USER2Bal = await PaymentToken.balanceOf(USER2.address);
        expect(USER2Bal).to.equal(19000);

        let marketplaceBal = await PaymentToken.balanceOf(Marketplace.address);
        expect(marketplaceBal).to.equal(1000);

        let currentBidOwner = await Marketplace.getCurrentBidOwner(0);
        expect(currentBidOwner).to.equal(USER2.address);
        let currentBid = await Marketplace.getCurrentBid(0);
        expect(currentBid).to.equal(1000);
      });
    });
  });

  describe("Transactions - Claim NFT", () => {
    describe("Claim NFT - Failure", () => {
      it("Should reject because auction is still open", async () => {
        const { Marketplace, USER2 } = await loadFixture(
          claimFunctionSetUp.bind(null, true, 3600)
        );

        await expect(Marketplace.connect(USER2).claimNFT(0)).to.be.revertedWith(
          "Auction is still open"
        );
      });

      it("Should reject because caller is not the current bid owner", async () => {
        const { Marketplace, USER1 } = await loadFixture(
          claimFunctionSetUp.bind(null, true, 3600)
        );

        // Increase block timestamp
        await time.increase(3700);

        await expect(Marketplace.connect(USER1).claimNFT(0)).to.be.revertedWith(
          "NFT can be claimed only by the current bid owner"
        );
      });
    });

    describe("Claim NFT - Success", () => {
      it("Winner of the auction must be the new owner of the NFT", async () => {
        const { Marketplace, NFTCollection, USER2 } = await loadFixture(
          claimFunctionSetUp.bind(null, true, 4000)
        );
        // Increase block timestamp
        await time.increase(5000);

        await Marketplace.connect(USER2).claimNFT(0);

        let newOwnerNFT = await NFTCollection.ownerOf(0);
        expect(newOwnerNFT).to.equal(USER2.address);
      });

      it("Creator of the auction must have his token balance credited with the highest bid amount", async () => {
        const { Marketplace, PaymentToken, USER1, USER2 } = await loadFixture(
          claimFunctionSetUp.bind(null, true, 4400)
        );

        // Increase block timestamp
        await time.increase(5000);

        await Marketplace.connect(USER2).claimNFT(0);

        let auctionCreatorBal = await PaymentToken.balanceOf(USER1.address);
        expect(auctionCreatorBal).to.equal(500);

        let marketPlaceBal = await PaymentToken.balanceOf(Marketplace.address);
        expect(marketPlaceBal).to.equal(0);
      });

      it("Winner of the auction should not be able to claim NFT more than one time", async () => {
        const { Marketplace, USER2 } = await loadFixture(
          claimFunctionSetUp.bind(null, true)
        );

        // // Increase block timestamp
        await time.increase(5000);

        await Marketplace.connect(USER2).claimNFT(0);
        await expect(Marketplace.connect(USER2).claimNFT(0)).to.be.revertedWith(
          "ERC721: caller is not token owner or approved"
        );
      });
    });
  });

  describe("Transactions - Claim Token", () => {
    describe("Claim Token - Failure", () => {
      it("Should reject because auction is still open", async () => {
        const { Marketplace, USER1 } = await loadFixture(
          claimFunctionSetUp.bind(null, true)
        );

        await expect(
          Marketplace.connect(USER1).claimToken(0)
        ).to.be.revertedWith("Auction is still open");
      });

      it("Should reject because caller is not the creator of the auction", async () => {
        const { Marketplace, USER2 } = await loadFixture(
          claimFunctionSetUp.bind(null, true)
        );

        // Increase block timestamp
        await time.increase(5000);

        await expect(
          Marketplace.connect(USER2).claimToken(0)
        ).to.be.revertedWith(
          "Tokens can be claimed only by the creator of the auction"
        );
      });
    });

    describe("Claim Token - Success", () => {
      it("Winner of the auction must be the new owner of the NFT", async () => {
        const { Marketplace, NFTCollection, USER1, USER2 } = await loadFixture(
          claimFunctionSetUp.bind(null, true)
        );

        // Increase block timestamp
        await time.increase(5000);

        await Marketplace.connect(USER1).claimToken(0);

        let newOwnerNFT = await NFTCollection.ownerOf(0);
        expect(newOwnerNFT).to.equal(USER2.address);
      });

      it("Creator of the auction must have his token balance credited with the highest bid amount", async () => {
        const { Marketplace, PaymentToken, USER1 } = await loadFixture(
          claimFunctionSetUp.bind(null, true)
        );

        // Increase block timestamp
        await time.increase(5000);
        await Marketplace.connect(USER1).claimToken(0);

        let auctionCreatorBal = await PaymentToken.balanceOf(USER1.address);
        expect(auctionCreatorBal).to.equal(500);

        let marketPlaceBal = await PaymentToken.balanceOf(Marketplace.address);
        expect(marketPlaceBal).to.equal(0);
      });

      it("Creator of the auction should not be able to claim his token more than one time", async () => {
        const { Marketplace, USER1 } = await loadFixture(
          claimFunctionSetUp.bind(null, true)
        );

        // Increase block timestamp
        await time.increase(5000);
        await Marketplace.connect(USER1).claimToken(0);
        await expect(
          Marketplace.connect(USER1).claimToken(0)
        ).to.be.revertedWith("ERC721: caller is not token owner or approved");
      });
    });
  });

  describe("Transactions - Refund NFT", () => {
    describe("Refund NFT - Failure", () => {
      it("Should reject because there is already a bider on the auction", async () => {
        const { Marketplace, USER1 } = await loadFixture(
          claimFunctionSetUp.bind(null, true)
        );

        // Increase block timestamp
        await time.increase(5000);

        await expect(Marketplace.connect(USER1).refund(0)).to.be.revertedWith(
          "Existing bider for this auction"
        );
      });
    });

    describe("Refund NFT - Success", () => {
      it("Creator of the auction must be again the owner of the NFT", async () => {
        const { Marketplace, NFTCollection, USER1 } = await loadFixture(
          claimFunctionSetUp.bind(null, false)
        );

        // Increase block timestamp
        await time.increase(5000);

        await Marketplace.connect(USER1).refund(0);

        let newOwnerNFT = await NFTCollection.ownerOf(0);
        expect(newOwnerNFT).to.equal(USER1.address);
      });
    });
  });
});
