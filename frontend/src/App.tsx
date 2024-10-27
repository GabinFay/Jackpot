import React, { useState, useEffect } from 'react'
import FallingCoin from './components/UI/FallingCoin'
import PolyLotteryABI from './json/PolyLotteryABI.json'
import lastWinnerData from './json/lastWinner.json'
import lotteryInfoData from './json/lotteryInfo.json'
import { useEnsName } from 'wagmi'
import logo from './assets/logo.svg'
import './AnimatedBackground.css';

const INFURA_API_KEY = process.env.REACT_APP_INFURA_API_KEY;

if (!INFURA_API_KEY) {
  console.error("Infura API key is not set in the .env file");
}

import { DynamicWidget, DynamicContextProvider, useDynamicContext, useIsLoggedIn } from "@dynamic-labs/sdk-react-core";
import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { WalletClient, formatEther } from 'viem'
import { getContract } from 'viem'
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";


// Replace the hardcoded CONTRACT_ADDRESS with:
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '';

if (!CONTRACT_ADDRESS) {
  console.error("Contract address is not set in the .env file");
}

const SUPPORTED_NETWORKS = {
  FLARE_COSTON: 14,
  FLARE_COSTON2: 114,
}

// Add this configuration object
const dynamicNetworkConfig = {
  evmNetworks: [
    {
      chainId: SUPPORTED_NETWORKS.FLARE_COSTON2,
      chainName: 'Flare Coston2',
      nativeCurrency: {
        name: 'Coston2 Flare',
        symbol: 'C2FLR',
        decimals: 18,
      },
      rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
      blockExplorerUrls: ['https://coston2-explorer.flare.network'],
    },
    // Add Flare Coston if needed
    {
      chainId: SUPPORTED_NETWORKS.FLARE_COSTON,
      chainName: 'Flare Coston',
      nativeCurrency: {
        name: 'Coston Flare',
        symbol: 'CFLR',
        decimals: 18,
      },
      rpcUrls: ['https://coston-api.flare.network/ext/C/rpc'],
      blockExplorerUrls: ['https://coston-explorer.flare.network'],
    },
  ],
};

function App() {
  const [jackpotBalance, setJackpotBalance] = useState<string>('0')
  const [entryFee, setEntryFee] = useState<string>('0')
  const [winProbability, setWinProbability] = useState<number>(0)
  const [lastWinner, setLastWinner] = useState<string>('')
  const [lastWinAmount, setLastWinAmount] = useState<string>('0')
  const [ticketCount, setTicketCount] = useState<number>(1)
  const [fallingCoins, setFallingCoins] = useState<{ id: number; left: number }[]>([])
  const [contract, setContract] = useState<Contract | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const isLoggedIn = useIsLoggedIn()
  const { setShowAuthFlow, handleLogOut, user } = useDynamicContext();
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
      if (isLoggedIn) {
        if (primaryWallet && isEthereumWallet(primaryWallet)) {
        const walletClient = await primaryWallet.getWalletClient()

        setUpContract(walletClient)
      }
      }
    }
    init()

    const timer = setInterval(() => {
      const now = new Date()
      const nextMonday = new Date(now)
      nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7))
      nextMonday.setHours(7, 0, 0, 0)
      
      const timeDiff = nextMonday.getTime() - now.getTime()
      
      if (timeDiff > 0) {
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000)
        
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      } else {
        setTimeLeft('Drawing now!')
      }
    }, 1000)

    const checkNetwork = async () => {
      if (window.ethereum) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        setCurrentChainId(parseInt(chainId, 16));
      }
    };

    checkNetwork();

    if (window.ethereum) {
      window.ethereum.on('chainChanged', checkNetwork);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', checkNetwork);
      }
    };
  }, [])

  const setUpContract = async (walletClient: WalletClient) => {
    const jackpotContract = getContract({
      address: CONTRACT_ADDRESS,
      abi: JackpotABI,
      client: walletClient,
    })
    
    setContract(jackpotContract)
    setIsConnected(true)
    updateJackpotInfo(jackpotContract)
  }

  const updateJackpotInfo = async (jackpotContract: Contract) => {
    const balance = await jackpotContract.read.getJackpotBalance()
    setJackpotBalance(formatEther(balance.toString()))

    const fee = await jackpotContract.read.getEntryFee()
    setEntryFee(formatEther(fee.toString()))

    const probability = await jackpotContract.read.getWinProbability()
    setWinProbability(probability.toNumber())
  }

  const isSupportedNetwork = () => {
    return (
      currentChainId === SUPPORTED_NETWORKS.FLARE_COSTON ||
      currentChainId === SUPPORTED_NETWORKS.FLARE_COSTON2
    );
  };

  const enterJackpot = async () => {
    if (!contract) return;
    if (!isSupportedNetwork()) {
      alert('Please connect to a supported network (Flare Coston or Flare Coston2) to enter the Jackpot.');
      return;
    }
    try {
      const price = await contract.read.ticketPrice()
      const totalCost = price.mul(ticketCount)
      const tx = await contract.write.buyTickets(ticketCount, { value: totalCost })
      await tx.wait()
      alert('Tickets purchased successfully!')
      updateLotteryInfo(contract)
    } catch (error) {
      console.error('Error buying tickets:', error)
      alert('Error buying tickets. Please try again.')
    }
  }

  const adjustTicketCount = (amount: number) => {
    setPrevTicketCount(ticketCount);
    setTicketCount((prev) => Math.max(1, prev + amount));
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 150); // Reset after 0.1 seconds
    if (amount > 0) {
      const coinCount = Math.floor(Math.random() * 4) + 1;
      const newCoins = Array.from({ length: coinCount }, () => ({
        id: Date.now() + Math.random(),
        left: Math.random() * window.innerWidth,
      }));
      setFallingCoins((prevCoins) => [...prevCoins, ...newCoins]);
    }
  };

  const removeCoin = (id: number) => {
    setFallingCoins((prevCoins) => prevCoins.filter((coin) => coin.id !== id));
  };

  const { data: winnerEnsName } = useEnsName({
    address: lastWinner as `0x${string}`,
  })

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="animated-background"></div>
      <div className="relative z-10 min-h-screen text-white flex flex-col items-center justify-start p-4 w-full">
        <img src={logo} alt="Jackpot Logo" className="absolute top-8 left-8 w-20 h-20" />
        <div className="absolute top-8 right-8">
          <DynamicWidget />
        </div>
        <h1 className="text-6xl font-bold mb-16 text-yellow-400 mt-5">Jackpot</h1>
        <div className="rounded-lg max-w-4xl w-full">
          <div className="p-8 flex justify-between items-center">
            <h2 className="text-3xl font-semibold text-white">Current Jackpot:</h2>
            <p className="text-4xl font-bold text-green-400">
              {jackpotBalance} JACK
            </p>
          </div>
          <div className="p-8 flex justify-between items-center">
            <h2 className="text-3xl font-semibold text-white">Entry Fee:</h2>
            <p className="text-4xl font-bold text-yellow-400">{entryFee} JACK</p>
          </div>
          <div className="p-8 flex justify-between items-center">
            <h2 className="text-3xl font-semibold text-white">Win Probability:</h2>
            <p className="text-4xl font-bold text-yellow-400">1 in {winProbability}</p>
          </div>
          <div className="mt-12 flex justify-center mb-6 items-end p-10 bg-black bg-opacity-50">
            <button
              className="bg-yellow-400 hover:bg-yellow-500 text-black px-8 py-3 rounded-lg font-bold text-xl"
              onClick={enterJackpot}
              disabled={!isConnected || !isSupportedNetwork()}
            >
              Enter Jackpot ({entryFee} JACK)
            </button>
          </div>
          <div className="text-center p-6 bg-black bg-opacity-50">
            <h2 className="text-3xl font-semibold mb-6">Last Winner</h2>
            <p className="text-green-400 font-mono text-3xl mb-3">
              {winnerEnsName || lastWinner}
            </p>
            <p className="text-yellow-400 font-mono text-3xl">
              Won: {lastWinAmount} JACK
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Remove the AppWithDynamicContext wrapper and export App directly
export default App;
