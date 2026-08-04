import csv
import time
from datetime import datetime, timedelta, timezone

import requests

FILENAME = "data.csv"

URL = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range"

HEADERS = {
    "User-Agent": "btc-updater"
}


def fetch_close():

    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)

    start = datetime.combine(
        yesterday,
        datetime.min.time(),
        tzinfo=timezone.utc
    )

    end = start + timedelta(days=1)

    params = {
        "vs_currency": "usd",
        "from": int(start.timestamp()),
        "to": int(end.timestamp())
    }

    for attempt in range(5):

        try:

            r = requests.get(
                URL,
                params=params,
                headers=HEADERS,
                timeout=20
            )

            if r.status_code == 429:
                time.sleep(10)
                continue

            r.raise_for_status()

            prices = r.json()["prices"]

            if not prices:
                raise RuntimeError("No prices")

            return float(prices[-1][1])

        except Exception as e:

            print(f"Attempt {attempt+1}: {e}")

            time.sleep(5)

    raise RuntimeError("CoinGecko unavailable")


def load_csv():
    with open(FILENAME, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))


def save_csv(rows):
    with open(FILENAME, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)


def update():

    rows = load_csv()

    header = rows[0]

    date_col = header.index("date")
    btc_col = header.index("BTC")
    ma_col = header.index("moving_average")

    target = (
        datetime.now(timezone.utc).date()
        - timedelta(days=1)
    ).isoformat()

    close = fetch_close()

    idx = None

    for i in range(1, len(rows)):
        if rows[i][date_col] == target:
            idx = i
            break

    if idx is None:
        raise RuntimeError(f"{target} not found")

    rows[idx][btc_col] = f"{close:.2f}"

    prices = []

    for row in rows[max(1, idx - 30):idx]:
        try:
            prices.append(float(row[btc_col]))
        except ValueError:
            pass

    if len(prices) == 30:
        rows[idx][ma_col] = f"{sum(prices)/30:.2f}"
    else:
        rows[idx][ma_col] = ""

    save_csv(rows)

    print(f"{target} -> {close:.2f}")


if __name__ == "__main__":
    update()
