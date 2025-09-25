import { useEffect, useState } from "react";
import Papa from "papaparse";
import axios from "axios";
import {
  BrowserProvider,
  Contract,
  ZeroAddress,
  getAddress,
  parseUnits,
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
const OWNER_ADDRESS = "0x31Ec7C6bba0b83f51731C704c5Cdf41d85FE68E8"; // owner address
const CONTRACT_ADDRESS = "0x651e2c5824985Cf1a551C249b1bfba2aBe34fB49";

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
  "event FeedbackPriceChanged(uint256 oldPrice, uint256 newPrice)"
];

// === USDC Config (Polygon Amoy) ===
const USDC_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
];

// === NFT Config ===
const NFT_ADDRESS = "0x0c11C503EDEa18e57a5Ce67a2D8eE421d61dB41d";
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

  useEffect(() => {
  if (nftContract) {
    loadProofs(); // без аргумента, потому что внутри уже используешь nftContract
  }
}, [nftContract]);

  // === Wallet connection ===
  const connectWallet = async () => {
    let prov;

    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x13882" }],
        });
      } catch (err) {
        if (err.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x13882",
                chainName: "Polygon Amoy",
                nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
                rpcUrls: ["https://rpc-amoy.polygon.technology"],
                blockExplorerUrls: ["https://www.oklink.com/amoy"],
              },
            ],
          });
        } else {
          alert("⚠️ Please switch to Amoy (80002) in your wallet");
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
      log("⏳ Approving USDC for whitelist...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, wlPrice);
      await approveTx.wait();
      alert("✅ Approve confirmed");
    }

    log("⏳ Buying whitelist...");
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

    const priceToPay = await contract.price(); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS); // BigInt

    if (allowance < priceToPay) {
      log("⏳ Approving USDC for subscription...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceToPay);
      await approveTx.wait();
      alert("✅ Approve confirmed");
    }

    const bal = await usdc.balanceOf(account);
    if (bal < priceToPay) {
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

    const amount = parseUnits(donateAmount, 6); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS); // BigInt

    if (allowance < amount) {
      log("⏳ Approving USDC for donation...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, amount);
      await approveTx.wait();
      alert("✅ Approve confirmed");
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

    const price = await contract.feedbackPrice(); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS);

    if (allowance < price) {
      log("⏳ Approving USDC for feedback...");
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, price);
      await approveTx.wait();
      alert("✅ Approve confirmed");
    }

    log("⏳ Paying for feedback...");
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

    alert("✅ Message has been send!");
    setFeedbackEmail("");
    setFeedbackMessage("");
    setShowFeedbackForm(false);
  } catch (e) {
    alert("❌ Error, message hasn't send");
    console.error(e);
  }
};

  // === Proofs as NFT ===
  // === Proofs as NFT ===
const loadProofs = async () => {
  if (!nftContract || !provider) return;

  try {
    const total = Number(await nftContract.totalSupply());
    const items = [];

    for (let i = 1; i <= total; i++) {
      let uri = await nftContract.tokenURI(i);
      if (uri.startsWith("ipfs://")) uri = "https://ipfs.io/ipfs/" + uri.slice(7);

      const res = await fetch(uri);
      const metadata = await res.json();

      let imgUrl = metadata.image;
      if (imgUrl.startsWith("ipfs://")) imgUrl = "https://ipfs.io/ipfs/" + imgUrl.slice(7);

      // ✅ Новый способ искать Transfer в ethers v6
      const transferEvent = nftContract.interface.getEvent("Transfer");
      const topic = nftContract.interface.getEventTopic(transferEvent);

      const logs = await provider.getLogs({
        address: nftContract.target,
        fromBlock: 0,
        toBlock: "latest",
        topics: [
          topic,
          "0x" + "0".repeat(64), // ZeroAddress (from)
          null,                  // any "to"
          "0x" + i.toString(16).padStart(64, "0"), // tokenId
        ],
      });

      const mintTxHash = logs.length ? logs[0].transactionHash : null;

      items.push({
        id: i,
        name: metadata.name,
        description: metadata.description,
        image: imgUrl,
        mintTxHash,
      });
    }

    setProofs(items);
  } catch (e) {
    log("❌ Error loading Proofs: " + (e.message || e));
  }
};

  if (!data.length) return <div>Loading...</div>;

  const today = new Date();
  const firstDayOfMonth = dayjs(today).startOf("month");
  const nextMonth = dayjs(today).add(1, "month").endOf("month");

  const filteredData = data.filter((r) => {
    const d = dayjs(r.date);
    if (showTwoMonths) return d.isAfter(firstDayOfMonth) && d.isBefore(nextMonth);
    return d.isAfter(firstDayOfMonth) && d.isBefore(dayjs(today));
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
    Buy Whitelist ({whitelistPrice ? (whitelistPrice / 1e6).toFixed(0) : "..." } USDC)
  </Button>
)}


<Button
  variant="contained"
  color="info"
  onClick={handlePayFeedback}
  style={{ marginTop: 10 }}
>
  Contact us ({feedbackPrice ? (feedbackPrice / 1e6).toFixed(0) : "..."} USDC)
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
        <ResponsiveContainer width="100%" height={500}>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => dayjs(d).format("MMM D")}
            />
            <YAxis domain={[100000, 160000]} />
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
      <Accordion style={{ marginTop: 20 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>About</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            The project predicts BTC values with an ensemble of AI models.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion style={{ marginTop: 10 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>How it works</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Shows BTC, moving average, predictions, and error metrics (MAE/MAPE).
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion style={{ marginTop: 10 }}>
  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
    <Typography>Proofs</Typography>
  </AccordionSummary>
  <AccordionDetails>
    {proofs.length === 0 ? (
      <Typography>No proofs yet.</Typography>
    ) : (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {proofs.map((nft) => (
          <div
  key={nft.id}
  style={{
    width: 200,
    border: "1px solid #444",
    borderRadius: 8,
    padding: 10,
    background: "#222",
  }}
>
  <img
    src={nft.image}
    alt={nft.name}
    style={{ width: "100%", borderRadius: 6 }}
  />
  <h4 style={{ margin: "10px 0 5px" }}>{nft.name}</h4>
  <p style={{ fontSize: 12, color: "#aaa" }}>{nft.description}</p>

  {nft.mintTxHash && (
    <a
      href={`https://amoy.polygonscan.com/tx/${nft.mintTxHash}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontSize: 12, color: "#0af", display: "block", marginTop: 5 }}
    >
      🔍 View on Polygonscan
    </a>
  )}
</div>
        ))}
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
