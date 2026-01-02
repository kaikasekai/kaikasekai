import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#ff0080",
  "#ff00ff",
  "#00a37a",
  "#4b00ff",
  "#ff5c73",
  "#aa00a8",
  "#aaff00",
  "#c44200",
];

// === Contract Config ===
const OWNER_ADDRESS = "0xb57ec96FC3E9cF588c5E6fEfCad14F21F65e4Dff";
const CONTRACT_ADDRESS = "0x0E8304ac6711742b9c632D00006062c45db383F5";
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


  
  // 👈 вот сюда вставляем useEffect
  useEffect(() => {
    setExpandedItems([]); // закрывает все аккордеоны при смене страницы
  }, [page]);
  


const ImageZoom = ({ src, alt, style }) => {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && setZoomed(false);
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // модальное изображение как отдельный узел
  const zoomContent = (
    <div
      onClick={() => setZoomed(false)}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.2)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
        cursor: "zoom-out",
      }}
    >
      <img
        src={src}
        alt={alt}
        style={{
          maxWidth: "95vw",
          maxHeight: "95vh",
          objectFit: "contain",
          borderRadius: "0px",
          boxShadow: "0 0 0px rgba(255,255,255,0.2)",
        }}
      />
    </div>
  );

  return (
    <>
      <img
        src={src}
        alt={alt}
        onClick={() => setZoomed(true)}
        style={{
          cursor: "zoom-in",
          width: "100%",
          height: "auto",
          display: "block",
          borderRadius: "0px",
        }}
      />
      {zoomed && createPortal(zoomContent, document.body)}
    </>
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
            (sum, r) => sum + (1 - Math.abs((r.predict - r.BTC) / r.BTC)),
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
      alert("✅ Approve confirmed. Now confirm Referral Wallet Activation in your wallet!");
    }

    // задержка, чтобы MetaMask успел обработать approve
    await new Promise(r => setTimeout(r, 1000));
    
    log("Buying whitelist...");
    const tx = await contract.buyWhitelist(); // contract уже создан с signer
    await tx.wait();
    log("✅ Referral Wallet Activated");

    // Обновим стейт whitelisted
    const whitelisted = await contract.whitelistedReferrers(account);
    setHasWhitelist(Boolean(whitelisted));

    alert("✅ Referral Wallet Activated!");
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Referral Wallet Activation failed");
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
    alert("❌ Subscription failed");
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
    alert("❌ Donation failed");
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

    alert("✅ Your message sent to developers!");
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


	const nftPercents = {
2: 87.6,
3: 86.6,
4: 96.7,
5: 0.0,
// ... и так далее, можно подставить все id
};
	
	const styles = {
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: "1rem",
      padding: "0.5rem",
      borderBottom: "1px solid #ccc",
    },
    logo: {
      width: "36px",
      height: "auto",
      flexShrink: 0,
    },
    title: {
      fontFamily: 'Satoshi',
      fontSize: "clamp(1rem, 2vw, 1.5rem)",
      fontWeight: 600,
      color: "#333",
    },
    main: {
      padding: "1rem",
    },
  };

  return (
    <>

    <header style={styles.header}>
        <svg
          style={styles.logo}
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
      </header>
		
      <main
        style={{
    padding: 10,
    maxWidth: "min(98vw, 1000px)",     // не выходит за границы экрана
    margin: "0 auto",                  // выравнивает по центру
    boxSizing: "border-box",           // учитывает padding в ширине
  }}
        >
        
        {/* === Страница MAIN === */}
        {page === "main" && (
          <>
            {/* === Chart === */}
            <div style={{ marginTop: 46, marginBottom: 0, width: "100%", minHeight: "200px" }}>
              <ResponsiveContainer width="100%" height={500} className="chart-wrapper">
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => dayjs(d).format("MMM D")}
                  />
                  <YAxis
                    domain={[40000, 150000]}
                    ticks={[
                      50000, 60000, 70000, 80000, 90000, 100000,
                      110000, 120000, 130000, 140000, 150000,
                    ]}
                    tickFormatter={(v) => v.toLocaleString()}
                      label={{
    value: "USD",
    angle: -90, // вертикально
    position: "insideBottomLeft", // у начала оси, внутри
    offset: 15, // можно поиграть: 0..20 для тонкой подгонки
    style: {
      textAnchor: "end",
      fill: "#666",
      fontSize: 14,
      fontWeight: 500,
    },
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
                    dataKey="predict"
                    stroke="#0080ff"
                    dot={false}
                    strokeWidth={6}
                  />
                  <Line
                    type="monotone"
                    dataKey="moving_average"
                    stroke="#8000ff"
                    dot={false}
                    strokeDasharray="5 5"
                    strokeWidth={3}
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
<div style={{ paddingTop: "20px", paddingLeft: "10px", paddingBottom: "0px", marginBottom: "24px" }} >
              <h1
  style={{
    textTransform: "uppercase", // все буквы заглавные
    fontSize: "1.8rem",         // или "36px"
    fontWeight: 700,
    marginTop: "10px",
    marginBottom: "15px",    // или "20px"
  }}
>
  Kaikasekai Trends
</h1>

            
      {/*       
              <div style={{ margin: 0 }}>
                {subscriptionActive
                  ? "Range: Current + Next month"
                  : "Range: Current month"}
              </div>
     */}
              

<div style={{
  marginTop: 0,
fontWeight: 500,
  fontSize: "1.25rem",
  lineHeight: "1.5em", 
}}>
  Advanced AI-powered algorithm predicts the global BTC trend with {mape}%<sup>*</sup> accuracy
</div>
<div style={{ display: "block", marginTop: 0, marginBottom: 0, color: "#666", fontWeight: 300, fontSize: "1.25rem", lineHeight: "1em" }}>
  <sup>*</sup>based on rolling 30-day metrics
</div>
              </div>

{/* === Subscription block === */}
<div style={{ marginTop: 0, paddingLeft: "10px" }}>
  {account ? (
    subscriptionActive ? (
      <div>
        <p style={{ color: "#00C853", fontSize: "1.25rem", fontWeight: 300 }}>Subscription active</p>
        {subscriptionEnd && (
          <p>
            Your subscription ends on:{" "}
            {new Date(subscriptionEnd * 1000).toLocaleDateString()}
          </p>
        )}
      </div>
    ) : (
      <div>
        <p style={{ color: "#FF5252", fontSize: "1.25rem", fontWeight: 300 }}>Subscription inactive</p>
        {nextEndTime && (
          <p>
            Subscription ends on:{" "}
            {new Date(nextEndTime * 1000).toLocaleDateString()}
          </p>
        )}
      </div>
    )
  ) : null}

  {/* Кнопка и TextField видны всегда */}
  {!hasSubscribed && (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      marginTop: 0,
      marginBottom: 24,
      alignItems: "flex-start",
    }}
  >

<div style={{ marginTop: 0, marginBottom: 0, boxShadow: "none", border: "none" }}>
    <Button
    variant="contained"
    onClick={handleSubscribe}
    disableElevation
    sx={{
    marginBottom: 0,
      padding: 2,
    backgroundColor: "#F7931A",
    color: "#1c1c1c",
    fontWeight: 500,
    fontSize: "1.1rem",
      height: "46px",
    border: "none",
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#FFA733",
    },
  }}
    >
      Unlock next month 49.9 USDC
    </Button>
  </div>
  
  <div>
      <TextField
  variant="outlined"
  placeholder="24.9 USDC with referral code"
  value={referrer}
  onChange={(e) => setReferrer(e.target.value)}
  inputProps={{
    maxLength: 42,
    style: { textAlign: "left", fontSize: "0.9rem" },
  }}
  sx={{
  width: "29ch",
  "& .MuiOutlinedInput-root": {
    borderRadius: 0,
    height: "46px",
    "& fieldset": {
      borderColor: "#ccc",
      borderWidth: "1px", // одинаковая толщина
    },
    "&:hover fieldset": {
      borderColor: "#ccc",
      borderWidth: "1px", // не утолщается при ховере
    },
    "&.Mui-focused fieldset": {
      borderColor: "#ccc",
      borderWidth: "1px", // не утолщается при фокусе
    },
    "& input": {
      textAlign: "left",
	  fontSize: "0.9rem",
      padding: "0 0 0 15px",
    },
  },
  "& .MuiInputLabel-root": {
    color: "ccc",
    "&.Mui-focused": { color: "#ccc" },
  },
}}
/>
    </div>

  </div>
  )}
</div>

{/* === Wallet section === */}
{!account ? (
  <div
  style={{
    display: "inline-flex",
    alignItems: "flex-start",
    gap: "5px",
    marginTop: 0,
    marginBottom: 56,
    paddingLeft: "10px",
  }}
>
  <Button
    onClick={connectWallet}
    disableElevation
    sx={{
      display: "flex",
      alignItems: "center",
      gap: "4px",
      backgroundColor: "#0080ff",
      color: "#ffffff",
      padding: 2,
      height: "46px",
      fontWeight: 500,
      fontSize: "1.1rem",
      border: "none",
      borderRadius: 0,
      cursor: "pointer",
      "&:hover": { backgroundColor: "#3399FF" },
    }}
  >
    Connect Wallet
  </Button>

<svg
width="24"
height="24"
viewBox="0 0 360 360"
fill="none"
xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
style={{ display: "block" }}
>
<path d="M157.743 154.241L141.052 144.58L90.9766 173.561V231.519L141.052 260.5L191.13 231.519V141.359L218.948 125.26L246.77 141.359V173.561L218.948 189.66L202.257 180.002V205.759L218.948 215.42L269.024 186.439V128.481L218.948 99.5L168.873 128.481V218.641L141.052 234.74L113.233 218.641V186.439L141.052 170.34L157.743 179.998V154.241Z"
  fill="#6C00F6"
/>
  </svg>
</div>

) : (
  <div style={{ paddingLeft: "10px", marginBottom: "56px" }}>
    <p style={{ color: "#0080ff", fontSize: "1.25rem", fontWeight: 300 }}>Connected: {account}</p>
  </div>
)}

   </div>  

            
      {/* === Donate (оставляем только для подключённого кошелька) === 
      {account && (
        <div style={{ marginTop: 20 }}>
          <h3>Donate</h3>
          <TextField
            label="Amount USDC"
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
<Accordion style={{ marginTop: 0, boxShadow: "none", border: "none", paddingLeft: "10px", paddingRight: "10px" }}>
  <AccordionSummary
    expandIcon={<span className="accordion-icon">{expandedItems.includes("how") ? "−" : "+"}</span>}
    onClick={() => toggleAccordion("how")}
    style={{ padding: "0px 0" }}
  >
    <Typography  sx={{ fontWeight: 500, fontSize: "1.6rem" }}>How it works</Typography>
  </AccordionSummary>
  <AccordionDetails >
    <Typography sx={{ padding: "0px 0", textAlign: "justify", fontWeight: 400, fontSize: "1.25rem" }}>
Each thin, colorful line on the chart represents an unique AI model predicting the most probable scenario for Bitcoin’s next move. The thick blue line shows the averaged outcome of these AI model cluster scenarios - the core BTC trend forecast - while the thick orange line displays historical BTC data.
<br></br><br></br>
The forecast reflects both mid-term and global BTC trends.
It may follow one of the cluster models more closely and show slight time elasticity - occurring a bit earlier or later - but it maintains overall consistency even during high volatility and market manipulations, making them easier to spot.
<br></br><br></br>
AI models from the cluster perform advanced technical analysis and research nearly every other factor that could influence crypto’s next moves - from stock market indicators to even rarely used metaphysical aspects.
<br></br><br></br>
Models are renewed monthly with additional training data to stay accurate and up to date.
At the beginning of each month, the forecast for the new month is released, while the current month’s forecast receives updates.
      
    <div style={{ height: "56px" }}></div>

  </Typography>
  </AccordionDetails>
</Accordion>

<Accordion style={{ marginTop: 0, boxShadow: "none", border: "none", paddingLeft: "10px", paddingRight: "10px" }}>
  <AccordionSummary
    expandIcon={<span className="accordion-icon">{expandedItems.includes("ref") ? "−" : "+"}</span>}
    onClick={() => toggleAccordion("ref")}
    style={{ padding: "0px 0" }}
  >
    <Typography sx={{ fontWeight: 500, fontSize: "1.6rem" }}>Referral program</Typography>
  </AccordionSummary>
  <AccordionDetails>
    <Typography  sx={{ padding: "0px 0", textAlign: "justify", fontWeight: 400, fontSize: "1.25rem" }}>
Kaikasekai means Flourishing World.<br></br>
This insider-level, on-chain verified product empowers traders worldwide with the full potential of AI, open to everyone - whale or not.

<div style={{ marginTop: 24, marginBottom: 24, boxShadow: "none", border: "none" }}>
              {!hasWhitelist && (
  <Button
    variant="contained"
    onClick={handleBuyWhitelist}
    disableElevation
    sx={{
    marginBottom: 0,
    backgroundColor: "#FFD700",
      height: "46px",
      padding: 2,
    color: "#1c1c1c",
    fontWeight: 500,
    fontSize: "1.1rem",
    border: "none",
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#FFDD33",
    },
  }}
  >
    Activate Referral Wallet 99.9 USDC
  </Button>
)}
  </div>    
Join the program - your wallet will be whitelisted and linked to the smart contract. Use your wallet number as your referral code: your subscribers get 50% off, and you earn 10% on every purchase.

<div style={{ height: "56px" }}></div>
      
    </Typography>
  </AccordionDetails>
</Accordion>

<Accordion
  style={{
    marginTop: 0,
    boxShadow: "none",
    border: "none",
    paddingLeft: "10px",
    paddingRight: "10px",
  }}
>
  <AccordionSummary
    expandIcon={<span className="accordion-icon">{expandedItems.includes("proofs") ? "−" : "+"}</span>}
    onClick={() => toggleAccordion("proofs")}
    style={{ padding: "0px 0" }}
  >
    <Typography sx={{ fontWeight: 500, fontSize: "1.6rem" }}>Proofs</Typography>
  </AccordionSummary>

  <AccordionDetails style={{ padding: 0 }}>
    {proofs.length === 0 ? (
      <Typography>No proofs yet.</Typography>
    ) : (
      <div className="proofs-wrapper">
        <ProofCarousel
          proofs={[
            // 6 статических слайдов
            ...[
              {
                month: "Nov 24",
                img: "https://pbs.twimg.com/media/Gav5-CTWIAAv-Wf.jpg",
                link: "https://x.com/kaikasekai/status/1849846927560417575?s=46&t=mq7NzK_MklQbSk36gyR5pg",
                result: "https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/NOV.PNG",
				res: "84",
              },
              {
                month: "Dec 24",
                img: "https://pbs.twimg.com/media/GdkpXY4WUAABozr.jpg",
                link: "https://x.com/kaikasekai/status/1862565413160145174?s=46&t=mq7NzK_MklQbSk36gyR5pg",
                result: "https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/DEC.PNG",
				res: "94.4",
              },
              {
                month: "Jan 25",
                img: "https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/IMG_4920.jpeg",
                link: "https://x.com/kaikasekai/status/1873811142566699385?s=46&t=mq7NzK_MklQbSk36gyR5pg",
                result: "https://pbs.twimg.com/media/GjhvfCqW0AAPNY5.jpg",
				res: "86.2",
              },
              {
                month: "Feb-Mar 25",
                img: "https://pbs.twimg.com/media/GjhvfCqW0AAPNY5.jpg",
                link: "https://x.com/kaikasekai/status/1889382743408255356?s=46&t=mq7NzK_MklQbSk36gyR5pg",
                result: "https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/FEBMAR.PNG",
				res: "83.8",
              },
              {
                month: "Apr-Jun 25",
                img: "https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/IMG_4919.jpeg",
                link: "https://x.com/kaikasekai/status/1907479658381099060?s=46&t=mq7NzK_MklQbSk36gyR5pg",
                result: "https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/APRJUN.PNG",
				res: "91",
              },
              {
                month: "Aug-Sep 25",
                img: "https://pbs.twimg.com/media/GxryXIYWMAAaRUD.jpg",
                link: "https://x.com/kaikasekai/status/1953139989643940344?s=46&t=mq7NzK_MklQbSk36gyR5pg",
                result: "https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/AUGSEP.PNG",
				res: "88.3",
              },
            ].map(({ month, img, link, result, res }) => ({
              nft: (
                <div
                  style={{
                    width: "100%",
                    maxHeight: "60vw",
					padding: "5px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <ImageZoom
                    src={img}
                    alt={`${month} Forecast`}
                    style={{
					 width: "50%",
                  //   height: "auto",         // ⬅️ высота = 60% ширины экрана
    				 maxHeight: "50%",      // ⬅️ можно ограничить верхнюю границу, чтобы не было слишком больших
   					 objectFit: "contain",      // ⬅️ картинка не искажается
  				     display: "block",
                     borderRadius: "0px",
				     margin: "0 auto",
					 justifyContent: "flex-end",
                    }}
                  />
                  <div
                    style={{
                      marginTop: "8px",
                      color: "#1c1c1c",
                      fontSize: "0.95rem",
                      marginBottom: "6px",
                    }}
                  >
                    {month} Forecast
                  </div>

                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#1c1c1c",
                      fontSize: "0.85rem",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    View on
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 300 300"
                      width="14"
                      height="14"
                      fill="#1c1c1c"
                    >
                      <path d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66" />
                    </svg>
                  </a>
                </div>
              ),
              result: (
                <div
                  style={{
                    width: "100%",
					padding: "5px",
                    maxHeight: "60vw",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <ImageZoom
                    src={result}
                    alt={`Result ${month}`}
                    style={{
                     width: "50%",
                  //   height: "auto",          // ⬅️ высота = 60% ширины экрана
    				 maxHeight: "50%",      // ⬅️ можно ограничить верхнюю границу, чтобы не было слишком больших
   					 objectFit: "contain",      // ⬅️ картинка не искажается
  				     display: "block",
                     borderRadius: "0px",
					 margin: "0 auto",
					 justifyContent: "flex-end",
                    }}
                  />
                  <div
                    style={{
                      marginTop: "8px",
                      color: "#666",
                      fontSize: "0.95rem",
                      marginBottom: "6px",
                    }}
                  >
                    Result: {res}%
                  </div>

<div
  style={{
    height: "24px", // подгони если нужно
  }}
/>
					
                </div>
              ),
            })),
            // динамические NFT
...proofs.map((nft) => ({
nft: (
<div
style={{
width: "100%",
padding: "5px",
maxHeight: "60vw",
display: "flex",
flexDirection: "column",
justifyContent: "center",
}}
>
<ImageZoom
src={nft.image}
alt={nft.name}
style={{
width: "50%",
maxHeight: "50%",
objectFit: "contain",
display: "block",
borderRadius: "0px",
margin: "0 auto",
justifyContent: "flex-end",
}}
/>
<div
style={{
marginTop: "8px",
color: "#1c1c1c",
fontSize: "0.95rem",
marginBottom: "6px",
}}
>
{nft.name} Forecast </div>
  
	<div
  style={{
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "nowrap",
  }}
>
	
	
	<a
    href={nft.polygonscan}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      color: "#1c1c1c",
      fontSize: "0.85rem",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    }}
  >
    View on
    <svg width="24" height="24" viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M157.743 154.241L141.052 144.58L90.9766 173.561V231.519L141.052 260.5L191.13 231.519V141.359L218.948 125.26L246.77 141.359V173.561L218.948 189.66L202.257 180.002V205.759L218.948 215.42L269.024 186.439V128.481L218.948 99.5L168.873 128.481V218.641L141.052 234.74L113.233 218.641V186.439L141.052 170.34L157.743 179.998V154.241Z"
        fill="#6C00F6"
      />
    </svg>
  </a>
 <a
    href={`https://opensea.io/item/polygon/0x0878c09ffe2e702c1a7987b38c63c42e2062b803/${nft.id}`}
    target="_blank"
    rel="noopener noreferrer"
    style={{
      color: "#1c1c1c",
      fontSize: "0.85rem",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
    }}
  >
    <svg width="24" height="24" viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M252.072 212.292C245.826 220.662 232.686 234.558 225.378 234.558H191.412V212.274H218.466C222.336 212.274 226.026 210.708 228.69 207.954C242.586 193.554 250.614 176.418 250.614 158.04C250.614 126.684 227.178 98.964 191.394 82.26V67.284C191.394 60.84 186.174 55.62 179.73 55.62C173.286 55.62 168.066 60.84 168.066 67.284V73.494C158.04 70.56 147.42 68.328 136.332 67.05C154.692 86.994 165.906 113.67 165.906 142.92C165.906 169.146 156.942 193.23 141.876 212.31H168.066V234.63H129.726C124.542 234.63 120.33 230.436 120.33 225.234V215.478C120.33 213.768 118.944 212.364 117.216 212.364H66.672C65.682 212.364 64.836 213.174 64.836 214.164C64.8 254.088 96.39 284.058 134.172 284.058H240.822C266.382 284.058 277.812 251.298 292.788 230.454C298.602 222.39 312.552 215.91 316.782 214.11C317.556 213.786 318.006 213.066 318.006 212.22V199.26C318.006 197.946 316.71 196.956 315.432 197.316C315.432 197.316 253.782 211.482 253.062 211.68C252.342 211.896 252.072 212.31 252.072 212.31V212.292Z" fill="white"/>
<path d="M146.16 142.83C146.16 122.724 139.266 104.22 127.746 89.586L69.732 189.972H132.138C141.012 176.436 146.178 160.236 146.178 142.848L146.16 142.83Z" fill="white"/>
<path d="M181.566 -5.19844e-06C80.91 -0.828005 -0.82799 80.91 1.00604e-05 181.566C0.84601 279.306 80.694 359.172 178.416 359.982C279.072 360.846 360.846 279.072 359.982 178.416C359.172 80.712 279.306 0.845995 181.566 -5.19844e-06ZM127.746 89.586C139.266 104.22 146.16 122.742 146.16 142.83C146.16 160.236 140.994 176.436 132.12 189.954H69.714L127.728 89.568L127.746 89.586ZM318.006 199.242V212.202C318.006 213.048 317.556 213.768 316.782 214.092C312.552 215.892 298.602 222.372 292.788 230.436C277.812 251.28 266.382 284.04 240.822 284.04H134.172C96.408 284.04 64.818 254.07 64.836 214.146C64.836 213.156 65.682 212.346 66.672 212.346H117.216C118.962 212.346 120.33 213.75 120.33 215.46V225.216C120.33 230.4 124.524 234.612 129.726 234.612H168.066V212.292H141.876C156.942 193.212 165.906 169.128 165.906 142.902C165.906 113.652 154.692 86.976 136.332 67.032C147.438 68.328 158.058 70.542 168.066 73.476V67.266C168.066 60.822 173.286 55.602 179.73 55.602C186.174 55.602 191.394 60.822 191.394 67.266V82.242C227.178 98.946 250.614 126.666 250.614 158.022C250.614 176.418 242.568 193.536 228.69 207.936C226.026 210.69 222.336 212.256 218.466 212.256H191.412V234.54H225.378C232.704 234.54 245.844 220.644 252.072 212.274C252.072 212.274 252.342 211.86 253.062 211.644C253.782 211.428 315.432 197.28 315.432 197.28C316.728 196.92 318.006 197.91 318.006 199.224V199.242Z" fill="#0086FF"/>
    </svg>
  </a>


	</div>
		
</div>
),

result: ( <div
                  style={{
                    width: "100%",
					padding: "5px",
                    maxHeight: "60vw",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
<ImageZoom
src={`https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/results/${nft.name}.png`}
alt={`Result ${nft.name}`}
style={{
width: "50%",
maxHeight: "50%",
objectFit: "contain",
display: "block",
borderRadius: "0px",
margin: "0 auto",
justifyContent: "flex-end",
}}
/>
<div
style={{
marginTop: "8px",
color: "#666",
fontSize: "0.95rem",
marginBottom: "6px",
}}
>
Result: {nftPercents[nft.id] ? `${nftPercents[nft.id]}%` : "—"}
</div>

<div
  style={{
    height: "24px", // подгони если нужно
  }}
/>

	

	

</div>
),
}))

          ]}
        />
      </div>
    )}
  </AccordionDetails>
</Accordion>

            <div style={{ height: "89px" }}></div>
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
          <div style={{ marginTop: 32, marginBottom: 56, textAlign: "justify", fontWeight: 400, fontSize: "1rem", padding: 20 }}>
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
			  
            <h3 style={{ fontWeight: 700, fontSize: "1.8rem" }}>Terms & Privacy</h3>
            <p>
              
<div style={{ height: "20px" }}></div>

<h4 style={{ fontWeight: 500, fontSize: "1.25rem" }}>Disclaimer</h4>
Kaikasekai provides AI-powered forecasts and analytical insights for informational and educational purposes only. The content does not constitute financial, investment, or trading advice and should not be interpreted as a recommendation to buy, hold, or sell digital assets. Any trading or investment decisions based on this information are made at the user’s own discretion and risk. Kaikasekai and its affiliates assume no liability for any losses or damages resulting from the use of this website, its forecasts, or related products.
<div style={{ height: "20px" }}></div>
<h4 style={{ fontWeight: 500, fontSize: "1.25rem" }}>Privacy Policy</h4>
Kaikasekai does not collect personal data or use cookies. Certain features rely on trusted third-party providers, such as EmailJS (for paid communications with developers) and Reown Connect Wallet (for wallet linking and on-chain interactions). Wallet data, private keys, and payment details remain private and are never accessed or stored by Kaikasekai.
<div style={{ height: "20px" }}></div>
<h4 style={{ fontWeight: 500, fontSize: "1.25rem" }}>Wallet & Security</h4>
Connecting a crypto wallet is optional. For security, we recommend using wallets with limited balances. All blockchain transactions are public and recorded on-chain, and Kaikasekai has no control over gas fees, confirmations, or transaction outcomes.
<div style={{ height: "20px" }}></div>
<h4 style={{ fontWeight: 500, fontSize: "1.25rem" }}>Intellectual Property</h4>
All forecasts, models, algorithms, site content, text, and visuals are the exclusive property of Kaikasekai. Any unauthorized use, copying, modification, or redistribution of this material without prior written consent is prohibited.
<div style={{ height: "20px" }}></div>
<h4 style={{ fontWeight: 500, fontSize: "1.25rem" }}>External Links</h4>
This site may include links to external platforms or blockchain networks. Kaikasekai is not responsible for their availability, performance, or data handling practices.
<div style={{ height: "20px" }}></div>
<h4 style={{ fontWeight: 500, fontSize: "1.25rem" }}>Forecast Accuracy</h4>
Forecasts are developed with a focus on analytical precision but cannot guarantee future results. Information may be updated or contain inaccuracies, and independent research is recommended before making financial or investment decisions.
<div style={{ height: "20px" }}></div>
<h4 style={{ fontWeight: 500, fontSize: "1.25rem" }}>Acceptance of Terms</h4>
Use of this site constitutes acknowledgment and acceptance of these terms.
<div style={{ height: "20px" }}></div>

            </p>
          </div>
        )}

        {/* === Contact Page === */}
        {page === "contact" && (
          <div style={{ marginTop: 32, fontWeight: 400, fontSize: "1rem", padding: 20 }}>
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
			  
            <h3 style={{ fontWeight: 700, fontSize: "1.8rem" }}>Contact Developers</h3>

			  <div style={{ height: "20px" }}></div>
			  
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
    height: "46px",
    padding: 2,
    fontSize: "1.1rem",
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "#0080ff",
      color: "#ffffff",
    },
  }}
>
  Access Developers 99.9 USDC
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
      sx={{
    borderRadius: "0px",
  }}
    />
    <TextField
      label="Message"
      value={feedbackMessage}
      onChange={(e) => setFeedbackMessage(e.target.value)}
      fullWidth
      multiline
      rows={4}
      margin="dense"
      sx={{
    borderRadius: "0px",
  }}
    />
    <Button
      variant="outlined"
      onClick={handleSendFeedback}
      sx={{
    backgroundColor: "#0080ff",
    marginTop: 2,
    border: "0px",
    color: "#ffffff",
    fontWeight: 500,
    borderRadius: "0px",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "transparent",
      color: "#0080ff",
    },
  }}
      size="small"
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
      <h4 style={{ margin: "0 0 10px 0", fontWeight: 500, fontSize: "1.6rem", color: "#549962" }}>Donute</h4>
      <TextField
        label="USDC"
        value={donateAmount}
        onChange={(e) => setDonateAmount(e.target.value)}
        sx={{ borderRadius: "0px" }}
        fullWidth
        margin="dense"
      />
      <Button
        variant="contained"
        disableElevation
        sx={{
    backgroundColor: "#69c04c",
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
        style={{ marginTop: "4px", color: "#549962" }}
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
              <a
  href="https://x.com/kaikasekai?s=21&t=mq7NzK_MklQbSk36gyR5pg"
  target="_blank"
  rel="noopener noreferrer"
  className="footer-link"
  style={{ display: 'inline-flex', alignItems: 'center' }}
>
				<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 300 300"
    width="15"
    height="15"
    fill="#666"
  >
    <path d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66" />
  </svg>
            </a>
          </div>

          <div className="footer-logo-block"
            style={{
    marginTop: '10px',
    marginBottom: '0px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }}>
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
