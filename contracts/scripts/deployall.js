async function main() {
  const ERC20 = await ethers.getContractFactory("ERC20");
  const erc20 = await ERC20.deploy("1000000", "MyToken", "MTK");

  const NFTCollection = await ethers.getContractFactory("NFTCollection");
  const nft = await NFTCollection.deploy();

  const Marketplace = await ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy("My Marketplace");

  console.log("ERC20 deployed to:", erc20.address);
  console.log("NFTCollection deployed to:", nft.address);
  console.log("Marketplace deployed to:", marketplace.address);
}
main();