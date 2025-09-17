import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { BrowserProvider, Contract, ZeroAddress, getAddress, hexlify } from 'ethers';
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
const CONTRACT_ADDRESS = "0xf994B67367B064Fb790aD17F08B91F7fCC980Ecb"; // contract address

const CONTRACT_ABI = [
  "function subscriptionEnd(address) view returns (uint256)",
  "function isActive(address) view returns (bool)",
  "function subscribe(uint256 endTime, address refAddr) external",
  "function donate(uint256 amount) external",
  "function price() view returns (uint256)",
  "function hasEverSubscribed(address) view returns (bool)",
  "function whitelistedReferrers(address) view returns (bool)"
];

// === USDC Config (Polygon) ===
const USDC_ADDRESS = "0xC4D7620b1DDE8ad477910eBc8F288E9b527E725a"; // USDC в Polygon
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)"
];

function App() {
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
    // ✅ Десктоп (MetaMask расширение)
    prov = new BrowserProvider(window.ethereum);
  } else {
    // ✅ Мобильные (iOS/Android Safari/Chrome)
    const wcProvider = await EthereumProvider.init({
      projectId: "88a4618bff0d86aab28197d3b42e7845",
      chains: [137], // Polygon
      optionalChains: [80002], // Amoy
      showQrModal: true,
      methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData"],
      events: ["chainChanged", "accountsChanged"],
    });

    // закрываем старую сессию (чтобы не висло)
    if (wcProvider?.session?.namespaces) {
      await wcProvider.disconnect();
    }

    await wcProvider.enable();
    prov = new BrowserProvider(wcProvider);
  }

  const network = await prov.getNetwork();
  if (Number(network.chainId) !== 80002) {
    return alert("⚠️ Please switch to Amoy (80002)");
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
  if (!contract || !provider) return alert("Connect wallet first!");

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    // 1. Цена
    const priceToPay = await contract.price();
    log("STEP1: priceToPay = " + priceToPay.toString());

    // 2. Approve (без populateTransaction)
    log("STEP2: sending approve tx...");
    const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceToPay.toString());
    await approveTx.wait();
    log("STEP2: approve confirmed");

    // Проверка баланса и allowance
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS);
    log("Allowance after approve = " + allowance.toString());
    const bal = await usdc.balanceOf(account);
    log("USDC balance = " + bal.toString());

    // 3. endTime
    const endTime = BigInt(Math.floor(dayjs().add(1, "month").endOf("month").valueOf() / 1000));
    log("STEP3: endTime = " + endTime.toString());

    // 4. Подписка через populateTransaction + sendTransaction
    log("STEP4: sending subscribe tx...");
    const txData = await contract.populateTransaction.subscribe(
      endTime.toString(),
      referrer || ZeroAddress
    );
    const tx = await signer.sendTransaction({
      to: txData.to,
      data: txData.data,
      value: 0
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

    const priceToPay = await contract.price();

    log(`STEP1: Approving ${priceToPay} USDC for whitelist...`);

    // approve
    const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceToPay);
    await approveTx.wait();

    log("STEP2: Calling buyWhitelist()...");

    // call контракт
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
  Buy Whitelist (99 USDC)
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
