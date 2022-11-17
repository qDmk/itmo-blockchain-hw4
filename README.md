# Homework 4

#### _“Solidity + EVM, low-level patterns”_

### How to start

- (Optionally) Replace `demo` with your Alchemy API key in [`hardhat.config.ts`](hardhat.config.ts)
- Run tests:
    ``` bash 
    npm install
    npx hardhat test
    ```

### Log example

```
  Token contract
    Deployment
      ✔ Should assign the total supply of tokens to the owner
    Transactions
      ✔ Should transfer tokens between accounts
      ✔ Should fail if sender doesn’t have enough tokens
      ✔ Should update balances after transfers
    Uniswap
      ✔ Should match factory address
      ✔ Should swap USDC to ETH (3021ms)
      ✔ Should add liquidity (1146ms)
      ✔ Should swap token to USDC (1513ms)


  8 passing (14s)
```

### Key functions

- #### Add liquidity

```js
async function addLiquidity(address, usdcAmount, tokenAmount) {
    await buyUSDC(address, usdcAmount + 100)

    // Give allowance for USDC
    const usdcAsAddress = usdc.connect(address)
    await (await usdcAsAddress.approve(uniswapRouter.address, usdcAmount)).wait()
    expect(await usdcAsAddress.allowance(address.address, uniswapRouter.address)).to.equal(usdcAmount)

    // Give allowance for token
    const tokenAsAddress = token.connect(address)
    await (await tokenAsAddress.approve(uniswapRouter.address, tokenAmount)).wait()
    expect(await tokenAsAddress.allowance(address.address, uniswapRouter.address)).to.equal(tokenAmount)

    // Add liquidity to pool
    const addLiquidityRequest = await uniswapRouter.connect(address).addLiquidity(
        usdc.address,
        token.address,
        usdcAmount,
        tokenAmount,
        usdcAmount,
        tokenAmount,
        address.address,
        INFINITY_TIMESTAMP,
        {gasLimit: 1000000}
    )
    // wait for execution
    await addLiquidityRequest.wait()
}
```

- #### Swap tokens

```js
const swapRequest = await uniswapRouter.connect(addr2).swapTokensForExactTokens(
    300,                            // Swap 300 tokens
    35,                             // Spend at most 35 USDC
    [USDCAddress, token.address],   // Path of swaps
    addr2.address,                  // Send to addr2
    INFINITY_TIMESTAMP,             // No restrictions on time of execution
    {gasLimit: 10000000}            // Set gas limit for transaction
)
```