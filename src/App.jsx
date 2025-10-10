import { useEffect, useState } from "react";
import Papa from "papaparse";
import axios from "axios";
import {
  BrowserProvider,
  Contract,
  ZeroAddress,
  getAddress,
  parseUnits,
  JsonRpcProvider,
} from "ethers";
import EthereumProvider from "@walletconnect/ethereum-provider";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Button,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import emailjs from "@emailjs/browser";

// === CSV Data ===
const RAW_URL =
  "https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/data.csv";
const COLORS = [
  "#ff0000",
  "#ff8000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0080ff",
  "#8000ff",
  "#ff0080",
  "#ff00ff",
  "#bfff00",
  "#00ffbf",
  "#00bfff",
  "#bf00ff",
  "#4000ff",
];

// === Contract Config ===
const OWNER_ADDRESS = "0xd801cA2291a797e377533D134e129eA258810673";
const CONTRACT_ADDRESS = "0x1b453Ed4252Ea0e64CaB49E918fbcfC62d7fAf20";
const CONTRACT_ABI = [
  "function setNextEndTime(uint256 _endTime) external",
  "function nextEndTime() view returns (uint256)",
  "function subscriptionEnd(address) view returns (uint256)",
  "function isActive(address) view returns (bool)",
  "function subscribe(address refAddr) external",
  "function donate(uint256 amount) external",
  "function payFeedback() external",
  "function price() view returns (uint256)",
  "function whitelistPrice() view returns (uint256)",
  "function feedbackPrice() view returns (uint256)",
  "function hasEverSubscribed(address) view returns (bool)",
  "function whitelistedReferrers(address) view returns (bool)",
  "function buyWhitelist() external",
  "function setFeedbackPrice(uint256 newPrice) external",
  "event NextEndTimeUpdated(uint256 newEndTime, address indexed owner)",
  "event FeedbackPaid(address indexed user, uint256 amount)",
  "event FeedbackPriceChanged(uint256 oldPrice, uint256 newPrice)",
];

// === USDC Config (Polygon) ===
const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
];

// === NFT Config ===
const NFT_ADDRESS = "0x0878C09FFE2e702c1A7987B38C63C42E2062b803";
const NFT_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function totalSupply() view returns (uint256)",
];

function App() {
  // === State ===
  const [data, setData] = useState([]);
  const [mae, setMae] = useState(null);
  const [mape, setMape] = useState("");
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [nextEndTime, setNextEndTimeState] = useState(null);
  const [price, setPrice] = useState(null);
  const [whitelistPrice, setWhitelistPrice] = useState(null);
  const [subscriptionActive, setSubscriptionActive] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState(null);
  const [hasWhitelist, setHasWhitelist] = useState(false);
  const [showTwoMonths, setShowTwoMonths] = useState(false);
  const [referrer, setReferrer] = useState("");
  const [donateAmount, setDonateAmount] = useState("");
  const [hasSubscribed, setHasSubscribed] = useState(false);
  const [feedbackPrice, setFeedbackPrice] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [nftContract, setNftContract] = useState(null);
  const [proofs, setProofs] = useState([]);
  const [debug, setDebug] = useState([]);
  const [expandedItems, setExpandedItems] = useState([]);
  const [page, setPage] = useState("main"); // <— новая логика страниц

  const toggleAccordion = (id) => {
  setExpandedItems(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );
};
  
  const log = (msg) =>
    setDebug((d) => [...d, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  // === Fetch CSV ===
  useEffect(() => {
    axios.get(RAW_URL).then((r) => {
      Papa.parse(r.data, {
        header: true,
        dynamicTyping: true,
        complete: (res) => {
          const rows = res.data.filter((_, i) => i >= 30);
          setData(rows);
          const today = new Date().toISOString().slice(0, 10);
          const validRows = rows.filter(
            (r) =>
              typeof r.BTC === "number" &&
              typeof r.predict === "number" &&
              !isNaN(r.BTC) &&
              !isNaN(r.predict) &&
              r.date <= today
          );
          const last30 = validRows.slice(-30);
          const maeSum = last30.reduce(
            (sum, r) => sum + Math.abs(r.predict - r.BTC),
            0
          );
          const mapeSum = last30.reduce(
            (sum, r) => sum + Math.abs(1 - (r.predict - r.BTC) / r.BTC),
            0
          );
          setMae(last30.length ? (maeSum / last30.length).toFixed(2) : "N/A");
          setMape(
            last30.length ? ((mapeSum / last30.length) * 100).toFixed(2) : "N/A"
          );
        },
      });
    });
  }, []);

  // === NFT Proofs ===
  useEffect(() => {
    const loadProofsWithoutWallet = async () => {
      try {
        const provider = new JsonRpcProvider("https://polygon-rpc.com");
        const nftContract = new Contract(NFT_ADDRESS, NFT_ABI, provider);
        const total = Number(await nftContract.totalSupply());
        const items = [];
        const count = Math.min(total, 6);
        for (let i = 2; i <= count; i++) {
          let uri = await nftContract.tokenURI(i);
          if (uri.startsWith("ipfs://"))
            uri = "https://ipfs.io/ipfs/" + uri.slice(7);
          const res = await fetch(uri);
          const metadata = await res.json();
          let imgUrl = metadata.image.startsWith("ipfs://")
            ? "https://ipfs.io/ipfs/" + metadata.image.slice(7)
            : metadata.image;
          items.push({
            id: i,
            name: metadata.name,
            description: metadata.description,
            image: imgUrl,
            polygonscan: `https://polygonscan.com/token/${NFT_ADDRESS}?a=${i}`,
          });
        }
        setProofs(items);
      } catch (e) {
        log("❌ Error loading Proofs: " + (e.message || e));
      }
    };
    loadProofsWithoutWallet();
  }, []);

  // === Wallet connection ===
  const connectWallet = async () => {
    let prov;

    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x89" }],
        });
      } catch (err) {
        if (err.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x89",
                chainName: "Polygon Mainnet",
                nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
                rpcUrls: ["https://polygon-rpc.com"],
                blockExplorerUrls: ["https://polygonscan.com"],
              },
            ],
          });
        } else {
          alert("⚠️ Please switch to Polygon Mainnet (137) in your wallet");
          return;
        }
      }
      prov = new BrowserProvider(window.ethereum);
    } else {
      const wcProvider = await EthereumProvider.init({
        projectId: "88a4618bff0d86aab28197d3b42e7845",
        chains: [137],
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

    const signer = await prov.getSigner();
    const acc = await signer.getAddress();
    setAccount(acc);
    setProvider(prov);

    const cont = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    setContract(cont);

    const nftCont = new Contract(NFT_ADDRESS, NFT_ABI, signer);
    setNftContract(nftCont);

    setPrice(Number(await cont.price()));
    setWhitelistPrice(Number(await cont.whitelistPrice()));
    setFeedbackPrice(Number(await cont.feedbackPrice()));

    if (cont) {
  const whitelisted = await cont.whitelistedReferrers(acc);
  setHasWhitelist(whitelisted);
}


    // === Fetch nextEndTime and listen for updates ===
    try {
      const end = await cont.nextEndTime();
      setNextEndTimeState(Number(end));
    } catch (e) {
      console.log("Error fetching nextEndTime:", e);
    }

    checkSubscription(cont, acc);
  };

  // === Check subscription ===
  const checkSubscription = async (cont, acc) => {
    const end = await cont.subscriptionEnd(acc);
    const subscribed = await cont.hasEverSubscribed(acc);
    setHasSubscribed(subscribed);
    setSubscriptionEnd(Number(end));

    const now = Math.floor(Date.now() / 1000);
    if (Number(end) > now) {
      setSubscriptionActive(true);
      setShowTwoMonths(true);
    } else {
      setSubscriptionActive(false);
      setShowTwoMonths(false);
    }
  };

// === Buy Whitelist ===
const handleBuyWhitelist = async () => {
  if (!contract || !provider) return alert("Connect wallet first!");
  if (processing) return; // защита от повторных вызовов
  setProcessing(true);
  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const wlPrice = await contract.whitelistPrice(); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS); // BigInt

    if (allowance < wlPrice) {
      log("Approving USDC for whitelist...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, wlPrice);
      await approveTx.wait();
      alert("✅ Approve confirmed. Now confirm Buy Whitelist in your wallet!");
    }

    // задержка, чтобы MetaMask успел обработать approve
    await new Promise(r => setTimeout(r, 1000));
    
    log("Buying whitelist...");
    const tx = await contract.buyWhitelist(); // contract уже создан с signer
    await tx.wait();
    log("✅ BuyWhitelist confirmed");

    // Обновим стейт whitelisted
    const whitelisted = await contract.whitelistedReferrers(account);
    setHasWhitelist(Boolean(whitelisted));

    alert("✅ You are now whitelisted!");
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Whitelist purchase failed, see Debug log");
  } finally {
    setProcessing(false);
  }
};

// === Subscribe ===
const handleSubscribe = async () => {
  if (!contract || !provider) return alert("Connect wallet first!");
  if (processing) return;
  setProcessing(true);

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    // --- 1️⃣ Проверяем корректность реферера ДО approve ---
    let refAddr = ZeroAddress;
    if (referrer && referrer.trim() !== "") {
      try {
        const candidate = getAddress(referrer.trim());
        if (candidate.toLowerCase() === account.toLowerCase()) {
          alert("⚠️ You cannot use your own address as referrer. Subscription will proceed without discount.");
          refAddr = ZeroAddress;
        } else {
          refAddr = candidate;
          log("✅ Valid referrer: " + candidate);
        }
      } catch {
        alert("⚠️ Invalid referrer address. Subscription will proceed without discount.");
        refAddr = ZeroAddress; // просто подписываем без скидки
      }
    }

    // --- 2️⃣ Проверяем баланс и allowance ---
    const priceToPay = await contract.price(); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS); // BigInt

    const bal = await usdc.balanceOf(account);
    if (bal < priceToPay) {
      alert("❌ Insufficient USDC balance");
      setProcessing(false);
      return;
    }

    // --- 3️⃣ Если нужно — делаем approve ---
    if (allowance < priceToPay) {
      log("Approving USDC for subscription...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceToPay);
      await approveTx.wait();
      alert("✅ Approve confirmed. Now confirm Subscription in your wallet!");
      // Небольшая задержка, чтобы MetaMask всё обработал
      await new Promise((r) => setTimeout(r, 1000));
    }

    // --- 4️⃣ Подписка ---
    log("Subscribing...");
    const tx = await contract.subscribe(refAddr);
    await tx.wait();
    log("✅ Subscription confirmed");

    await checkSubscription(contract, account);
    alert("✅ Subscription successful!");
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Subscription failed, see Debug log");
  } finally {
    setProcessing(false);
  }
};

// === Donate ===
const handleDonate = async () => {
  if (!contract || !provider) return alert("Connect wallet first!");
  if (!donateAmount) return alert("Enter amount");
  if (processing) return;
  setProcessing(true);
  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const amount = parseUnits(donateAmount, 6); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS); // BigInt

    if (allowance < amount) {
      log("Approving USDC for donation...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, amount);
      await approveTx.wait();
      alert("✅ Approve confirmed. Now confirm Donate in your wallet!");
    }

    // задержка, чтобы MetaMask успел обработать approve
    await new Promise(r => setTimeout(r, 1000));
    
    log("Sending donation...");
    const tx = await contract.donate(amount);
    await tx.wait();
    log("✅ Donation confirmed");

    alert("✅ Donation sent to contract. Thank you!");
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Donation failed, see Debug log");
  } finally {
    setProcessing(false);
  }
};

// === FeedBack ===
const handlePayFeedback = async () => {
  if (!contract || !provider) return alert("Connect wallet first!");
  if (processing) return;
  setProcessing(true);
  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const price = await contract.feedbackPrice(); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS);

    if (allowance < price) {
      log("Approving USDC for feedback...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, price);
      await approveTx.wait();
      alert("✅ Approve confirmed. Now confirm Feedback in your wallet!");
    }

    // задержка, чтобы MetaMask успел обработать approve
    await new Promise(r => setTimeout(r, 1000));
    
    log("Paying for feedback...");
    const tx = await contract.payFeedback(); // contract already has signer
    await tx.wait();
    log("✅ Feedback payment confirmed");

    setShowFeedbackForm(true); // показать форму после успешной оплаты
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Payment for feedback failed");
  } finally {
    setProcessing(false);
  }
};

// === Send FeedBack ===
const handleSendFeedback = async () => {
  if (!feedbackEmail || !feedbackMessage) return alert("Fill all fields");

  try {
    await emailjs.send(
      "service_2eczu4z",
      "template_0v8qzjh",
      {
        user_email: feedbackEmail,
        message: feedbackMessage,
      },
      "oC-ls-BvdR82IZ6b4"
    );

    alert("✅ Your message sent to the developers!");
    setFeedbackEmail("");
    setFeedbackMessage("");
    setShowFeedbackForm(false);
  } catch (e) {
    alert("❌ Error, Your message not sent..");
    console.error(e);
  }
};

  if (!data.length) return <div>Loading...</div>;

  const filteredData = data.filter((r) => {
    const d = dayjs(r.date);
    const startOfMonth = dayjs().startOf("month");
    const endOfThisMonth = dayjs().endOf("month");
    const startOfNextMonth = dayjs().add(1, "month").startOf("month");
    const endOfNextMonth = dayjs().add(1, "month").endOf("month");

    if (showTwoMonths) {
    // Показываем текущий + следующий месяц (включительно, до 30 ноября)
    return d.isSameOrAfter(startOfMonth) && d.isSameOrBefore(endOfNextMonth);
  } else {
    // Показываем только текущий месяц (1–31 октября)
    return d.isSameOrAfter(startOfMonth) && d.isSameOrBefore(endOfThisMonth);
  }
});

  return (
    <>
      <main style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
        {/* === Страница MAIN === */}
        {page === "main" && (
          <>
            {/* === Chart === */}
            <div style={{ marginTop: 0 }}>
              <ResponsiveContainer width="100%" height={500} className="chart-wrapper">
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => dayjs(d).format("MMM D")}
                  />
                  <YAxis
                    domain={[100000, 150000]}
                    ticks={[
                      105000, 110000, 115000, 120000, 125000, 130000,
                      135000, 140000, 145000, 150000, 155000,
                    ]}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="BTC"
                    stroke="#f7931a"
                    dot={false}
                    strokeWidth={6}
                  />
                  <Line
                    type="monotone"
                    dataKey="moving_average"
                    stroke="#00c69e"
                    dot={false}
                    strokeDasharray="5 5"
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="predict"
                    stroke="#0000ff"
                    dot={false}
                    strokeWidth={6}
                  />
                  {Object.keys(data[0])
                    .filter((k) => k.startsWith("p_"))
                    .map((key, idx) => (
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
              <p></p>
              <p>
                {subscriptionActive
                  ? "Range: Current + Next month"
                  : "Range: Current month"}
              </p>

<p>Advanced AI algorithm predicts the global BTC trend with {mape}%<sup>*</sup> accuracy.</p>
              <small><sup>*</sup> Based on rolling 30-day metrics.</small>
            </div>

      
      {/* === Wallet section === */}
      {!account ? (
        <Button variant="contained" onClick={connectWallet} style={{ width: "auto" }}>
          Connect Wallet
        </Button>
      ) : (
        <div>
          <p>Connected: {account}</p>
       
{subscriptionActive ? (
  <div>
    <p>✅ Subscription active</p>
    {subscriptionEnd && (
      <p>
        Your subscription ends on:{" "}
        {new Date(subscriptionEnd * 1000).toLocaleDateString()}
      </p>
    )}
  </div>
) : (
  <div>
    <p>⚠️ Subscription inactive</p>

              {!hasSubscribed && (
                <TextField
                  label="Referrer address (optional)"
                  value={referrer}
                  onChange={(e) => setReferrer(e.target.value)}
                  fullWidth
                  margin="dense"
                />
              )}

              <Button variant="contained" onClick={handleSubscribe}>
                Subscribe<sup>*</sup> ({price ? (price / 1e6).toFixed(4) : "..." } USDC)
              </Button>
              <p><sup>*</sup>49.9 USDC to unlock next month’s forecast.</p>
              {nextEndTime && (
                <p>
                  Next subscription will end on:{" "}
                  {new Date(nextEndTime * 1000).toLocaleDateString()}
                </p>
              )}
              </div>
      )}

              {!hasWhitelist && (
  <Button
    variant="contained"
    onClick={handleBuyWhitelist}
  >
    Buy Whitelist ({whitelistPrice ? (whitelistPrice / 1e6).toFixed(4) : "..." } USDC)
  </Button>
)}


<Button
  variant="contained"
  onClick={handlePayFeedback}
>
  Contact us ({feedbackPrice ? (feedbackPrice / 1e6).toFixed(4) : "..."} USDC)
</Button>

{showFeedbackForm && (
  <div style={{ marginTop: 20, border: "1px solid #ccc", padding: 10, borderRadius: 0 }}>
    <h4>FeedBack</h4>
    <TextField
      label="Your email"
      value={feedbackEmail}
      onChange={(e) => setFeedbackEmail(e.target.value)}
      fullWidth
      margin="dense"
    />
    <TextField
      label="Message"
      value={feedbackMessage}
      onChange={(e) => setFeedbackMessage(e.target.value)}
      fullWidth
      multiline
      rows={4}
      margin="dense"
    />
    <Button
      variant="contained"
      onClick={handleSendFeedback}
    >
      Send
    </Button>
  </div>
)}

            </div>
          )}
        

      {/* === Donate (оставляем только для подключённого кошелька) === */}
      {account && (
        <div style={{ marginTop: 20 }}>
          <h1>Donate</h1>
          <TextField
            label="Amount (USDC)"
            value={donateAmount}
            onChange={(e) => setDonateAmount(e.target.value)}
            fullWidth
            margin="dense"
          />
          <Button variant="contained" onClick={handleDonate}>
            Donate
          </Button>
        </div>
      )}
            
          </>
        )}

        {/* === Disclaimer Page === */}
        {page === "disclaimer" && (
          <div style={{ marginTop: 20 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPage("main")}
              style={{ marginBottom: 20, textTransform: 'none' }}
            >
              ← Back
            </Button>
            <h3>Disclaimer</h3>
            <p>
              The information provided on this website does not constitute
              investment advice, financial guidance, or a trading
              recommendation. Cryptocurrency investments involve risk, and past
              performance does not guarantee future results.
            </p>
          </div>
        )}

        {/* === Cookies Page === */}
        {page === "cookies" && (
          <div style={{ marginTop: 20 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPage("main")}
              style={{ marginBottom: 20, textTransform: 'none' }}
            >
              ← Back
            </Button>
            <h3>Cookies Policy</h3>
            <p>
              This site uses cookies to enhance the browsing experience. By
              continuing to use this website, you agree to our use of cookies in
              accordance with applicable laws.
            </p>
          </div>
        )}

        {/* === Accordions (тоже вынесены, теперь видны всегда) === */}
      {/* === Accordions === */}
<Accordion style={{ marginTop: 60, boxShadow: "none", border: "none" }}>
  <AccordionSummary
    expandIcon={<span className="accordion-icon">{expandedItems.includes("how") ? "−" : "+"}</span>}
    onClick={() => toggleAccordion("how")}
    style={{ padding: "0px 0" }}
  >
    <Typography>How it works</Typography>
  </AccordionSummary>
  <AccordionDetails style={{ padding: "0px 0" }}>
    <Typography>
Each thin, colorful line on the chart represents a unique AI model predicting the most probable scenario for Bitcoin’s next move. The thick dark-blue line shows the averaged outcome of these AI model cluster scenarios — the core BTC trend forecast — while the thick orange line displays historical BTC data.

The forecast reflects both mid-term and global BTC trends.
It may follow one of the cluster models more closely and show slight time elasticity — occurring a bit earlier or later — but it maintains overall consistency even during high volatility and market manipulations, making them easier to spot.

AI models from the cluster perform advanced technical analysis and research nearly every other factor that could influence crypto’s next moves — from stock market indicators to even rarely used metaphysical aspects.

Models are renewed monthly with additional training data to stay accurate and up to date.
At the beginning of each month, the forecast for the new month is released, while the current month’s forecast receives updates.
  </Typography>
  </AccordionDetails>
</Accordion>

<Accordion style={{ marginTop: 0, boxShadow: "none", border: "none" }}>
  <AccordionSummary
    expandIcon={<span className="accordion-icon">{expandedItems.includes("ref") ? "−" : "+"}</span>}
    onClick={() => toggleAccordion("ref")}
    style={{ padding: "0px 0" }}
  >
    <Typography>Referral programm</Typography>
  </AccordionSummary>
  <AccordionDetails style={{ padding: "0px 0" }}>
    <Typography>
      Referral program

Kaikasekai means “Flourishing World.”
This insider-level, on-chain verified product empowers traders worldwide with the full potential of AI, open to everyone — whale or not — and price-friendly.

Join the program:
Your wallet will be linked to the smart contract.
Use your wallet number as your referral code — your subscribers get 50% off, and you earn 10% on every purchase.
    </Typography>
  </AccordionDetails>
</Accordion>

<Accordion style={{ marginTop: 0, boxShadow: "none", border: "none" }}>
  <AccordionSummary
    expandIcon={<span className="accordion-icon">{expandedItems.includes("proofs") ? "−" : "+"}</span>}
    onClick={() => toggleAccordion("proofs")}
    style={{ padding: "0px 0" }}
  >
    <Typography>Proofs</Typography>
  </AccordionSummary>
  <AccordionDetails style={{ padding: "0px 0" }}>
    {proofs.length === 0 ? (
      <Typography>No proofs yet.</Typography>
    ) : (
      <div>
        {proofs.map((nft) => {
          const resultUrl = `https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/${nft.id}.PNG`;
          return (
            <div
              key={nft.id}
              style={{
                display: "flex",
                gap: 20,
                marginBottom: 20,
                alignItems: "flex-start",
              }}
            >
              <div style={{ flex: 1 }}>
                {nft.image ? (
                  <>
                    <img
                      src={nft.image}
                      alt={nft.name}
                      style={{ width: "100%", borderRadius: 0 }}
                    />
                    <h4 style={{ margin: "10px 0 5px" }}>{nft.name}</h4>
                    <p>
                      {nft.description}
                    </p>
                    <a
                      href={nft.polygonscan}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block",
                        marginTop: 5,
                      }}
                    >
                      View on Polygonscan
                    </a>
                  </>
                ) : (
                  <Typography>Loading NFT {nft.id}…</Typography>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <img
                  src={resultUrl}
                  alt={`Result ${nft.id}`}
                  style={{ width: "100%", borderRadius: 0 }}
                  onError={(e) => (e.target.style.display = "none")}
                />
              </div>
            </div>
          );
        })}
      </div>
    )}
  </AccordionDetails>
</Accordion>

{/* === Debug Log (в аккордеоне) === */}
<Accordion style={{ marginTop: 1, boxShadow: "none", border: "none" }}>
  <AccordionSummary
    expandIcon={<span className="accordion-icon">{expandedItems.includes("debug") ? "−" : "+"}</span>}
    onClick={() => toggleAccordion("debug")}
    style={{ padding: "0px 0" }}
  >
    <Typography>Debug Log</Typography>
  </AccordionSummary>
  <AccordionDetails style={{ padding: "0px 0" }}>
    <div
      style={{
        background: "#111",
        color: "#0f0",
        whiteSpace: "pre-wrap",
        borderRadius: 0,
        padding: 10,
        margin: 20,
      }}
    >
      {debug.length ? debug.join("\n") : "No logs yet."}
    </div>
  </AccordionDetails>
</Accordion>
      </main>

      {/* === Footer === */}
      <footer>
        <div className="footer-content">
          <div className="footer-links">
            <span className="footer-link" onClick={() => setPage("disclaimer")}>
              Disclaimer
            </span>
            <span className="footer-link" onClick={() => setPage("cookies")}>
              Cookies
            </span>
          </div>

          <div className="footer-logo-block">
            <svg
              className="footer-logo"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 150 150"
              preserveAspectRatio="xMidYMid meet"
            >
              <rect x="50" y="0" width="50" height="50" fill="#FFFF00" />
              <rect x="0" y="50" width="50" height="50" fill="#00FF00" />
              <rect x="50" y="50" width="50" height="50" fill="#FFD700" />
              <rect x="100" y="50" width="50" height="50" fill="#0080FF" />
              <rect x="50" y="100" width="50" height="50" fill="#FF0080" />
            </svg>
            <span className="footer-copy"> Copyright © 2025 kaikasekai</span>
          </div>
        </div>
      </footer>
    </>
  );
}

export default App;
