const {expect} = require("chai");
const {ethers} = require("hardhat");

const IUniswapV2Factory = require("@uniswap/v2-core/build/IUniswapV2Factory.json");
const IUniswapV2Router02 = require("@uniswap/v2-periphery/build/IUniswapV2Router02.json");
const IUniswapV2Pair = require("@uniswap/v2-core/build/IUniswapV2Pair.json");
const IERC20 = require("@openzeppelin/contracts/build/contracts/IERC20.json");

const INFINITY_TIMESTAMP = 16683520000

describe("Token contract", function () {
    let tokenFactory;
    let token;
    let owner;
    let addr1;
    let addr2;
    let addrs;

    beforeEach(async function () {
        // Get the ContractFactory and Signers here.
        tokenFactory = await ethers.getContractFactory("Qoin");
        [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

        // To deploy our contract, we just have to call Token.deploy() and await
        // for it to be deployed(), which happens onces its transaction has been
        // mined.
        token = await tokenFactory.deploy(1000000);

        // We can interact with the contract by calling `token.method()`
        await token.deployed();
    });

    describe("Deployment", function () {
        it("Should assign the total supply of tokens to the owner", async function () {
            const ownerBalance = await token.balanceOf(owner.address);
            expect(await token.totalSupply()).to.equal(ownerBalance);
        });
    });

    describe("Transactions", function () {
        it("Should transfer tokens between accounts", async function () {
            // Transfer 50 tokens from owner to addr1
            await token.transfer(addr1.address, 50);
            const addr1Balance = await token.balanceOf(
                addr1.address
            );
            expect(addr1Balance).to.equal(50);

            // Transfer 50 tokens from addr1 to addr2
            // We use .connect(signer) to send a transaction from another account
            await token.connect(addr1).transfer(addr2.address, 50);
            const addr2Balance = await token.balanceOf(
                addr2.address
            );
            expect(addr2Balance).to.equal(50);
        });

        it("Should fail if sender doesn’t have enough tokens", async function () {
            const initialOwnerBalance = await token.balanceOf(
                owner.address
            );

            // Try to send 1 token from addr1 (0 tokens) to owner (1000 tokens).
            // `require` will evaluate false and revert the transaction.
            await expect(
                token.connect(addr1).transfer(owner.address, 1)
            ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

            // Owner balance shouldn't have changed.
            expect(await token.balanceOf(owner.address)).to.equal(
                initialOwnerBalance
            );
        });

        it("Should update balances after transfers", async function () {
            const initialOwnerBalance = await token.balanceOf(
                owner.address
            );

            // Transfer 100 tokens from owner to addr1.
            await token.transfer(addr1.address, 100);

            // Transfer another 50 tokens from owner to addr2.
            await token.transfer(addr2.address, 50);

            // Check balances
            const finalOwnerBalance = await token.balanceOf(
                owner.address
            );
            expect(finalOwnerBalance).to.equal(initialOwnerBalance - 150);

            const addr1Balance = await token.balanceOf(
                addr1.address
            );
            expect(addr1Balance).to.equal(100);

            const addr2Balance = await token.balanceOf(
                addr2.address
            );
            expect(addr2Balance).to.equal(50);
        });
    });

    describe("Uniswap", function () {
        const UniswapV2FactoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
        const UniswapV2Router02Address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
        const USDCAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"

        let uniswapFactory
        let usdcPair

        let uniswapRouter
        let wethAddress
        let usdc // USDC token contract

        beforeEach(async function () {
            uniswapFactory = new ethers.Contract(UniswapV2FactoryAddress, IUniswapV2Factory.abi, owner)

            // Create pair USDC/token
            await (await uniswapFactory.createPair(token.address, USDCAddress)).wait()

            // Get USDC/ETH pair
            const usdcPairAddress = await uniswapFactory.getPair(token.address, USDCAddress)
            usdcPair = new ethers.Contract(usdcPairAddress, IUniswapV2Pair.abi, owner)

            uniswapRouter = new ethers.Contract(UniswapV2Router02Address, IUniswapV2Router02.abi, addr1)
            wethAddress = await uniswapRouter.WETH()
            usdc = new ethers.Contract(USDCAddress, IERC20.abi, addr1)

            await (await token.transfer(addr1.address, 100000)).wait()
            expect(await token.balanceOf(addr1.address)).to.equal(100000);
        });

        it("Should match factory address", async function () {
            expect(uniswapFactory.address).to.equal(await usdcPair.factory());
        })

        async function buyUSDC(addr, amountToBuy) {
            // Pend transaction
            const buyTransaction = await uniswapRouter.connect(addr).swapETHForExactTokens(
                amountToBuy,
                [wethAddress, USDCAddress],
                addr.address,
                INFINITY_TIMESTAMP,
                {value: ethers.utils.parseEther("100")}
            )

            // Wait for transaction to execute in blockchain
            await buyTransaction.wait()
        }

        it("Should swap USDC to ETH", async function () {
            const balanceBefore = await usdc.balanceOf(addr1.address)
            const amountToBuy = 100000

            await buyUSDC(addr1, amountToBuy)

            expect(await usdc.balanceOf(addr1.address)).to.equal(balanceBefore + amountToBuy);
        })

        async function addLiquidity(address, usdcAmount, tokenAmount) {
            await buyUSDC(address, usdcAmount+100)

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

        it("Should add liquidity", async function () {
            await addLiquidity(addr1, 10000, 100000)
            const [usdcReserves, tokenReserves, _] = await usdcPair.getReserves()

            expect(usdcReserves).to.equal(10000)
            expect(tokenReserves).to.equal(100000)
        });


        it("Should swap token to USDC", async function () {
            await addLiquidity(addr1, 10000, 100000)

            // Third person now wants to can buy our token
            expect(await token.balanceOf(addr2.address)).to.equal(0)

            // Buy USDT from ETH
            await buyUSDC(addr2, 100)


            // Give allowance to uniswap
            await (await usdc.connect(addr2).approve(uniswapRouter.address, 35)).wait()
            // Swap tokens
            const swapRequest = await uniswapRouter.connect(addr2).swapTokensForExactTokens(
                300,                            // Swap 300 tokens
                35,                             // Spend at most 35 USDC
                [USDCAddress, token.address],   // Path of swaps
                addr2.address,                  // Send to addr2
                INFINITY_TIMESTAMP,             // No restrictions on time of execution
                {gasLimit: 10000000}            // Set gas limit for transaction
            )
            await swapRequest.wait()

            expect(await token.balanceOf(addr2.address)).to.equal(300)
        })
    })
});
