
// this address should be provided by Jude
const CompanyWallet = ""; // company wallet address which receive all pre-minted tokens and can manage with it in Escrow contract

const Escrow = artifacts.require("Escrow"); //Escrow.sol
// deploy Escrow and Gateway contracts for main token (JNTR)
await deployer.deploy(
    Escrow,
    CompanyWallet,
    { from: ownerWallet }
  );

  EscrowInstance = await Escrow.deployed();