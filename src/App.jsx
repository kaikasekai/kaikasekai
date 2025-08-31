import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { BrowserProvider, Contract, ZeroAddress, parseUnits } from 'ethers';
import WalletConnectProvider from "@walletconnect/web3-provider";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import dayjs from 'dayjs';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Button,
  TextField
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// === CSV Data ===
const RAW_URL = 'https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/data.csv';
const COLORS = ['#ff8000','#00ff80','#ffff00','#00ff00','#00ffff','#0080ff','#8000ff','#ff00ff','#0080ff','#ff0080'];

// === Contract Config ===
const CONTRACT_ADDRESS = "0xf994B67367B064Fb790aD17F08B91F7fCC980Ecb"; // contract address

const CONTRACT_ABI = [
  "function subscriptionEnd(address) view returns (uint256)",
  "function isActive(address) view returns (bool)",
  "function subscribe(uint256 endTime, address refAddr) external",
  "function donate(uint256 amount) external",
  "function price() view returns (uint256)",
  "function hasEverSubscribed(address) view returns (bool)"

];

// === USDC Config (Polygon) ===
const USDC_ADDRESS = "0xC4D7620b1DDE8ad477910eBc8F288E9b527E725a"; // USDC в Polygon
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)"
];


function App() {
  document.body.prepend(Object.assign(document.createElement("div"), {
    innerText: "✅ App started",
    style: "color: green; font-weight: bold; padding: 10px; background: white"
  }));

  const [data, setData] = useState([]);
  const [mae, setMae] = useState(null);
  const [mape, setMape] = useState('');
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [showTwoMonths, setShowTwoMonths] = useState(false);
  const [referrer, setReferrer] = useState('');
  const [donateAmount, setDonateAmount] = useState('');
  const [hasSubscribed, setHasSubscribed] = useState(false);


  // === Fetch Data ===
  useEffect(() => {
    axios.get(RAW_URL).then(r => {
      Papa.parse(r.data, {
        header: true,
        dynamicTyping: true,
        complete: (res) => {
          const rows = res.data.filter((_, i) => i >= 30);
          setData(rows);
          
          const today = new Date().toISOString().slice(0, 10); 
          const validRows = rows.filter(r =>
            typeof r.BTC === 'number' &&
            typeof r.predict === 'number' &&
            !isNaN(r.BTC) &&
            !isNaN(r.predict) &&
            r.date <= today
          );

          const last30 = validRows.slice(-30);

          const maeSum = last30.reduce((sum, r) => sum + Math.abs(r.predict - r.BTC), 0);
          const mapeSum = last30.reduce((sum, r) => sum + Math.abs(1-((r.predict - r.BTC) / r.BTC)), 0);

          setMae(last30.length ? (maeSum / last30.length).toFixed(2) : 'N/A');
          setMape(last30.length ? ((mapeSum / last30.length) * 100).toFixed(2) : 'N/A');
        }
      });
    });
  }, []);

  // === Connect Wallet ===
  const connectWallet = async () => {
  let prov;

  if (window.ethereum) {
    // MetaMask
    prov = new BrowserProvider(window.ethereum);
  } else {
    // WalletConnect
    const wcProvider = new WalletConnectProvider({
  rpc: {
    137: "https://polygon-rpc.com",      // Polygon Mainnet
    11155111: "https://rpc.sepolia.org" // Sepolia testnet
  }
});
    
    await wcProvider.enable(); // open wallet
    prov = new BrowserProvider(wcProvider);
  }

  const network = await prov.getNetwork();
  if (Number(network.chainId) !== 11155111) {
  return alert("⚠️ Please switch to Sepolia (11155111)");
}

  const signer = await prov.getSigner();
  const acc = await signer.getAddress();
  setAccount(acc);
  setProvider(prov);

  const cont = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  setContract(cont);

  checkSubscription(cont, acc);
};

  // === Check Subscription ===
  const checkSubscription = async (cont, acc) => {
  const end = await cont.subscriptionEnd(acc);
  const subscribed = await cont.hasEverSubscribed(acc);
  setHasSubscribed(subscribed);

  const now = Math.floor(Date.now() / 1000);
  if (Number(end) > now) {
    setSubscriptionActive(true);
    setShowTwoMonths(true);
  } else {
    setSubscriptionActive(false);
    setShowTwoMonths(false);
  }
};

  // === Subscribe ===
const handleSubscribe = async () => {
  if (!contract || !provider) return;
  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    // узнаём цену из контракта
    const price = await contract.price();

    // сначала approve
    const approveTx = await usdc.approve(CONTRACT_ADDRESS, price);
    await approveTx.wait();

    // теперь подписка
    const endTime = dayjs().add(1, "month").endOf("month").unix();
    const tx = await contract.subscribe(endTime, referrer || ZeroAddress);
    await tx.wait();

    checkSubscription(contract, account);
    alert("✅ Subscription successful!");
  } catch (e) {
    console.error(e);
    alert("❌ Subscription failed, check console");
  }
};

  // === Donate ===
  const handleDonate = async () => {
  if (!contract || !provider) return;
  if (!donateAmount) return alert("Enter amount");

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const amount = parseUnits(donateAmount, 6); // USDC decimals

    // approve
    const approveTx = await usdc.approve(CONTRACT_ADDRESS, amount);
    await approveTx.wait();

    // donate
    const tx = await contract.donate(amount);
    await tx.wait();

    alert("✅ Donation sent to contract!");
  } catch (e) {
    console.error(e);
    alert("❌ Donation failed, check console");
  }
};

  if (!data.length) return <div>Loading...</div>;

  // === Data Filtering ===
  const today = new Date();
  const firstDayOfMonth = dayjs(today).startOf("month");
  const nextMonth = dayjs(today).add(1, "month").endOf("month");

  const filteredData = data.filter(r => {
    const d = dayjs(r.date);
    if (showTwoMonths) return d.isAfter(firstDayOfMonth) && d.isBefore(nextMonth);
    return d.isAfter(firstDayOfMonth) && d.isBefore(dayjs(today));
  });
  
return (
<div style={{ padding: 20 }}>
    <h1 style={{ color: "green" }}>✅ React работает!</h1>
  </div>
);
}

export default App;
