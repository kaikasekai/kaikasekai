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
  formatUnits,
  BigNumber,
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
  "#ff8000",
  "#00ff80",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0080ff",
  "#8000ff",
  "#ff00ff",
  "#0080ff",
  "#ff0080",
];

// === Contract Config ===
const OWNER_ADDRESS = "0xd801cA2291a797e377533D134e129eA258810673"; // owner address
const CONTRACT_ADDRESS = "0x1b453Ed4252Ea0e64CaB49E918fbcfC62d7fAf20";

const CONTRACT_ABI = [
  "function usdc() view returns (address)",
  "function owner() view returns (address)",
  "function nextEndTime() view returns (uint256)",
  "function price() view returns (uint256)",
  "function whitelistPrice() view returns (uint256)",
  "function feedbackPrice() view returns (uint256)",
  "function referralDiscount() view returns (uint256)",
  "function referralReward() view returns (uint256)",
  "function whitelistedReferrers(address) view returns (bool)",
  "function subscriptionEnd(address) view returns (uint256)",
  "function isActive(address) view returns (bool)",
  "function referrerOf(address) view returns (address)",
  "function hasEverSubscribed(address) view returns (bool)",
  "function contractUSDCBalance() view returns (uint256)",
  "function buyWhitelist() external",
  "function subscribe(address refAddr) external",
  "function donate(uint256 amount) external",
  "function payFeedback() external",
  "function withdraw(address to, uint256 amount) external",
  "function setOwner(address newOwner) external",
  "function setNextEndTime(uint256 _endTime) external",
  "function setPrice(uint256 newPrice) external",
  "function setWhitelistPrice(uint256 newPrice) external",
  "function setFeedbackPrice(uint256 newPrice) external",
  "function setReferralParams(uint256 discountAmount, uint256 rewardAmount) external",
  "event NextEndTimeUpdated(uint256 newEndTime, address indexed owner)",
  "event FeedbackPaid(address indexed user, uint256 amount)"
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
  "function totalSupply() view returns (uint256)"
];


function App() {
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
  const [hasWhitelist, setHasWhitelist] = useState(false);
  const [showTwoMonths, setShowTwoMonths] = useState(false);
  const [referrer, setReferrer] = useState("");
  const [donateAmount, setDonateAmount] = useState("");
  const [hasSubscribed, setHasSubscribed] = useState(false);
  const [feedbackPrice, setFeedbackPrice] = useState(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [processing, setProcessing] = useState(false); // блокировка повторных кликов
  const [nftContract, setNftContract] = useState(null);
  const [proofs, setProofs] = useState([]); // массив NFT-шек
  const [debug, setDebug] = useState([]);
  const [priceDisplay, setPriceDisplay] = useState(null);
  const [whitelistPriceDisplay, setWhitelistPriceDisplay] = useState(null);
  const [feedbackPriceDisplay, setFeedbackPriceDisplay] = useState(null);


  const readProvider = new JsonRpcProvider("https://polygon-rpc.com"); // read-only
  
  const log = (msg) => {
    setDebug((d) => [...d, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // === Fetch CSV data ===
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

    // === Proofs as NFT ===// === Proofs as NFT ===
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
        if (uri.startsWith("ipfs://")) uri = "https://ipfs.io/ipfs/" + uri.slice(7);
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
  params: [{ chainId: "0x89" }], // Polygon Mainnet
});
      } catch (err) {
        if (err.code === 4902) {
          await window.ethereum.request({
  method: "wallet_addEthereumChain",
  params: [
    {
      chainId: "0x89",
      chainName: "Polygon Mainnet",
      nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
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
        chains: [80002],
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

    const priceBN = await cont.price();
const wlPriceBN = await cont.whitelistPrice();
const feedbackPriceBN = await cont.feedbackPrice();

setPrice(priceBN);  // оставляем BigNumber для approve/subscribe
setWhitelistPrice(wlPriceBN);
setFeedbackPrice(feedbackPriceBN);

setPriceDisplay(formatUnits(priceBN, 6));       // для UI
setWhitelistPriceDisplay(formatUnits(wlPriceBN, 6));
setFeedbackPriceDisplay(formatUnits(feedbackPriceBN, 6));


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
  if (processing) return;
  setProcessing(true);

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const contractRead = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
    const usdcRead = new Contract(USDC_ADDRESS, USDC_ABI, readProvider);

    const wlPrice = await contractRead.whitelistPrice();
    const allowance = await usdcRead.allowance(account, CONTRACT_ADDRESS);

    if (allowance.lt(wlPrice)) {
      log("⏳ Approving USDC for whitelist...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, wlPrice);
      await approveTx.wait();
      alert("✅ Approve confirmed");
    }

    log("⏳ Buying whitelist...");
    const tx = await contract.buyWhitelist();
    await tx.wait();
    log("✅ BuyWhitelist confirmed");

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

    const contractRead = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
    const usdcRead = new Contract(USDC_ADDRESS, USDC_ABI, readProvider);

    const priceToPay = await contractRead.price();
    const allowance = await usdcRead.allowance(account, CONTRACT_ADDRESS);

    if (allowance.lt(priceToPay)) {
      log("⏳ Approving USDC for subscription...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceToPay);
      await approveTx.wait();
      alert("✅ Approve confirmed");
    }

    const bal = await usdcRead.balanceOf(account);
    if (bal.lt(priceToPay)) {
      alert("Insufficient USDC balance");
      return;
    }

    let refAddr = ZeroAddress;
    if (referrer && referrer.trim() !== "") {
      try {
        const candidate = getAddress(referrer.trim());
        if (candidate.toLowerCase() !== account.toLowerCase()) refAddr = candidate;
      } catch {
        return alert("Invalid referrer address");
      }
    }

    log("⏳ Subscribing...");
    const tx = await contract.subscribe(refAddr);
    await tx.wait();
    log("✅ Subscription confirmed");

    await checkSubscription(contract, account);
    alert("✅ Subscription successfull!");
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
    const usdcRead = new Contract(USDC_ADDRESS, USDC_ABI, readProvider);

    const amount = parseUnits(donateAmount, 6); // BigNumber
    const allowance = await usdcRead.allowance(account, CONTRACT_ADDRESS);

    if (allowance.lt(amount)) {
      log("⏳ Approving USDC for donation...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, amount);
      await approveTx.wait();
      alert("✅ Approve confirmed");
    }

    const bal = await usdcRead.balanceOf(account);
    if (bal.lt(amount)) {
      alert("Insufficient USDC balance");
      return;
    }

    log("⏳ Sending donation...");
    const tx = await contract.donate(amount);
    await tx.wait();
    log("✅ Donation confirmed");

    alert("✅ Donation sent to contract!");
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

    const contractRead = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
    const usdcRead = new Contract(USDC_ADDRESS, USDC_ABI, readProvider);

    const price = await contractRead.feedbackPrice();
    const allowance = await usdcRead.allowance(account, CONTRACT_ADDRESS);

    if (allowance.lt(price)) {
      log("⏳ Approving USDC for feedback...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, price);
      await approveTx.wait();
      alert("✅ Approve confirmed");
    }

    log("⏳ Paying for feedback...");
    const tx = await contract.payFeedback();
    await tx.wait();
    log("✅ Feedback payment confirmed");

    setShowFeedbackForm(true);
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

    alert("✅ Message has been send!");
    setFeedbackEmail("");
    setFeedbackMessage("");
    setShowFeedbackForm(false);
  } catch (e) {
    alert("❌ Error, message hasn't send");
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
    <div style={{ padding: 20 }}>
      <h2>BTC Forecast Chart</h2>

      {/* === Wallet section === */}
      {!account ? (
        <Button variant="contained" onClick={connectWallet}>
          Connect Wallet
        </Button>
      ) : (
        <div>
          <p>Connected: {account}</p>

          {subscriptionActive ? (
            <p>✅ Subscription active</p>
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

              <Button variant="contained" color="primary" onClick={handleSubscribe}>
                Subscribe
              </Button>

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
    color="secondary"
    onClick={handleBuyWhitelist}
    style={{ marginTop: 10 }}
  >
    Buy Whitelist ({whitelistPriceDisplay ?? "..."} USDC)
  </Button>
)}


<Button
  variant="contained"
  color="info"
  onClick={handlePayFeedback}
  style={{ marginTop: 10 }}
>
  Contact us ({feedbackPriceDisplay ?? "..."} USDC)
</Button>

{showFeedbackForm && (
  <div style={{ marginTop: 20, border: "1px solid #ccc", padding: 10, borderRadius: 8 }}>
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
      color="success"
      style={{ marginTop: 10 }}
      onClick={handleSendFeedback}
    >
      Send
    </Button>
  </div>
)}

            </div>
          )}
        

      {/* === Chart (вынесен из блока кошелька, теперь всегда виден) === */}
      <div style={{ marginTop: 20 }}>
        <small>
          {subscriptionActive
            ? "Range: Current + Next month"
            : "Range: Current month"}
        </small>
        <ResponsiveContainer width="100%" height={500} className="chart-wrapper">
          <LineChart data={filteredData} className="chart">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => dayjs(d).format("MMM D")}
            />
            <YAxis
  domain={[100000, 150000]}
  ticks={[100000,105000,110000,115000,120000,125000,130000,135000,140000,145000,150000]}
  tickFormatter={(v) => v.toLocaleString()}
/>
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="BTC"
              stroke="#f7931a"
              dot={false}
              strokeWidth={3}
            />
            <Line
              type="monotone"
              dataKey="moving_average"
              stroke="#00c69e"
              dot={false}
              strokeDasharray="5 5"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="predict"
              stroke="#0000ff"
              dot={false}
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
        <div style={{ marginTop: 10 }}>
          <strong>Accuracy last 30 days:</strong> {mape}%
        </div>
      </div>

      {/* === Donate (оставляем только для подключённого кошелька) === */}
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
          <Button variant="contained" color="secondary" onClick={handleDonate}>
            Donate
          </Button>
        </div>
      )}

      {/* === Accordions (тоже вынесены, теперь видны всегда) === */}
      <Accordion style={{ marginTop: 20, boxShadow: "none", border: "none", padding: 0 }}>
  <AccordionSummary expandIcon={<span style={{ fontSize: 20 }}>+</span>} style={{ padding: 0 }}>
          <Typography>About</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            The project predicts BTC values with an ensemble of AI models.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion style={{ marginTop: 20, boxShadow: "none", border: "none", padding: 0 }}>
  <AccordionSummary expandIcon={<span style={{ fontSize: 20 }}>+</span>} style={{ padding: 0 }}>
          <Typography>How it works</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Shows BTC, moving average, predictions, and error metrics (MAE/MAPE).
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion style={{ marginTop: 20, boxShadow: "none", border: "none", padding: 0 }}>
  <AccordionSummary expandIcon={<span style={{ fontSize: 20 }}>+</span>} style={{ padding: 0 }}>
    <Typography>Proofs</Typography>
  </AccordionSummary>
  <AccordionDetails>
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
          {/* NFT слева */}
          <div style={{ flex: 1 }}>
            {nft.image ? (
              <>
                <img
                  src={nft.image}
                  alt={nft.name}
                  style={{ width: "100%", borderRadius: 6 }}
                />
                <h4 style={{ margin: "10px 0 5px" }}>{nft.name}</h4>
                <p style={{ fontSize: 12, color: "#aaa" }}>
                  {nft.description}
                </p>
                <a
                  href={nft.polygonscan}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    color: "#0af",
                    display: "block",
                    marginTop: 5,
                  }}
                >
                  🔍 View on Polygonscan
                </a>
              </>
            ) : (
              <Typography>Loading NFT {nft.id}…</Typography>
            )}
          </div>

          {/* Результат справа */}
          <div style={{ flex: 1 }}>
            <img
              src={resultUrl}
              alt={`Result ${nft.id}`}
              style={{ width: "100%", borderRadius: 6 }}
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

      {/* === Debug log (всегда виден) === */}
      <div
        style={{
          marginTop: 20,
          padding: 10,
          background: "#111",
          color: "#0f0",
          fontSize: 12,
          whiteSpace: "pre-wrap",
          borderRadius: 8,
        }}
      >
        <strong>Debug log:</strong>
        {"\n"}
        {debug.join("\n")}
      </div>
    </div>
  );
}

export default App;
