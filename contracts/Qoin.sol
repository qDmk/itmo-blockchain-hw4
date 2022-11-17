pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// We import this library to be able to use console.log
import "hardhat/console.sol";

// Our coin is ERC20 token
contract Qoin is ERC20 {
    constructor(uint totalSupply) ERC20("Qoin", "QOIN") {
        _mint(msg.sender, totalSupply);
    }
}
