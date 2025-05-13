const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace", function () {
  it("Should deploy the contract and check the name", async function () {
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy("NFT Marketplace");

    expect(await marketplace.name()).to.equal("NFT Marketplace");
  });
});
