import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';
import dayjs from 'dayjs';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const RAW_URL = 'https://raw.githubusercontent.com/kaikasekai/kaikasekai/main/data.csv';
const COLORS = ['#ffff00','#00ff00','#00ffff','#0080ff','#8000ff','#ff00ff','#ff0080'];

function App() {
  const [data, setData] = useState([]);
  const [mae, setMae] = useState(null);
  const [mape, setMape] = useState('');

  useEffect(() => {
    axios.get(RAW_URL).then(r => {
      Papa.parse(r.data, {
        header: true,
        dynamicTyping: true,
        complete: (res) => {
          const cleaned = res.data.filter(row => row.date && !Object.values(row).every(v => v === null || v === ''));
          const rows = cleaned.filter((_, i) => i >= 30);
          setData(rows);

          const valid = rows
            .slice(-30)
            .filter(r =>
              typeof r.predict === 'number' &&
              typeof r.BTC === 'number' &&
              !isNaN(r.predict) &&
              !isNaN(r.BTC) &&
              r.BTC !== 0
            );

          const maeSum = valid.reduce((s, r) => s + Math.abs(r.predict - r.BTC), 0);
          setMae(valid.length ? (maeSum / valid.length).toFixed(2) : 'N/A');

          const mapeSum = valid.reduce((s, r) => s + Math.abs((r.predict - r.BTC) / r.BTC), 0);
          setMape(valid.length ? ((mapeSum / valid.length) * 100).toFixed(2) : 'N/A');
        }
      });
    });
  }, []);

  if (!data.length) return <div>Loading...</div>;

  return (
    <div style={{ padding: 20, background: '#1f1f2e', minHeight: '100vh', color: '#fff' }}>
      <h2>BTC Forecast Chart</h2>

      <ResponsiveContainer width="100%" height={500}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={(d) => dayjs(d).format('MMM D')}
            minTickGap={10}
          />
          <YAxis domain={['auto','auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#333', borderColor: '#555', color: '#fff' }}
            labelStyle={{ color: '#ccc' }}
            itemStyle={{ color: '#fff' }}
          />
          <Legend />
          <Line type="monotone" dataKey="BTC" stroke="#f7931a" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="moving_average" stroke="#00c69e" strokeWidth={2} dot={false} strokeDasharray="5 5" />
          <Line type="monotone" dataKey="predict" stroke="#0000ff" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="prp_1" stroke="#6666ff" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="prp_2" stroke="#9999ff" strokeWidth={2} dot={false} />
          {Object.keys(data[0]).filter(k => k.startsWith('p_')).map((key, idx) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={1}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 10 }}>
        <strong>Среднее отклонение (MAE):</strong> {mae} USD<br />
        <strong>Средняя процентная ошибка (MAPE):</strong> {mape}%
      </div>

      <Accordion style={{ marginTop: 20 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>О проекте</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            Этот проект отображает прогнозы курса BTC на основе нескольких моделей.
            Данные обновляются ежедневно и визуализируются вместе с фактическим курсом.
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion style={{ marginTop: 10 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Как это работает</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            – Прогнозы берутся из CSV-файла на GitHub.<br />
            – Ежедневно добавляется курс BTC с сайта CoinGecko.<br />
            – Рассчитываются MAE и MAPE по последним 30 дням.<br />
            – Отображаются линии: фактический BTC, прогнозы, moving average.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </div>
  );
}

export default App;
