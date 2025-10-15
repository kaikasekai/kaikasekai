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
import ProofCarousel from "./ProofCarousel";

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
  const [page, setPage] = useState("main"); // 
  const [showDonatePopup, setShowDonatePopup] = useState(false);

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
      <main
        style={{
    padding: "clamp(10px, 2vw, 30px)", // адаптивные отступы
    maxWidth: "min(95vw, 1000px)",     // не выходит за границы экрана
    margin: "0 auto",                  // выравнивает по центру
    boxSizing: "border-box",           // учитывает padding в ширине
  }}
        >
        {/* === Страница MAIN === */}
        {page === "main" && (
          <>
            {/* === Chart === */}
            <div style={{ width: "100%", height: "60vh", minHeight: "300px" }}>
              <ResponsiveContainer width="100%" height={600} className="chart-wrapper">
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
                    label={{
    value: "USD",
    angle: -90,
    position: "outsideBottomLeft",
    offset: 0,
    style: { textAnchor: "middle", fill: "#666", fontSize: 14, fontWeight: 500 },
  }}
                  />
                  <Tooltip
  formatter={(value) => typeof value === "number" ? value.toFixed(0) : value}                 
  contentStyle={{
    background: "rgba(18, 18, 20, 0.6)",
    color: "#E8E8EA",
    border: "0px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "0px",
    padding: "10px 10px",
    fontSize: "0.8em",
    lineHeight: 1,
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    backdropFilter: "blur(3px)",
    pointerEvents: "none",
    zIndex: 999,
  }}
  itemStyle={{
    fontWeight: 300
  }}
  labelStyle={{
    color: "#F2F2F3",
    fontWeight: 400
  }}
/>
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
                    stroke="#9A1AF7"
                    dot={false}
                    strokeDasharray="5 5"
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="predict"
                    stroke="#0080ff"
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

              <h1>Kaikasekai Trends</h1>
            
      {/*       
              <div style={{ margin: 0 }}>
                {subscriptionActive
                  ? "Range: Current + Next month"
                  : "Range: Current month"}
              </div>
     */}
              

<div style={{
  margin: 10,
fontWeight: 400,
  fontSize: "1.6rem",
}}>
  Advanced AI-powered algorithm predicts the global BTC trend with {mape}%<sup>*</sup> accuracy
</div>
<div style={{ display: "block", marginTop: 2, color: "#666666", fontWeight: 300, fontSize: "0.9rem" }}>
  <sup>*</sup> Based on rolling 30-day metrics
</div>
              </div>

{/* === Subscription block (вынесено над connect wallet) === */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "8px", // небольшой отступ между кнопкой и полем
    marginTop: 10,
    marginBottom:20,
    alignItems: "flex-start",
  }}
>
  <Button
    variant="contained"
    onClick={handleSubscribe}
    disableElevation
    sx={{
      width: "24ch", // одинаковая ширина
      height: "42px", // фиксированная высота, как у textfield
      backgroundColor: "#F7931A",
      color: "#101214",
      fontWeight: 500,
      fontSize: "1.2rem",
      border: "none",
      borderRadius: 0,
      cursor: "pointer",
      "&:hover": {
        backgroundColor: "#FFA733",
      },
    }}
  >
    Unlock Next Month (49.9 USDC)
  </Button>
<div>
  <TextField
    variant="outlined"
    label="24.9 USDC with referral code"
    value={referrer}
    onChange={(e) => setReferrer(e.target.value)}
    inputProps={{
      maxLength: 42,
      style: {
        textAlign: "center",
      },
    }}
    sx={{
  width: "36ch",
  "& .MuiOutlinedInput-root": {
    height: "42px",
    borderRadius: 0,
    "& fieldset": {
      borderColor: "#cccccc",
      borderWidth: "1px", // одинаковая толщина
    },
    "&:hover fieldset": {
      borderColor: "#cccccc",
      borderWidth: "1px", // не утолщается при ховере
    },
    "&.Mui-focused fieldset": {
      borderColor: "#cccccc",
      borderWidth: "1px", // не утолщается при фокусе
    },
    "& input": {
      textAlign: "center",
      padding: 0,
    },
  },
  "& .MuiInputLabel-root": {
    color: "#cccccc",
    "&.Mui-focused": { color: "#cccccc" },
    textAlign: "center",
  },
}}
  />
</div>

</div>
            
{/* === Wallet section === */}
{!account ? (
  <div style={{ display: "inline-block", marginTop: 10, marginBottom: 60 }}>
    <Button
      onClick={connectWallet}
      disableElevation
      sx={{
        backgroundColor: "#0080ff",
        color: "#ffffff",
        fontWeight: 500,
        fontSize: "1.2rem",
        border: "none",
        borderRadius: "0px",
        cursor: "pointer",
        "&:hover": {
          backgroundColor: "#3399FF",
        },
      }}
    >
      Connect Wallet
    </Button>
  </div>
) : (
  <div>
    <p style={{ color: "#0080ff" }}>Connected: {account}</p>

    {subscriptionActive ? (
      <div>
        <p style={{ color: "#00C853" }}>Subscription active</p>
        {subscriptionEnd && (
          <p>
            Your subscription ends on:{" "}
            {new Date(subscriptionEnd * 1000).toLocaleDateString()}
          </p>
        )}
      </div>
    ) : (
      <div>
        <p style={{ color: "#FF5252" }}>Subscription inactive</p>

        {nextEndTime && (
          <p>
            Subscription will end on:{" "}
            {new Date(nextEndTime * 1000).toLocaleDateString()}
          </p>
        )}
      </div>
    )}
    
</div>
    )}
        
      {/* === Donate (оставляем только для подключённого кошелька) === 
      {account && (
        <div style={{ marginTop: 20 }}>
          <h3>Donate</h3>
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
        */}   
               {/* === Accordions === */}
<Accordion style={{ marginTop: 10, boxShadow: "none", border: "none" }}>
  <AccordionSummary
    expandIcon={<span className="accordion-icon">{expandedItems.includes("how") ? "−" : "+"}</span>}
    onClick={() => toggleAccordion("how")}
    style={{ padding: "0px 0" }}
  >
    <Typography>How it works</Typography>
  </AccordionSummary>
  <AccordionDetails style={{ padding: "0px 0", textAlign: "justify", fontWeight: 400, fontSize: "1rem" }}>
    <Typography>
Each thin, colorful line on the chart represents a unique AI model predicting the most probable scenario for Bitcoin’s next move. The thick dark-blue line shows the averaged outcome of these AI model cluster scenarios — the core BTC trend forecast — while the thick orange line displays historical BTC data.
<br></br><br></br>
The forecast reflects both mid-term and global BTC trends.
It may follow one of the cluster models more closely and show slight time elasticity — occurring a bit earlier or later — but it maintains overall consistency even during high volatility and market manipulations, making them easier to spot.
<br></br><br></br>
AI models from the cluster perform advanced technical analysis and research nearly every other factor that could influence crypto’s next moves — from stock market indicators to even rarely used metaphysical aspects.
<br></br><br></br>
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
  <AccordionDetails style={{ padding: "0px 0", textAlign: "justify", fontWeight: 400, fontSize: "1rem" }}>
    <Typography>
Kaikasekai means "Flourishing World".<br></br>
This insider-level, on-chain verified product empowers traders worldwide with the full potential of AI, open to everyone — whale or not — and price-friendly.

<div style={{ marginTop: 10, marginBottom: 0, boxShadow: "none", border: "none" }}>
              {!hasWhitelist && (
  <Button
    variant="contained"
    onClick={handleBuyWhitelist}
    disableElevation
    sx={{
    marginBottom: 6,
    backgroundColor: "#FFD700",
    color: "#101214",
    fontWeight: 500,
    fontSize: "1.2rem",
    border: "none",
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#FFDD33",
    },
  }}
  >
    Activate Referral Wallet (99.9 USDC)
  </Button>
)}
  </div>    
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
  <AccordionDetails style={{ padding: 0 }}>
  {proofs.length === 0 ? (
    <Typography>No proofs yet.</Typography>
  ) : (
    <div className="proofs-wrapper">
  <ProofCarousel
    proofs={[
  // 6 статических слайдов
  {
    nft: (
      <div style={{ width: '100%', height: 'calc(100% / 1.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <img
          src="https://pbs.twimg.com/media/Gav5-CTWIAAv-Wf.jpg"
          alt="November 2024"
          style={{ maxWidth: '50%', height: 'auto', display: 'block' }}
        />
        <p></p>
        <a href="https://x.com/kaikasekai/status/1849846927560417575?s=46&t=mq7NzK_MklQbSk36gyR5pg" target="_blank" rel="noopener noreferrer">
          November 2024
        </a>
      </div>
    ),
    result: (
      <img
        src="https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/1.PNG"
        alt="Result 1"
        style={{ width: '100%' }}
      />
    ),
  },
  {
    nft: (
      <div style={{ width: '100%', height: 'calc(100% / 1.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <img
          src="https://pbs.twimg.com/media/GdkpXY4WUAABozr.jpg"
          alt="December 2024"
          style={{ maxWidth: '50%', height: 'auto', display: 'block' }}
        />
        <p></p>
        <a href="https://x.com/kaikasekai/status/1862565413160145174?s=46&t=mq7NzK_MklQbSk36gyR5pg" target="_blank" rel="noopener noreferrer">
          December 2024
        </a>
      </div>
    ),
    result: (
      <img
        src="https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/2.PNG"
        alt="Result 2"
        style={{ width: '100%' }}
      />
    ),
  },
  {
    nft: (
      <div style={{ width: '100%', height: 'calc(100% / 1.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <img
          src="https://pbs.twimg.com/media/GgEdStmWoAAwSPG.jpg"
          alt="January 2025"
          style={{ maxWidth: '50%', height: 'auto', display: 'block' }}
        />
        <p></p>
        <a href="https://x.com/kaikasekai/status/1873811142566699385?s=46&t=mq7NzK_MklQbSk36gyR5pg" target="_blank" rel="noopener noreferrer">
          January 2025
        </a>
      </div>
    ),
    result: (
      <img
        src="https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/3.PNG"
        alt="Result 3"
        style={{ width: '100%' }}
      />
    ),
  },
  {
    nft: (
      <div style={{ width: '100%', height: 'calc(100% / 1.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <img
          src="https://pbs.twimg.com/media/GjhvfCqW0AAPNY5.jpg"
          alt="February-March 2025"
          style={{ maxWidth: '50%', height: 'auto', display: 'block' }}
        />
        <p></p>
        <a href="https://x.com/kaikasekai/status/1889382743408255356?s=46&t=mq7NzK_MklQbSk36gyR5pg" target="_blank" rel="noopener noreferrer">
          February-March 2025
        </a>
      </div>
    ),
    result: (
      <img
        src="https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/4.PNG"
        alt="Result 4"
        style={{ width: '100%' }}
      />
    ),
  },
  {
    nft: (
      <div style={{ width: '100%', height: 'calc(100% / 1.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <img
          src="https://pbs.twimg.com/media/Gni6nlrXEAAfkLw.jpg"
          alt="April-June 2025"
          style={{ maxWidth: '50%', height: 'auto', display: 'block' }}
        />
        <p></p>
        <a href="https://x.com/kaikasekai/status/1907479658381099060?s=46&t=mq7NzK_MklQbSk36gyR5pg" target="_blank" rel="noopener noreferrer">
          April-June 2025
        </a>
      </div>
    ),
    result: (
      <img
        src="https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/5.PNG"
        alt="Result 5"
        style={{ width: '100%' }}
      />
    ),
  },
  {
    nft: (
      <div style={{ width: '100%', height: 'calc(100% / 1.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <img
          src="https://pbs.twimg.com/media/GxryXIYWMAAaRUD.jpg"
          alt="August-September 2025"
          style={{ maxWidth: '50%', height: 'auto', display: 'block' }}
        />
        <p></p>
        <a href="https://x.com/kaikasekai/status/1953139989643940344?s=46&t=mq7NzK_MklQbSk36gyR5pg" target="_blank" rel="noopener noreferrer">
          August-September 2025
        </a>
      </div>
    ),
    result: (
      <img
        src="https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/6.PNG"
        alt="Result 6"
        style={{ width: '100%' }}
      />
    ),
  },

  // динамические NFT
  ...proofs.map((nft) => ({
    nft: (
      <div style={{ width: '100%', height: 'calc(100% / 1.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <img src={nft.image} alt={nft.name} style={{ maxWidth: '50%', height: 'auto', display: 'block' }} />
        <h4>{nft.name}</h4>
        <p>{nft.description}</p>
        <a href={nft.polygonscan} target="_blank" rel="noopener noreferrer">View on Polygonscan</a>
      </div>
    ),
    result: (
      <img
        src={`https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/${nft.id}.PNG`}
        alt={`Result ${nft.id}`}
        style={{ width: '100%' }}
      />
    ),
  })),
]}
  />
</div>
  )}
</AccordionDetails>
</Accordion>
          </>
        )}
        
        
        {/* === Accordions (тоже вынесены, теперь видны всегда) === */}

{/* === Debug Log (в аккордеоне) === 
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
*/}

 
        
      

{/* === Disclaimer Page === */}
        {page === "disclaimer" && (
          <div style={{ marginTop: 20, textAlign: "justify", fontWeight: 400, fontSize: "1rem" }}>
            <Button
              variant="outlined"
              sx={{
    backgroundColor: "transparent",
    border: "1.5px solid #0080ff",
    color: "#0080ff",
    fontWeight: 500,
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "transparent",
      color: "#0080ff",
    },
  }}
              size="small"
              onClick={() => setPage("main")}
              style={{ marginBottom: 20, textTransform: 'none' }}
            >
              ← Back
            </Button>
            <h3>Terms & Privacy</h3>
            <p>
              

<h4>Disclaimer</h4>
Kaikasekai provides AI-powered forecasts and analytical insights for informational and educational purposes only. The content does not constitute financial, investment, or trading advice and should not be interpreted as a recommendation to buy, hold, or sell digital assets. Any trading or investment decisions based on this information are made at the user’s own discretion and risk. Kaikasekai and its affiliates assume no liability for any losses or damages resulting from the use of this website, its forecasts, or related products.
<p></p>
<h4>Privacy Policy</h4>
Kaikasekai does not collect personal data or use cookies. Certain features rely on trusted third-party providers, such as EmailGS (for paid communications with developers) and Reown Connect Wallet (for wallet linking and on-chain interactions). Wallet data, private keys, and payment details remain private and are never accessed or stored by Kaikasekai.
<p></p>
<h4>Wallet & Security</h4>
Connecting a crypto wallet is optional. For security, we recommend using wallets with limited balances. All blockchain transactions are public and recorded on-chain, and Kaikasekai has no control over gas fees, confirmations, or transaction outcomes.
<p></p>
<h4>Intellectual Property</h4>
All forecasts, models, algorithms, site content, text, and visuals are the exclusive property of Kaikasekai. Any unauthorized use, copying, modification, or redistribution of this material without prior written consent is prohibited.
<p></p>
<h4>External Links</h4>
This site may include links to external platforms or blockchain networks. Kaikasekai is not responsible for their availability, performance, or data handling practices.
<p></p>
<h4>Forecast Accuracy</h4>
Forecasts are developed with a focus on analytical precision but cannot guarantee future results. Information may be updated or contain inaccuracies, and independent research is recommended before making financial or investment decisions.
<p></p>
<h4>Acceptance of Terms</h4>
Use of this site constitutes acknowledgment and acceptance of these terms.
            </p>
          </div>
        )}

        {/* === Contact Page === */}
        {page === "contact" && (
          <div style={{ marginTop: 20, fontWeight: 400, fontSize: "1rem" }}>
            <Button
              variant="outlined"
              sx={{
    backgroundColor: "transparent",
    border: "1.5px solid #0080ff",
    color: "#0080ff",
    fontWeight: 500,
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "transparent",
      color: "#0080ff",
    },
  }}
              size="small"
              onClick={() => setPage("main")}
              style={{ marginBottom: 20, textTransform: 'none' }}
            >
              ← Back
            </Button>
            <p></p>
            <h3>Contact Developers</h3>
            <p>

<Button
  variant="contained"
  disableElevation
  onClick={handlePayFeedback}
  sx={{
    backgroundColor: "transparent",
    border: "1.5px solid #0080ff",
    color: "#0080ff",
    fontWeight: 500,
    fontSize: "1.2rem",
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#0080ff",
      color: "#ffffff",
    },
  }}
>
  Access Developers (99.9 USDC)
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
      variant="outlined"
      onClick={handleSendFeedback}
    >
      Send
    </Button>
  </div>
)}
              
            </p>
          </div>
        )}
      </main>

{/* === Floating Donate Donut Button (inline SVG version) === */}
<div
  style={{
    position: "fixed",
    bottom: "15px",
    left: "15px",
    zIndex: 9999,
  }}
>
  {showDonatePopup ? (
    <div
      style={{
        background: "white",
        border: "1px solid #ccc",
        borderRadius: "0px",
        padding: "15px",
        boxShadow: "0 1px 1px rgba(0,0,0,0.15)",
        width: "260px",
      }}
    >
      <h4 style={{ margin: "0 0 10px 0" }}>Donute</h4>
      <TextField
        label="Amount ( USDC )"
        value={donateAmount}
        onChange={(e) => setDonateAmount(e.target.value)}
        sx={{ borderRadius: 0 }}
        fullWidth
        margin="dense"
      />
      <Button
        variant="contained"
        disableElevation
        sx={{
    backgroundColor: "#0080ff",
    border: "0px",
    color: "#ffffff",
    fontWeight: 500,
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#0080ff",
      color: "#ffffff",
    },
  }}
        fullWidth
        onClick={handleDonate}
        style={{ marginTop: "10px" }}
      >
        Send
      </Button>
      <Button
        variant="text"
        fullWidth
        onClick={() => setShowDonatePopup(false)}
        style={{ marginTop: "4px" }}
      >
        Close
      </Button>
    </div>
  ) : (
    <button
  onClick={() => setShowDonatePopup(true)}
  style={{
    all: "unset",            // полностью убирает ВСЕ браузерные стили кнопки
    cursor: "pointer",       // оставляем только курсор
    display: "inline-block",
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    lineHeight: 0,
    boxShadow: "none",
    outline: "none",
  }}
>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="24" height="24" shape-rendering="crispEdges">
  <g>
    <rect x="2" y="7" width="1" height="1" fill="#b8ac86"/>
    <rect x="3" y="7" width="1" height="1" fill="#b8ac86"/>
    <rect x="4" y="7" width="1" height="1" fill="#b8ac86"/>
    <rect x="5" y="7" width="1" height="1" fill="#b8ac86"/>
    <rect x="6" y="6" width="1" height="1" fill="#b8ac86"/>
    <rect x="7" y="5" width="1" height="1" fill="#b8ac86"/>
    <rect x="1" y="5" width="1" height="1" fill="#d8cfaa"/>
    <rect x="2" y="6" width="1" height="1" fill="#d8cfaa"/>
    <rect x="2" y="5" width="1" height="1" fill="#d8cfaa"/>
    <rect x="3" y="5" width="1" height="1" fill="#d8cfaa"/>
    <rect x="4" y="5" width="1" height="1" fill="#d8cfaa"/>
    <rect x="5" y="5" width="1" height="1" fill="#d8cfaa"/>
    <rect x="6" y="5" width="1" height="1" fill="#d8cfaa"/>
    <rect x="5" y="6" width="1" height="1" fill="#d8cfaa"/>
    <rect x="4" y="6" width="1" height="1" fill="#d8cfaa"/>
    <rect x="3" y="6" width="1" height="1" fill="#d8cfaa"/>
    <rect x="1" y="6" width="1" height="1" fill="#b8ac86"/>
    <rect x="0" y="5" width="1" height="1" fill="#b8ac86"/>
    <rect x="0" y="4" width="1" height="1" fill="#808080"/>
    <rect x="1" y="4" width="1" height="1" fill="#e3e3e6"/>
    <rect x="0" y="3" width="1" height="1" fill="#e3e3e6"/>
    <rect x="1" y="3" width="1" height="1" fill="#e3e3e6"/>
    <rect x="0" y="2" width="1" height="1" fill="#e3e3e6"/>
    <rect x="1" y="1" width="1" height="1" fill="#e3e3e6"/>
    <rect x="2" y="0" width="1" height="1" fill="#e3e3e6"/>
    <rect x="3" y="0" width="1" height="1" fill="#e3e3e6"/>
    <rect x="4" y="0" width="1" height="1" fill="#e3e3e6"/>
    <rect x="5" y="0" width="1" height="1" fill="#e3e3e6"/>
    <rect x="6" y="1" width="1" height="1" fill="#e3e3e6"/>
    <rect x="6" y="2" width="1" height="1" fill="#e3e3e6"/>
    <rect x="6" y="3" width="1" height="1" fill="#e3e3e6"/>
    <rect x="6" y="4" width="1" height="1" fill="#808080"/>
    <rect x="5" y="4" width="1" height="1" fill="#e3e3e6"/>
    <rect x="5" y="3" width="1" height="1" fill="#e3e3e6"/>
    <rect x="5" y="2" width="1" height="1" fill="#e3e3e6"/>
    <rect x="5" y="1" width="1" height="1" fill="#ffd700"/>
    <rect x="0" y="4" width="1" height="1" fill="#ffd700"/>
    <rect x="4" y="1" width="1" height="1" fill="#e3e3e6"/>
    <rect x="3" y="1" width="1" height="1" fill="#e3e3e6"/>
    <rect x="2" y="1" width="1" height="1" fill="#e3e3e6"/>
    <rect x="1" y="2" width="1" height="1" fill="#e3e3e6"/>
    <rect x="3" y="2" width="1" height="1" fill="#c8c8cc"/>
    <rect x="4" y="2" width="1" height="1" fill="#c8c8cc"/>
    <rect x="2" y="2" width="1" height="1" fill="#ff0080"/>
    <rect x="6" y="4" width="1" height="1" fill="#ff0080"/>
    <rect x="2" y="3" width="1" height="1" fill="#c8c8cc"/>
    <rect x="2" y="4" width="1" height="1" fill="#c8c8cc"/>
    <rect x="7" y="2" width="1" height="1" fill="#c8c8cc"/>
    <rect x="7" y="3" width="1" height="1" fill="#c8c8cc"/>
    <rect x="7" y="4" width="1" height="1" fill="#c8c8cc"/>
  </g>
</svg>    
    </button>
  )}
</div>
 
      {/* === Footer === */}
      <footer>
        <div className="footer-content">
          <div className="footer-links">
            <span className="footer-link" onClick={() => setPage("disclaimer")}>
              Terms & Privacy
            </span>
            <span className="footer-link" onClick={() => setPage("contact")}>
              Contact Developers
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
            <span className="footer-copy"> © 2025 Kaikasekai, all rights reserved</span>
          </div>
        </div>
      </footer>
      <p></p>
    </>
  );
}

export default App;
