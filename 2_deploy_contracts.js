const TruffleContract = require("@truffle/contract");

// Governance contracts for all users (Global)
const Governance = artifacts.require("Governance"); //Governance.sol
const GovernanceProxy = artifacts.require("GovernanceProxy"); //GovernanceProxy.sol

// Governance contracts for escrowed users (only for users in Escrow contract)
const EscrowedGovernance = artifacts.require("Governance"); //Governance.sol
const EscrowedGovernanceProxy = artifacts.require("GovernanceProxy"); //GovernanceProxy.sol

// contract for Real Estate wallet (used as companyFundWalletAddress in Auction.sol)
const RealEstate = artifacts.require("Realestate"); //Realestate.sol

// Escrow-Gateway contracts
const Escrow = artifacts.require("Escrow"); //Escrow.sol
const Gateway = artifacts.require("Gateway"); //Gateway.sol

// this address should be provided by Jude
const CompanyWallet = ""; // company wallet address which receive all pre-minted tokens and can manage with it in Escrow contract
const CEOwallet = "";   // address of CEO (Jude) wallet that should participate in Absolute Majority voting and can manage (add/remove) other CEO wallets


// other required contract addresses
const MainTokenContract = ""; // JNTR token contract address
const EtnTokenContract = ""; // ETN token contract address
const StockTokenContract = ""; // STOCK token contract address
const AuctionRegistery = "";  // AuctionRegistery contract address (require to get addresses of SMART_SWAP_P2P and LIQUADITY)
const WhiteListContract = ""; // const WhiteList contract address

// contracts that should be excluded from Circulation Supply calculation
const TokenVaultContract = "";
const AuctionProtectionContract = "";
const MainReserveContract = ""; //Bancor contract address which hold JNTR tokens
const SmartSwapP2CContract = ""; // SmartSwap P2C contract address

// the wallet from Auction deploy script
const ownerWallet = "0x153d9909f3131e6a09390b33f7a67d40418c0318";

module.exports = async function (deployer) {

// deploy main (Global) Governance
  await deployer.deploy(
    Governance,
    CEOwallet,
    { from: ownerWallet }
  );

  GovernanceInstance = await Governance.deployed();

  await deployer.deploy(
    GovernanceProxy,
    Governance.address,
    { from: ownerWallet }
  );

  GovernanceProxyInstance = await GovernanceProxy.deployed();

// deploy escrowed Governance
await deployer.deploy(
    EscrowedGovernance,
    CEOwallet,
    { from: ownerWallet }
  );

  EscrowedGovernanceInstance = await EscrowedGovernance.deployed();

  await deployer.deploy(
    EscrowedGovernanceProxy,
    EscrowedGovernance.address,
    { from: ownerWallet }
  );

  EscrowedGovernanceProxyInstance = await EscrowedGovernanceProxy.deployed();

// deploy Escrow and Gateway contracts for main token (JNTR)
await deployer.deploy(
    Escrow,
    CompanyWallet,
    { from: ownerWallet }
  );

  EscrowInstance = await Escrow.deployed();

  await deployer.deploy(
    Gateway,
    CompanyWallet,
    { from: ownerWallet }
  );

  GatewayInstance = await Gateway.deployed();

// deploy Real Estate wallet contract and set GovernanceProxy.address as Owner

await deployer.deploy(
    RealEstate,
    GovernanceProxy.address,
    { from: ownerWallet }
  );

  RealEstateInstance = await RealEstate.deployed();

// settings for global Governance

  await GovernanceInstance.setTokenContract(MainTokenContract, 0);
  await GovernanceInstance.setTokenContract(EtnTokenContract, 1); // if token is not deployed may be commented
  await GovernanceInstance.setTokenContract(StockTokenContract, 2); // if token is not deployed may be commented
  //await GovernanceInstance.setTokenContract(Escrow.address, 3); // add JNTR Escrowed community to Edge co-voting

  await GovernanceInstance.setWhitelist(WhiteListContract);
  await GovernanceInstance.setEscrowContract(Escrow.address,0); // the Escrow contract for pre-minted Main (JNTR) token. Pre-mint all Main tokens to this address (Escrow.address)
  //await GovernanceInstance.setEscrowContract(EscrowEtn.address,1); // the Escrow contract for pre-minted ETN token, if needed.
  //await GovernanceInstance.setEscrowContract(EscrowStock.address,2); // the Escrow contract for pre-minted STOCK token, if needed.
  await GovernanceInstance.setGovernanceProxy(GovernanceProxy.address); // GovernanceProxy.address should be the Owner and authorityAddress of most other contracts. 
  await GovernanceInstance.updateCloseTime(); // update voting close time;

  await GovernanceInstance.addExcluded(0,[CompanyWallet,TokenVaultContract,AuctionProtectionContract,MainReserveContract]); // addresses excluded from JNTR Circulation Supply calculation
  await GovernanceInstance.manageBlockedWallet(CompanyWallet, true);  // Block Company Wallet from voting.

// settings for escrowed Governance

  await EscrowedGovernanceInstance.setTokenContract(Escrow.address, 0); // use Escrow contract instead of Main token contract. It allow only escrowed user to vote
  await EscrowedGovernanceInstance.setWhitelist(WhiteListContract);
  await EscrowedGovernanceInstance.setGovernanceProxy(EscrowedGovernanceProxy.address); // GovernanceProxy.address should be the Owner of most other contracts. 
  await EscrowedGovernanceInstance.updateCloseTime(); // update voting close time;
  // Company should be excluded from voting.
  await EscrowedGovernanceInstance.addExcluded(0,[CompanyWallet]); // addresses excluded from JNTR Circulation Supply calculation
  await EscrowedGovernanceInstance.manageBlockedWallet(CompanyWallet, true);  // Block Company Wallet from voting.

// settings for JNTR Escrow 

  await EscrowInstance.setTokenContract(MainTokenContract);
  await EscrowInstance.setGatewayContract(Gateway.address);
  await EscrowInstance.updateRegistery(AuctionRegistery); // require to get addresses of SMART_SWAP_P2P and LIQUADITY.
  await EscrowInstance.setGovernanceContract(Governance.address); // Used to add into isInEscrow list (in global Governance contract) escrowed wallets
  //await EscrowInstance.transferOwnership(EscrowedGovernanceProxy.address); // All changes may be done only via Escrowed Governance (voting)
  //await EscrowInstance.init(); // call from company wallet address. Automatically transfer all pre-minted tokens to Company wallet. Can be called only once.

// settings for JNTR Gateway
  await GatewayInstance.setTokenContract(MainTokenContract);
  await GatewayInstance.setEscrowContract(Escrow.address);
  //await GatewayInstance.setJointerVotingContract(GovernanceProxy.address); // Require for Edge version. Voting has right to block channels or wallet
  await GatewayInstance.setAdmin(ownerWallet);  // Should be changed to Admin wallet, that has a right to transfer token to Exchanges

  // Add Channels and Wallets (may be done later)
  await GatewayInstance.addChannel("Gateway supply"); // group ID: 0
  await GatewayInstance.addWallet(0,"Bancor",MainReserveContract); // Bancor wallet, where to send JNTR
  await GatewayInstance.addChannel("Crypto exchanges"); // group ID: 1
  //await GatewayInstance.addWallet(1,"HitBTC","0x9D76C6bDe437490d256f8B4369890eaB123B62C4"); // Deposit address in Exchange
  //await GatewayInstance.addWallet(1,"Binance","0x9D76C6bDe437490d256f8B4369890eaB123B62C4"); // Deposit address in Exchange
  await GatewayInstance.addChannel("SmartSwap P2C"); // group ID: 2
  await GatewayInstance.addWallet(2,"SmartSwap P2C",SmartSwapP2CContract);  // SmartSwap P2C contract address
  //await GatewayInstance.transferOwnership(EscrowedGovernanceProxy.address); // All changes may be done only via Escrowed Governance (voting)


  // adding rules (the settings which can be changed by voting) to the Governance contract
  const Rules = [
    {
        //name: "Move user from one group to another.",
        address: Escrow.address,
        ABI: "moveToGroup(address,uint256)",
        majority: [50,0,0,0],   // Majority percentage according tokens community [Main (JNTR), ETN, STOCK, JNTR co-voting with Edge (if needed)]
    },
    {
        //name: "Add new group with rate.",
        address: Escrow.address,
        ABI: "addGroup(uint256)",
        majority: [50,0,0,0],
    },
    {
        //name: "Change group rate.",
        address: Escrow.address,
        ABI: "changeGroupRate(uint256,uint256)",
        majority: [50,0,0,0],
    },
    {
        //name: "Change group restriction.",
        address: Escrow.address,
        ABI: "setGroupRestriction(uint256,uint256)",
        majority: [50,0,0,0],
    },
    {
        //name: "Add new channel.",
        address: Gateway.address,
        ABI: "addChannel(string)",
        majority: [50,0,0,0],
    },
    {
        //name: "Add new wallet to channel.",
        address: Gateway.address,
        ABI: "addWallet(uint256,string,address)",
        majority: [50,0,0,0],
    },
    {
        //name: "Change Gateway admin wallet.",
        address: Gateway.address,
        ABI: "setAdmin(address)",
        majority: [50,0,0,0],
    },
    {
        //name: "Block selected wallet transfer to.",
        address: Gateway.address,
        ABI: "blockWallet(uint256,uint256,bool)",   //blockWallet(uint256 channelId, uint256 walletId, bool isBlock)
        majority: [50,0,0,0],
    },
    {
        //name: "Block selected channel transfer to any wallet.",
        address: Gateway.address,
        ABI: "blockChannel(uint256,bool)",  //blockChannel(uint256 channelId, bool isBlock)
        majority: [50,0,0,0],
    },
    // other rules can be added later
  ];

  var i=0;
  while (i<Rules.length){ // `for` loop does not work correctly, so I use `while`
      EscrowedGovernanceInstance.addRule(Rules[i].address, Rules[i].majority, Rules[i].ABI); // rules for Escrowed Governance
      i++;
  }

};
