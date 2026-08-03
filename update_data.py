import csv
from datetime import datetime, timedelta, timezone

import requests

FILENAME = "data.csv"

URL = "https://api.binance.com/api/v3/klines"


def fetch_previous_day_close():
    """
    Возвращает цену закрытия предыдущего завершённого дня UTC.
    """

    params = {
        "symbol": "BTCUSDT",
        "interval": "1d",
        "limit": 2
    }

    response = requests.get(URL, params=params, timeout=20)
    response.raise_for_status()

    candles = response.json()

    if len(candles) < 2:
        raise RuntimeError("Недостаточно данных от Binance.")

    # Последняя свеча может быть ещё не закрыта.
    last = candles[-1]

    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    close_time = last[6]

    if now_ms >= close_time:
        closed_candle = last
    else:
        closed_candle = candles[-2]

    return float(closed_candle[4])


def load_csv():
    with open(FILENAME, newline="", encoding="utf-8") as f:
        return list(csv.reader(f))


def save_csv(rows):
    with open(FILENAME, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)


def update_csv():

    rows = load_csv()

    header = rows[0]

    date_idx = header.index("date")
    btc_idx = header.index("BTC")
    ma_idx = header.index("moving_average")

    target_date = (
        datetime.now(timezone.utc).date()
        - timedelta(days=1)
    ).isoformat()

    btc_close = fetch_previous_day_close()

    row_index = None

    for i in range(1, len(rows)):
        if rows[i][date_idx] == target_date:
            row_index = i
            break

    if row_index is None:
        raise RuntimeError(f"Дата {target_date} не найдена.")

    rows[row_index][btc_idx] = f"{btc_close:.2f}"

    prices = []

    start = max(1, row_index - 30)

    for r in rows[start:row_index]:
        try:
            prices.append(float(r[btc_idx]))
        except ValueError:
            pass

    if len(prices) == 30:
        ma = sum(prices) / 30
        rows[row_index][ma_idx] = f"{ma:.2f}"
    else:
        rows[row_index][ma_idx] = ""

    save_csv(rows)

    print(f"Updated {target_date}: BTC={btc_close:.2f}")


if __name__ == "__main__":
    update_csv()
