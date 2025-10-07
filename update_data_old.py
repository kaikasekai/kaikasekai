import requests
import csv
from datetime import datetime, timedelta

FILENAME = 'data.csv'

def fetch_btc_price():
    url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    return requests.get(url).json()['bitcoin']['usd']

def load_csv():
    with open(FILENAME, newline='') as f:
        return list(csv.reader(f))

def save_csv(data):
    with open(FILENAME, 'w', newline='') as f:
        csv.writer(f).writerows(data)

def update_csv():
    data = load_csv()
    header = data[0]
    idx_date = header.index('date')
    idx_btc = header.index('BTC')
    idx_ma = header.index('moving_average')

    # фикс: записываем цену за вчерашний день (чтобы закрытие попало правильно)
    today = (datetime.utcnow().date() - timedelta(days=1)).strftime('%Y-%m-%d')
    btc_price = fetch_btc_price()

    i = next((i for i, row in enumerate(data) if row[idx_date] == today), None)
    if i is None:
        print("❌ today not found in data.csv")
        return

    data[i][idx_btc] = f"{btc_price:.2f}"
    prices = [float(r[idx_btc]) for r in data[i-30:i] if r[idx_btc]]
    if len(prices) == 30:
        ma = sum(prices) / 30
        data[i][idx_ma] = f"{ma:.2f}"

    save_csv(data)
    print(f"✅ {today} updated: BTC={btc_price:.2f}, MA={data[i][idx_ma]}")

if __name__ == '__main__':
    update_csv()
