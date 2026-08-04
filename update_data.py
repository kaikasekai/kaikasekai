import csv
from datetime import datetime, timedelta, timezone

import yfinance as yf

FILENAME = "data.csv"


def fetch_previous_day_close():
    """
    Возвращает цену закрытия предыдущего завершённого дня UTC.
    """

    df = yf.download(
        "BTC-USD",
        period="5d",
        interval="1d",
        auto_adjust=False,
        progress=False,
    )

    if len(df) < 2:
        raise RuntimeError("Недостаточно данных Yahoo Finance.")

    yesterday = (
        datetime.now(timezone.utc).date() - timedelta(days=1)
    )

    df.index = df.index.tz_localize(None)

    for index, row in df.iterrows():
        if index.date() == yesterday:
            return float(row["Close"])

    raise RuntimeError(f"Свеча за {yesterday} не найдена.")


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

    for row in rows[max(1, row_index - 30):row_index]:
        try:
            prices.append(float(row[btc_idx]))
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
