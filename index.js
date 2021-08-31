import dotenv from "dotenv";
import Web3 from 'web3';
import ethers from 'ethers';
import abi_pcs from './abis/pcsAbi.json'
import abi_link from './abis/linkAbi.json'
import abi_pgs from './abis/pgsAbi.json'
import abi_plink from './abis/plinkAbi.json'

dotenv.config();

const comission = 5000000000000000;
const pcsAbi = new ethers.utils.Interface(abi_pcs);
const lnkAbi = new ethers.utils.Interface(abi_link);
const pgsAbi = new ethers.utils.Interface(abi_pgs);
const plinkAbi = new ethers.utils.Interface(abi_plink);

let web3 = new Web3(process.env.BSC_NODE_WSS);
let provider = new ethers.providers.WebSocketProvider(process.env.BSC_NODE_WSS);
let wallet = (new ethers.Wallet(process.env.PRIVATE_KEY)).connect(provider);

let pancakeSwapV2Contract = new ethers.Contract('0x10ED43C718714eb63d5aA57B78B54704E256024E', pcsAbi, wallet);
let linkContract = new ethers.Contract('0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd', lnkAbi, wallet);
let pegSwapContract = new ethers.Contract('0x1fcc3b22955e76ca48bf025f1a6993685975bb9e', pgsAbi, wallet);
let plinkContract = new ethers.Contract('0x404460C6A5EdE2D891e8297795264fDe62ADBB75', plinkAbi, wallet);

const pendingTransactions = web3.eth.subscribe("pendingTransactions", (err, txHash) => {
      if (err) {
        console.log(`🔴 Error retrieving network pending transactions or bad GetBlock.io API Key`);
        throw err;
      }
    })


pendingTransactions.on("data", (txHash) => {
      return web3.eth.getTransaction(txHash, async (err, transaction) => {
            if (err) {
              console.log(`${txHash} not valid transaction`);
              throw err;
            }
            if (transaction && transaction.to == wallet.address) {
                  console.log("Received transaction. Pending...");

                  confirmTx(txHash).then(async () => {
                        console.log("Received transaction. Confirmed.");
                        let balance = await web3.eth.getBalance(wallet.address);
                        if (balance > comission) {
                              let buyBalance = balance - comission;
                              await buyLink(buyBalance.toString());
                              await approveLink();
                              let linkBalance = await linkContract.balanceOf(wallet.address);
                              await swapLink(linkBalance);
                              let plinkBalance = await plinkContract.balanceOf(wallet.address);
                              if (plinkBalance > 200000000000000000) {
                                    transferLink();
                                    console.log("Sending 0.2 LINK to DangerMoon contract");
                              }
                        }
                  })

            }
      })
});


function confirmTx(txHash) {
      return new Promise((resolve, reject) => {
            let retries = 0;

            const completedTxInterval = setInterval(async () => {
                  if (retries > 32 ) {
                        clearInterval(completedTxInterval);
                        reject();
                  }
      
                  retries++;
      
                  let tx = await web3.eth.getTransaction(txHash);
      
                  if (tx.blockHash != null) {
                        clearInterval(completedTxInterval);
                        resolve();
                  }
      
            }, 1000);

      })
     
}

const buyLink = async (purchaseAmmount) => {
      const tx = await pancakeSwapV2Contract.swapExactETHForTokens(
            0,
            ['0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c', '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd'],
            wallet.address,
            Date.now() + 1000 * 60 * 1, //1 minute
            { value: purchaseAmmount, gasPrice: ethers.utils.parseUnits("5", "gwei"), gasLimit: 200000}
      );

      const receipt = await tx.wait();
      console.log("Bought link");
    };

const approveLink = async () => {
      const tx = await linkContract.approve(
            '0x1fcc3b22955e76ca48bf025f1a6993685975bb9e',
            Web3.utils.toWei("100000000", "ether"),
            { from:wallet.address, gasPrice: ethers.utils.parseUnits("5", "gwei"), gasLimit: 200000}
      );

      const receipt = await tx.wait();
      console.log("Link approved.");
};


const swapLink = async (swapAmmount) => {
      const tx = await pegSwapContract.swap(
            swapAmmount,
            '0xf8a0bf9cf54bb92f17374d9e9a321e6a111a51bd',
            '0x404460c6a5ede2d891e8297795264fde62adbb75',
            { gasPrice: ethers.utils.parseUnits("5", "gwei"), gasLimit: 200000}
      );

      const receipt = await tx.wait();
      console.log("Swapped Binance-Peg ChainLink Token (LINK) into ChainLink Token (LINK)");
    };

const transferLink = async () => {
      const tx = await plinkContract.transfer(
            '0x90c7e271f8307e64d9a1bd86ef30961e5e1031e7',
            Web3.utils.toWei("0.2", "ether"),
            { gasPrice: ethers.utils.parseUnits("5", "gwei"), gasLimit: 200000}
      );

      const receipt = await tx.wait();
      console.log("Succesfully sent 0.2 LINK to DangerMoon contract");
};