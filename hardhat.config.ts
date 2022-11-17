import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
    solidity: "0.8.17",
    networks: {
        hardhat: {
            forking: {
                url: "https://eth-mainnet.alchemyapi.io/v2/demo",
            }
        }
    }
};

export default config;
