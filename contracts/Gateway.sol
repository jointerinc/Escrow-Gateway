// SPDX-License-Identifier: MIT
pragma solidity ^0.6.9;

import "./Ownable.sol";

interface IERC20Token {
    function balanceOf(address _owner) external view returns (uint256);
    function transfer(address _to, uint256 _value) external returns (bool);
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool);
    function approve(address _spender, uint256 _value) external returns (bool);
}

interface IEscrow {
    function transferToGateway(uint256 value, uint256 channelId) external returns(uint256 send);
    function transferFromGateway(uint256 value, uint256 channelId) external;
    function paymentFromGateway(uint256 channelId, address token, uint256 value, uint256 soldValue) external payable;
}

contract Gateway is Ownable {
    IERC20Token public tokenContract;
    IEscrow public escrowContract;
    address public admin;
    address public jointerVoting;   //Jointer voting contract can block specific Channel or Wallet

    struct Wallet {
        string name;
        address payable wallet;
        bool isBlocked;  // Block wallet transfer tokens to.
    }

    struct Channel {
        string name;    // name of channel
        uint256 amount; // Amount of token received from Escrow
        uint256 spend;  // Amount of token spend from channel (sent to Market, SmartSwap, etc.)
        bool isBlocked;  // Block entire channel to transfer tokens to any wallets.
        Wallet[] wallets;   // list of wallets where allowed to transfer (exchanges wallets, Bancor, etc).
        
    }

    Channel[] channels;     // list of liquidity channels

    event SetWallet(uint256 indexed channelId, uint256 walletId, address wallet, string name);
    event AddChannel(uint256 indexed channelId, string name);
    event ReceivedETH(address indexed from, uint256 value);
    event TransferTokens(uint256 indexed channelId, address indexed to, uint256 value, string walletName);
    event BlockWallet(uint256 indexed channelId, uint256 walletId, bool isBlock);
    event BlockChannel(uint256 indexed channelId, bool isBlock);

    /**
     * @dev Throws if called by any account other than the admin.
     */
    modifier onlyAdmin() {
        require(admin == msg.sender,"Not admin");
        _;
    }

    constructor() public {
        channels.push();
        channels[0].name = "Gateway supply";  // this supply may be used for paying listing fee, or send to Bancor
        channels.push();
        channels[1].name = "SmartSwap P2C";
        channels.push();
        channels[2].name = "Crypto Exchanges";
    }

    // Safe Math subtract function
    function safeSub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    // Safe Math add function
    function safeAdd(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }

    /**
     * @dev Set token contract address.
     * @param token The address of token contract.
     */
    function setTokenContract(IERC20Token token) external onlyOwner {
        require(token != IERC20Token(0) && tokenContract == IERC20Token(0),"Change address not allowed");
        tokenContract = token;
    }

    /**
     * @dev Set escrow contract address
     * @param escrow The address of escrow contract.
     */
    function setEscrowContract(address payable escrow) external onlyOwner {
        require(escrow != address(0),"Zero address");
        escrowContract = IEscrow(escrow);
    }

    /**
     * @dev Set gateway contract address
     * @param _admin The addresses of gateway contract.
     */
    function setAdmin(address payable _admin) external onlyOwner {
        require(_admin != address(0),"Zero address");
        admin = _admin;
    }

    function addChannell(string calldata name) external onlyOwner {
        uint256 channelId = channels.length;
        channels.push();
        channels[channelId].name = name;
        emit AddChannel(channelId, name);
    }

    function getChannelsNumber() external view returns(uint256) {
        return channels.length;
    }

    function getChannelInfo(uint256 channelId) external view returns(string memory name, uint256 amount, uint256 spend, uint256 walletsNumber) {
        name = channels[channelId].name;
        amount = channels[channelId].amount;
        spend = channels[channelId].spend;
        walletsNumber = channels[channelId].wallets.length;
    }

    function getWalletInfo(uint256 channelId, uint256 walletId) external view returns(string memory name, address payable wallet) {
        Wallet storage w = channels[channelId].wallets[walletId];
        name = w.name;
        wallet = w.wallet;
    }

    function addWallet(uint256 channelId, string memory name, address payable wallet) external onlyOwner {
        require(wallet != address(0),"Zero address");
        uint256 walletId = channels[channelId].wallets.length;
        channels[channelId].wallets.push(Wallet(name, wallet, false));
        emit SetWallet(channelId, walletId, wallet, name);
    }

    // if wallet is address(0) - wallet removed.
    function updateWallet(uint256 channelId, uint256 walletId, address payable wallet) external onlyOwner {
        channels[channelId].wallets[walletId].wallet = wallet;
        emit SetWallet(channelId, walletId, wallet, channels[channelId].wallets[walletId].name);
    }

    // Transfer token to gateway from selected channel
    function transferToGateway(uint256 value, uint256 channelId) external onlyAdmin {
        uint256 received = escrowContract.transferToGateway(value, channelId);
        channels[channelId].amount = safeAdd(channels[channelId].amount, received);
    }

    // Gateway transfer token to Escrow
    function transferFromGateway(uint256 value, uint256 channelId) external onlyAdmin {
        require(safeSub(channels[channelId].amount, channels[channelId].spend) >= value, "Not enough available tokens");
        channels[channelId].amount = safeSub(channels[channelId].amount, value);
        tokenContract.transfer(address(escrowContract), value);
        escrowContract.transferFromGateway(value, channelId);
    }

    // transfer tokens to selected wallet (ex. Exchange wallet)
    function transferTokens(uint256 channelId, uint256 walletId, uint256 value) external onlyAdmin {
        require(safeSub(channels[channelId].amount, channels[channelId].spend) >= value, "Not enough available tokens");
        address to = channels[channelId].wallets[walletId].wallet;
        tokenContract.transfer(to, value);
        channels[channelId].spend = safeAdd(channels[channelId].spend, value);
        emit TransferTokens(channelId, to, value, channels[channelId].wallets[walletId].name);
    }

    // Block selected wallet transfer to.
    function blockWallet(uint256 channelId, uint256 walletId, bool isBlock) external {
        require(msg.sender == jointerVoting, "Only JNTR voting allowed");
        channels[channelId].wallets[walletId].isBlocked = isBlock;
        emit BlockWallet(channelId, walletId, isBlock);
    }

    // Block selected channel transfer to any wallet.
    function blockChannel(uint256 channelId, bool isBlock) external {
        require(msg.sender == jointerVoting, "Only JNTR voting allowed");
        channels[channelId].isBlocked = isBlock;
        emit BlockChannel(channelId, isBlock);
    }

    /**
     * @dev Send giveaways (received ETH/ERC20) to Escrow for splitting among participants.
     * When token sold on exchange, withdraw ETH/ERC20 to this contract address.
     * @param channelId Liquidity channel ID which sold tokens.
     * @param soldTokenAmount amount of sold tokens
     * @param receivedToken The ERC20 token address (or 0 for ETH) for which tokens were sold.
     * @param receivedAmount Amount of ETH/ERC20 received for sold tokens.
     */
    function transferGiveaways(uint256 channelId, uint256 soldTokenAmount, address receivedToken, uint256 receivedAmount) external onlyAdmin {
        require(channels[channelId].spend >= soldTokenAmount, "Wrong Sold Token Amount");
        if (receivedToken == address(0)) {
            escrowContract.paymentFromGateway{value: receivedAmount}(channelId, receivedToken, receivedAmount, soldTokenAmount);
        }
        else {
            IERC20Token(receivedToken).transfer(address(escrowContract), receivedAmount);
            escrowContract.paymentFromGateway(channelId, receivedToken, receivedAmount, soldTokenAmount);
        }
        channels[channelId].spend = safeSub(channels[channelId].spend, soldTokenAmount);
        channels[channelId].amount = safeSub(channels[channelId].amount, soldTokenAmount);
    }

    // accept ETH
    receive() external payable {
        emit ReceivedETH(msg.sender, msg.value);
    }
}
