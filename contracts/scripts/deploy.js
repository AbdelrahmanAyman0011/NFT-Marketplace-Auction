async function main() {
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy("My Marketplace"); // required string arg
  await marketplace.deployed();
  console.log("Marketplace deployed to:", marketplace.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
