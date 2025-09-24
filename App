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
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
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

    setPrice(Number(await cont.price()));
    setWhitelistPrice(Number(await cont.whitelistPrice()));

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

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const wlPrice = await contract.whitelistPrice(); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS); // BigInt

    if (allowance < wlPrice) {
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, wlPrice);
      await approveTx.wait();
      alert("✅ Approve submitted. Confirm buy whitelist in your wallet."); 
    }

    const tx = await contract.connect(signer).buyWhitelist();
    await tx.wait();
    //alert("✅ BuyWhitelist tx submitted.");

    alert("✅ You are now whitelisted!");
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Whitelist purchase failed, see Debug log");
  }
};

  // === Subscribe ===
const handleSubscribe = async () => {
  if (!contract || !provider) return alert("Connect wallet first!");
  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const priceToPay = await contract.price(); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS); // BigInt

    if (allowance < priceToPay) {
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, priceToPay);
      await approveTx.wait();
      alert("✅ Approve submitted. Confirm subscription in your wallet.");
    }

    const bal = await usdc.balanceOf(account);
    if (bal < priceToPay) return alert("Insufficient USDC balance");

    let refAddr = ZeroAddress;
    if (referrer && referrer.trim() !== "") {
      try {
        const candidate = getAddress(referrer.trim());
        if (candidate.toLowerCase() !== account.toLowerCase()) refAddr = candidate;
      } catch {
        return alert("Invalid referrer address");
      }
    }

    const tx = await contract.connect(signer).subscribe(refAddr);
    await tx.wait();
    //alert("✅ Subscribe tx submitted.");

    await checkSubscription(contract, account);
    alert("✅ Subscription successful!");
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Subscription failed, see Debug log");
  }
};

  // === Donate ===
const handleDonate = async () => {
  if (!contract || !provider) return alert("Connect wallet first!");
  if (!donateAmount) return alert("Enter amount");

  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);

    const amount = parseUnits(donateAmount, 6); // BigInt
    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS); // BigInt

    // Проверка allowance
    if (allowance < amount) {
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, amount);
      await approveTx.wait(); // ждём завершения approve
      alert("✅ Approve submitted. Confirm donation in your wallet.");
    }

    // Сама транзакция donate
    const tx = await contract.connect(signer).donate(amount);
    await tx.wait();
    //alert("✅ Donation tx submitted.");

    alert("✅ Donation sent to contract!");
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Donation failed, see Debug log");
  }
};

// === FeedBack ===
const handlePayFeedback = async () => {
  if (!contract || !provider) return alert("Connect wallet first!");
  try {
    const signer = await provider.getSigner();
    const usdc = new Contract(USDC_ADDRESS, USDC_ABI, signer);
    const price = await contract.feedbackPrice();

    const allowance = await usdc.allowance(account, CONTRACT_ADDRESS);
    if (allowance < price) {
      const approveTx = await usdc.approve(CONTRACT_ADDRESS, price);
      await approveTx.wait();
    }

    const tx = await contract.connect(signer).payFeedback();
    await tx.wait();

    setShowFeedbackForm(true); // показать форму после успешной оплаты
  } catch (e) {
    log("❌ ERROR: " + (e?.reason || e?.message || JSON.stringify(e)));
    alert("❌ Payment for feedback failed");
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
  Contact us ({contract ? (await contract.feedbackPrice() / 1e6) : "1"} USDC)
</Button>

{showFeedbackForm && (
  <div style={{ marginTop: 20, border: "1px solid #ccc", padding: 10, borderRadius: 8 }}>
    <h4>Обратная связь</h4>
    <TextField
      label="Ваш email"
      value={feedbackEmail}
      onChange={(e) => setFeedbackEmail(e.target.value)}
      fullWidth
      margin="dense"
    />
    <TextField
      label="Сообщение"
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
      Отправить
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
