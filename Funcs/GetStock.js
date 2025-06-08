const https = require("https");

const stockOptions = {
  hostname: "growagardenvalues.com",
  port: 443,
  method: "GET",
  headers: {
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
    "content-type": "application/json",
    "x-requested-with": "XMLHttpRequest",
  },
};

function fetchStockData(type) {
  return new Promise((resolve, reject) => {
    const options = { ...stockOptions, path: `/stock/refresh_stock.php?type=${type}` };

    const req = https.request(options, (res) => {
      const chunks = [];

      res.on("data", (chunk) => chunks.push(chunk));

      res.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        try {
          const parsedData = JSON.parse(body);
          resolve(parsedData);
        } catch (err) {
          reject({
            status: 500,
            message: `Invalid JSON response for ${type}: ${err.message}`,
          });
        }
      });
    });

    req.on("error", (e) => {
      reject({
        status: 502,
        message: `Problem with ${type} request: ${e.message}`,
      });
    });

    req.end();
  });
}

async function fetchAllStocks() {
  return Promise.all([
    fetchStockData("gears"),
    fetchStockData("seeds"),
    fetchStockData("eggs"),
    fetchStockData("event-shop-stock"),
    fetchStockData("cosmetics"),
  ]).then(([gears, seeds, eggs, eventShop, cosmetics]) => ({
    gears,
    seeds,
    eggs,
    eventShop,
    cosmetics,
  }));
}

function formatStockItems(records) {
  if (!Array.isArray(records)) return "No data";
  return records.map((item) => ` ${item.Data?.Name || "Unknown"}: ${item.Amount || 0}`).join("\n");
}

function formatAllStocks(data) {
  const phTime = new Date().toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    `📦 GrowAGarden Stocks (${phTime})\n\n` +
    `🔧 Gears:\n${formatStockItems(data.gears?.data?.records)}\n\n` +
    `🌱 Seeds:\n${formatStockItems(data.seeds?.data?.records)}\n\n` +
    `🥚 Eggs:\n${formatStockItems(data.eggs?.data?.records)}\n\n` +
    `🐝 Event Shop:\n${formatStockItems(data.eventShop?.data?.records)}\n\n` +
    `🎨 Cosmetics:\n${formatStockItems(data.cosmetics?.data?.records)}`
  );
}

module.exports.config = {
  name: "stock",
  version: "2.0.0",
  permission: 2,
  credits: "You",
  description: "Show GrowAGarden stock list (gears, seeds, etc)",
  prefix: true,
  premium: false,
  category: "general",
  usages: "-stock",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event }) {
  const { threadID, messageID } = event;

  try {
    const stockData = await fetchAllStocks();
    const message = formatAllStocks(stockData);

    api.sendMessage(message, threadID, (err, info) => {
      if (!err && info?.messageID) {
        // Auto delete the message after 40 seconds
        setTimeout(() => api.unsendMessage(info.messageID).catch(() => {}), 40000);
      }
    }, messageID);
  } catch (err) {
    api.sendMessage(`❌ Failed to fetch stock data.\nError: ${err.message || err}`, threadID, messageID);
  }
};
