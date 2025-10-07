import requests
import csv
from datetime import datetime, timedelta

FILENAME = 'data.csv'

def fetch_btc_price_closed(date_str):
    """
    Получает цену закрытия BTC на указанную дату (по UTC),
    используя CoinGecko /coins/bitcoin/history.
    ⚠️ CoinGecko возвращает цену на начало дня UTC, 
       поэтому нужно вызывать для (дата + 1 день), чтобы получить close предыдущего дня.
    :param date_str: 'YYYY-MM-DD'
    :return: float | None
    """
    date_for_api = datetime.strptime(date_str, "%Y-%m-%d").strftime("%d-%m-%Y")
    url = f"https://api.coingecko.com/api/v3/coins/bitcoin/history?date={date_for_api}"

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        return data['market_data']['current_price']['usd']
    except (requests.RequestException, KeyError):
        print(f"⚠️ Не удалось получить данные CoinGecko за {date_str}")
        return None


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

    # Берём вчерашнюю дату по UTC — в эту строку будем записывать close
    target_date = (datetime.utcnow().date() - timedelta(days=1)).strftime('%Y-%m-%d')

    # CoinGecko возвращает цену на начало дня, поэтому запрашиваем день +1 (т.е. сегодняшний)
    api_date = datetime.utcnow().date().strftime('%Y-%m-%d')
    btc_close = fetch_btc_price_closed(api_date)

    if btc_close is None:
        print(f"❌ Не удалось получить цену закрытия за {target_date}")
        return

    # Находим строку с нужной датой
    i = next((i for i, row in enumerate(data) if row[idx_date] == target_date), None)
    if i is None:
        print(f"❌ Дата {target_date} не найдена в {FILENAME}")
        return

    # Обновляем цену
    data[i][idx_btc] = f"{btc_close:.2f}"

    # Считаем 30-дневное скользящее среднее
    prices = [float(r[idx_btc]) for r in data[i-30:i] if r[idx_btc]]
    if len(prices) == 30:
        ma = sum(prices) / 30
        data[i][idx_ma] = f"{ma:.2f}"
    else:
        data[i][idx_ma] = ""

    save_csv(data)
    print(f"✅ {target_date} обновлено: BTC={btc_close:.2f}, MA={data[i][idx_ma]}")


if __name__ == '__main__':
    update_csv()
