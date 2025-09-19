import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { BrowserProvider, Contract, ZeroAddress, getAddress, hexlify, parseUnits } from 'ethers';
import EthereumProvider from "@walletconnect/ethereum-provider";
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
const CONTRACT_ADDRESS = "0x94E0c3Df28322A10670837f886F9ccc256b73BCA"; // contract address

const CONTRACT_ABI = [
  "function subscriptionEnd(address) view returns (uint256)",
  "function isActive(address) view returns (bool)",
  "function subscribe(uint256 endTime, address refAddr) external",
  "function donate(uint256 amount) external",
  "function price() view returns (uint256)",
  "function whitelistPrice() view returns (uint256)",
  "function hasEverSubscribed(address) view returns (bool)",
  "function whitelistedReferrers(address) view returns (bool)"
];

// === USDC Config (Polygon) ===
const USDC_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"; // USDC в Polygon Amoy
const USDC_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

function App() {
  const [data, setData] = useState([]);
  const [mae, setMae] = useState(null);
  const [mape, setMape] = useState('');
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [price, setPrice] = useState(null);
  const [whitelistPrice, setWhitelistPrice] = useState(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [showTwoMonths, setShowTwoMonths] = useState(false);
  const [referrer, setReferrer] = useState('');
  const [donateAmount, setDonateAmount] = useState('');
  const [hasSubscribed, setHasSubscribed] = useState(false);
  const [debug, setDebug] = useState([]);

  const log = (msg) => {
  setDebug((d) => [...d, `[${new Date().toLocaleTimeString()}] ${msg}`]);
};


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
    // ✅ Сначала требуем Amoy
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x13882" }], // Amoy testnet
      });
    } catch (err) {
      // Если сеть не добавлена — добавляем
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x13882",
            chainName: "Polygon Amoy",
            nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
            rpcUrls: ["https://rpc-amoy.polygon.technology"],
            blockExplorerUrls: ["https://www.oklink.com/amoy"],
          }],
        });
      } else {
        alert("⚠️ Please switch to Amoy (80002) in your wallet");
        return;
      }
    }

    // ✅ Только после переключения создаём провайдер
    prov = new BrowserProvider(window.ethereum);

  } else {
    // Mobile / WalletConnect
    const wcProvider = await EthereumProvider.init({
      projectId: "88a4618bff0d86aab28197d3b42e7845",
      chains: [80002], // Amoy
      //optionalChains: [137], // Polygon
      showQrModal: true,
      methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData"],
      events: ["chainChanged", "accountsChanged"],
    });

    const hasActiveSession =
      wcProvider?.session?.namespaces &&
      Object.keys(wcProvider.session.namespaces).length > 0;

    if (!hasActiveSession) {
      await wcProvider.enable();
    } else {
      await wcProvider.enable();
    }

    prov = new BrowserProvider(wcProvider);
  }

  const network = await prov.getNetwork();
  console.log("Connected chainId:", Number(network.chainId));

  const signer = await prov.getSigner();
  const acc = await signer.getAddress();
  setAccount(acc);
  setProvider(prov);

  const cont = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  setContract(cont);

  const subPrice = await cont.price();
  setPrice(Number(subPrice));

  const wlPrice = await cont.whitelistPrice();
  setWhitelistPrice(Number(wlPrice));

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
  if (!contract || !provider) return alert("Connect wallet first!");

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    // 1. Цена (bigint)
    const priceToPay = await contract.price();
    log("STEP1: priceToPay = " + priceToPay.toString());

    // 2. Allowance — сравнение через <
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS);
    log("STEP2: current allowance = " + allowance.toString());

    if (allowance < priceToPay) {
      log("STEP2: sending approve tx...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceToPay);
      await approveTx.wait();
      log("STEP2: approve confirmed");
    } else {
      log("STEP2: sufficient allowance, skipping approve");
    }

    // Проверка баланса
    const bal = await usdc.balanceOf(account);
    log("USDC balance = " + bal.toString());
    if (bal < priceToPay) {
      return alert("Insufficient USDC balance");
    }

    // 3. endTime
    const endTime = BigInt(Math.floor(dayjs().add(1, "month").endOf("month").valueOf() / 1000));
    log("STEP3: endTime = " + endTime.toString());

    // 4. Referrer
    let refAddr = ZeroAddress;
    if (referrer && referrer.trim() !== "") {
      try {
        const candidate = getAddress(referrer.trim());
        if (candidate.toLowerCase() !== account.toLowerCase()) {
          refAddr = candidate;
          log("Using referrer: " + refAddr);
        } else {
          log("Referrer is same as account — ignored");
        }
      } catch (err) {
        alert("Invalid referrer address. Please check and try again.");
        return;
      }
    }

    // 5. Вызов подписки
    const txData = await contract.populateTransaction.subscribe(
      endTime.toString(),
      refAddr
    );
    const tx = await signer.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: 0n
    });
    await tx.wait();
    log("STEP4: subscribe confirmed ✅");

    await checkSubscription(contract, account);
    alert("✅ Subscription successful!");
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Subscription failed, see Debug log");
  }
};

    // Buy whitelist
    const handleBuyWhitelist = async () => {
  if (!contract || !provider) return alert("Connect wallet first!");

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const priceToPay = await contract.whitelistPrice();
    log(`STEP1: whitelistPrice = ${priceToPay.toString()}`);

    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS);
    if (allowance < priceToPay) {
      log("STEP2: sending approve tx for whitelist...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceToPay);
      await approveTx.wait();
      log("STEP2: approve confirmed");
    } else {
      log("STEP2: sufficient allowance for whitelist");
    }

    log("STEP3: Calling buyWhitelist()...");
    const tx = await contract.connect(signer).buyWhitelist();
    await tx.wait();

    log("✅ BuyWhitelist successful!");
    alert("✅ You are now whitelisted!");
  } catch (e) {
    console.error(e);
    alert("❌ BuyWhitelist failed, check console");
  }
};
 
  // === Donate ===
  const handleDonate = async () => {
  if (!contract || !provider) return;
  if (!donateAmount) return alert("Enter amount");

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const amount = parseUnits(donateAmount, 6); // bigint
    log("Donate amount = " + amount.toString());

    const approveTx = await usdc.approve(CONTRACT_ADDRESS, amount);
    await approveTx.wait();

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
    <h2>BTC Forecast Chart</h2>
    {!account ? (
      <Button variant="contained" onClick={connectWallet}>Connect Wallet</Button>
    ) : (
      <div>
        <p>Connected: {account}</p>

        {subscriptionActive ? (
          <p>✅ Subscription active</p>
        ) : (
          <div>
            <p>⚠️ Subscription inactive</p>

            {!hasSubscribed && (
              // 👇 правильное условие с () и без лишнего ;
              <TextField
                label="Referrer address (optional)"
                value={referrer}
                onChange={e => setReferrer(e.target.value)}
                fullWidth
                margin="dense"
              />
            )}

            <Button
              variant="contained"
              color="primary"
              onClick={handleSubscribe}
            >
              See next month (Subscribe)
            </Button>
            <Button
  variant="contained"
  color="secondary"
  onClick={handleBuyWhitelist}
  style={{ marginTop: 10 }}
>
  Buy Whitelist ({whitelistPrice ? (whitelistPrice / 1e6).toFixed(2) : "..."}USDC)
</Button>

          </div>
        )}

        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={(d) => dayjs(d).format('MMM D')} />
            <YAxis domain={[100000,160000]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="BTC" stroke="#f7931a" dot={false} strokeWidth={3}/>
            <Line type="monotone" dataKey="moving_average" stroke="#00c69e" dot={false} strokeDasharray="5 5" strokeWidth={2}/>
            <Line type="monotone" dataKey="predict" stroke="#0000ff" dot={false} strokeWidth={3}/>
            <Line type="monotone" dataKey="prp_1" stroke="#6666ff" dot={false} />
            <Line type="monotone" dataKey="prp_2" stroke="#9999ff" dot={false} />
            {Object.keys(data[0]).filter(k => k.startsWith('p_')).map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[idx % COLORS.length]}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        <div style={{ marginTop: 10 }}>
          <strong>Accuracy last 30 days:</strong> {mape}%
        </div>

        {/* Donate */}
        <div style={{ marginTop: 20 }}>
          <h3>Donate</h3>
          <TextField
            label="Amount (USDC)"
            value={donateAmount}
            onChange={e => setDonateAmount(e.target.value)}
            fullWidth
            margin="dense"
          />
          <Button
            variant="contained"
            color="secondary"
            onClick={handleDonate}
          >
            Donate
          </Button>
        </div>

        {/* Accordions */}
        <Accordion style={{ marginTop: 20 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>About</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>
              The project predicts BTC values by the cluster of AI models.
            </Typography>
          </AccordionDetails>
        </Accordion>

        <Accordion style={{ marginTop: 10 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>How it works</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography>
              BTC, moving average, predictions and error metrics (MAE/MAPE).
            </Typography>
          </AccordionDetails>
        </Accordion>
      </div>
    )}

{/* Debug output */}
<div style={{
  marginTop: 20,
  padding: 10,
  background: "#111",
  color: "#0f0",
  fontSize: 12,
  whiteSpace: "pre-wrap",
  borderRadius: 8
}}>
  <strong>Debug log:</strong>
  {"\n"}
  {debug.join("\n")}
</div>

    
  </div>
);
}

export default App;
