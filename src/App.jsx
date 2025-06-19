import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import dayjs from 'dayjs';

const RAW_URL = 'https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/data.csv';
const COLORS = ['#ffff00', '#00ff00', '#00ffff', '#0080ff', '#8000ff', '#ff00ff', '#ff0080'];

function App() {
  const [data, setData] = useState([]);
  const [mae, setMae] = useState(null);
  const [mape, setMape] = useState('');

  useEffect(() => {
    axios.get(RAW_URL).then(r => {
      Papa.parse(r.data, {
        header: true,
        dynamicTyping: false, // <- специально отключаем авто-типизацию
        complete: (res) => {
          const parsed = res.data.map(row => {
            // Преобразуем нужные поля вручную
            const numericFields = [
              'BTC', 'moving_average', 'predict', 'prp_1', 'prp_2',
              ...Object.keys(row).filter(k => k.startsWith('p_'))
            ];
            const cleaned = { ...row };
            numericFields.forEach(field => {
              if (row[field] !== undefined) {
                const val = Number(row[field]);
                cleaned[field] = isNaN(val) ? null : val;
              }
            });
            return cleaned;
          });

          const rows = parsed.filter((_, i) => i >= 30);
          setData(rows);

          const last30 = rows.slice(-30);
          const valid = last30.filter(r =>
            typeof r.BTC === 'number' &&
            typeof r.predict === 'number' &&
            !isNaN(r.BTC) &&
            !isNaN(r.predict) &&
            r.BTC !== 0
          );

          const maeSum = valid.reduce((sum, r) => sum + Math.abs(r.predict - r.BTC), 0);
          const mapeSum = valid.reduce((sum, r) => sum + Math.abs((r.predict - r.BTC) / r.BTC), 0);

          setMae(valid.length ? (maeSum / valid.length).toFixed(2) : 'N/A');
          setMape(valid.length ? ((mapeSum / valid.length) * 100).toFixed(2) : 'N/A');
        }
      });
    });
  }, []);

  if (!data.length) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>BTC Forecast Chart</h2>
      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => dayjs(d).format('MMM D')}
            minTickGap={10}
          />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="BTC" stroke="#f7931a" dot={false} />
          <Line type="monotone" dataKey="moving_average" stroke="#00c69e" dot={false} strokeDasharray="5 5" />
          <Line type="monotone" dataKey="predict" stroke="#0000ff" dot={false} />
          <Line type="monotone" dataKey="prp_1" stroke="#6666ff" dot={false} />
          <Line type="monotone" dataKey="prp_2" stroke="#9999ff" dot={false} />
          {Object.keys(data[0])
            .filter(k => k.startsWith('p_'))
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
        <strong>Среднее отклонение (MAE):</strong> {mae} USD<br />
        <strong>Средняя процентная ошибка (MAPE):</strong> {mape}%
      </div>
    </div>
  );
}

export default App;
