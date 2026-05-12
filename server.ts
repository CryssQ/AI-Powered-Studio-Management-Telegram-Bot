import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import TelegramBot from "node-telegram-bot-api";
import { Groq } from "groq-sdk";
import nodemailer from "nodemailer";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database
const db = new Database("echo_design.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER,
    customer_name TEXT,
    customer_contact TEXT,
    order_details TEXT,
    status TEXT DEFAULT 'Нове',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Initialize Email Transporter (Lazy)
let transporter: any = null;
function getTransporter() {
  if (!transporter) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("Email credentials missing. Email notifications will be skipped.");
      return null;
    }
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: parseInt(process.env.EMAIL_PORT || "587"),
      secure: process.env.EMAIL_PORT === "465",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

async function sendStatusUpdateEmail(order: any) {
  const mailer = getTransporter();
  if (!mailer) return;

  // Extract email address clean
  const emailMatch = order.customer_contact.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const cleanEmail = emailMatch ? emailMatch[0].trim() : null;

  if (!cleanEmail) {
    console.log(`Skipping status email for order ${order.id}: no valid email found in contact field.`);
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: cleanEmail,
    subject: `Ехо Дизайн: Оновлення статусу замовлення #${order.id}`,
    text: `
Вітаємо, ${order.customer_name}!

Ми раді повідомити, що статус вашого замовлення #${order.id} було оновлено.

📊 Новий статус: ${order.status}

📝 Деталі вашого замовлення:
${order.order_details}

Ви можете перевірити статус у нашому Telegram-боті за номером замовлення.

З повагою,
Команда Echo Design 🎨
    `,
  };

  try {
    await mailer.sendMail(mailOptions);
    console.log(`Status update email sent to ${cleanEmail} for order ${order.id}`);
  } catch (error) {
    console.error("Failed to send status update email:", error);
  }
}

async function sendOrderEmail(order: any) {
  const mailer = getTransporter();
  if (!mailer) return;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECEIVER || process.env.EMAIL_USER,
    subject: `🔥 Нове замовлення #${order.id} (Echo Design)`,
    text: `
Отримано нове замовлення!

🆔 ID: ${order.id}
👤 Клієнт: ${order.customer_name}
📞 Контакт: ${order.customer_contact}
📝 Деталі завдання:
${order.order_details}

📅 Дата створення: ${order.created_at}

Потрібно зв'язатися з клієнтом якнайшвидше!
    `,
  };

  try {
    await mailer.sendMail(mailOptions);
    console.log(`Email sent for order ${order.id}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

// Groq Tools Definitions
const tools: any[] = [
  {
    type: "function",
    function: {
      name: "create_order",
      description: "Створює нове замовлення на дизайн або верстку.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Ім'я клієнта" },
          customer_contact: { type: "string", description: "Контактні дані (телефон або email)" },
          order_details: { type: "string", description: "Опис того, що потрібно замовити (дизайн сайту, верстка тощо)" },
        },
        required: ["customer_name", "customer_contact", "order_details"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_order_status",
      description: "Отримує статус існуючого замовлення за його ID.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "integer", description: "Унікальний номер замовлення (ID)" },
        },
        required: ["order_id"],
      },
    },
  },
];

// Initialize Groq
let groqInstance: Groq | null = null;
function getGroq() {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.length < 10) return null;
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
}

const systemInstruction = `
Ти — розумний помічник компанії "Echo Design". Наша компанія займається дизайном та версткою на замовлення.
Твоє завдання:
1. Надавати консультації щодо послуг дизайну (UX/UI, логотипи, банери) та верстки (HTML/CSS, React, адаптивність).
2. Бути ввічливим, професійним та розмовляти ВИКЛЮЧНО українською мовою.

3. ПРАВИЛА ОФОРМЛЕННЯ ЗАМОВЛЕННЯ:
   - Ти маєш право викликати функцію 'create_order' ТІЛЬКИ тоді, коли знаєш: Ім'я клієнта, Контакт (email або телефон) та Детальний опис замовлення.
   - Якщо опис клієнта занадто короткий (наприклад, просто "маркетплейс"), ти МАЄШ запропонувати покращену версію. Розпиши, які функції (фільтри, кабінет, платіжні системи) варто додати.
   - ПИТАЙ КЛІЄНТА: "Я доповнив опис вашого проекту професійними деталями. Бажаєте залишити ваш варіант чи використати мій покращений?". 
   - НІКОЛИ не створюй замовлення з порожніми полями. Якщо клієнт не назвав ім'я, перепитай.

4. Якщо клієнт запитує про статус замовлення, ОБОВ'ЯЗКОВО викликай функцію 'get_order_status'.
5. Відповідай лаконічно, але інформативно.

Ціни:
- Дизайн лендінгу: від 5000 грн.
- Верстка лендінгу: від 3000 грн.
- Логотип: від 2000 грн.
- Маркетплейс/Складні проекти: від 15 000 грн.
- Терміни обговорюються індивідуально.

Коли всі дані підтверджені клієнтом (включно з фінальним описом), викликай 'create_order'.
`;

// Bot state
const userHistories = new Map<number, any[]>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Telegram Bot Setup
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN missing in .env");
  } else {
    const bot = new TelegramBot(token, { polling: true });

    const safeSendMessage = async (chatId: number, text: string, options: TelegramBot.SendMessageOptions = {}) => {
      try {
        return await bot.sendMessage(chatId, text, options);
      } catch (err: any) {
        if (err.message?.includes("can't parse entities")) {
          console.warn("Markdown parsing failed, sending as plain text.");
          const { parse_mode, ...otherOptions } = options;
          return await bot.sendMessage(chatId, text, otherOptions);
        }
        throw err;
      }
    };

    bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      safeSendMessage(chatId, "Привіт! Я помічник Echo Design. 🎨🏗️\n\nЯ можу проконсультувати тебе щодо дизайну чи верстки, або прийняти замовлення.\n\nЩо тебе цікавить?", {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: "🎨 Консультація з дизайну" }, { text: "💻 Питання про верстку" }],
            [{ text: "📝 Оформити замовлення" }, { text: "🔍 Статус замовлення" }]
          ],
          resize_keyboard: true
        }
      });
    });

    bot.on("message", async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      if (!text || text.startsWith("/")) return;

      // Static responses
      if (text === "🎨 Консультація з дизайну") {
        return safeSendMessage(chatId, "Ми робимо UX/UI дизайн для сайтів та додатків, логотипи та фірмовий стиль. Про що саме хочеш дізнатись?");
      }
      if (text === "💻 Питання про верстку") {
        return safeSendMessage(chatId, "Ми верстаємо сайти будь-якої складності: від простих лендінгів до складних React-додатків. Все адаптивно та чисто!");
      }
      if (text === "🔍 Статус замовлення") {
        return safeSendMessage(chatId, "Будь ласка, напиши мені свій ID замовлення (наприклад: 'Який статус замовлення 5?').");
      }
      if (text === "📝 Оформити замовлення") {
        return safeSendMessage(chatId, "Чудово! Напиши, будь ласка, що саме тобі потрібно, як тебе звати та як з тобою зв'язатися (телефон/email).");
      }

      // AI processing
      try {
        const groq = getGroq();
        if (!groq) {
          throw new Error("Groq API key is missing.");
        }

        // Maintain history (limited to last 10 messages for efficiency)
        let history = userHistories.get(chatId) || [];
        history.push({ role: "user", content: text });
        if (history.length > 10) history.shift();

        const messages: any[] = [
          { role: "system", content: systemInstruction },
          ...history
        ];

        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: messages,
          tools: tools,
          tool_choice: "auto",
        });

        const message = response.choices[0]?.message;
        
        if (message?.tool_calls) {
          // Add assistant message to history
          history.push(message);

          for (const toolCall of message.tool_calls) {
            const functionName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            let result = "";

            if (functionName === "create_order") {
              const { customer_name, customer_contact, order_details } = args;
              
              // Validate that fields are not empty or just whitespace
              if (!customer_name?.trim() || !customer_contact?.trim() || !order_details?.trim()) {
                result = "ERROR: Missing required fields. Please ask the user for name, contact, and details before creating an order.";
                await safeSendMessage(chatId, "⚠️ На жаль, не всі дані вказано. Будь ласка, вкажіть ім'я, контакт та опис замовлення для оформлення.");
              } else {
                const stmt = db.prepare("INSERT INTO orders (telegram_id, customer_name, customer_contact, order_details) VALUES (?, ?, ?, ?)");
                const info = stmt.run(chatId, customer_name.trim(), customer_contact.trim(), order_details.trim());
                const orderId = info.lastInsertRowid;
                
                const newOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
                await sendOrderEmail(newOrder);

                const date = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
                const summary = `
✅ **Замовлення створено успішно!**

🆔 **ID:** ${orderId}
👤 **Користувач:** ${customer_name.trim()}
📞 **Контакт:** ${customer_contact.trim()}
📝 **Деталі:** ${order_details.trim()}
📅 **Дата:** ${date}

*Наш менеджер зв'яжеться з вами найближчим часом для уточнення деталей. Дякуємо, що обрали Echo Design!* 🎨
                `.trim();
                result = `SUCCESS: Order created with ID ${orderId}`;
                await safeSendMessage(chatId, summary, { parse_mode: 'Markdown' });
              }
            } 
            else if (functionName === "get_order_status") {
              const { order_id } = args;
              const order: any = db.prepare("SELECT status FROM orders WHERE id = ?").get(order_id);
              const statusText = order ? order.status : "Замовлення не знайдено";
              result = `STATUS: ${statusText}`;
              
              const statusSummary = `
🔍 **Інформація про замовлення #${order_id}**

📊 **Поточний статус:** ${statusText}

*Якщо у вас виникли додаткові питання, просто напишіть мені!*
              `.trim();
              await safeSendMessage(chatId, statusSummary, { parse_mode: 'Markdown' });
            }

            // Push tool result back to history
            history.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: functionName,
              content: result
            });
          }
          userHistories.set(chatId, history);
        } else if (message?.content) {
          history.push({ role: "assistant", content: message.content });
          userHistories.set(chatId, history);
          await safeSendMessage(chatId, message.content, { parse_mode: 'Markdown' });
        }
      } catch (err: any) {
        console.error("Groq/Bot Error:", err);
        await safeSendMessage(chatId, "Вибачте, сталася помилка при обробці запиту.");
      }
    });

    console.log("Telegram Bot is running...");
  }

  // Express API
  app.get("/api/health", (req, res) => {
    const ordersCount = db.prepare("SELECT COUNT(*) as count FROM orders").get() as any;
    res.json({ status: "ok", orders: ordersCount.count });
  });

  app.get("/api/orders", (req, res) => {
    const limit = req.query.all === 'true' ? -1 : 10;
    const stmt = limit === -1 
      ? db.prepare("SELECT * FROM orders ORDER BY created_at DESC")
      : db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?");
    
    const orders = limit === -1 ? stmt.all() : stmt.all(limit);
    res.json(orders);
  });

  app.patch("/api/orders/:id", express.json(), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
      
      const updatedOrder = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
      if (updatedOrder) {
        await sendStatusUpdateEmail(updatedOrder);
      }
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
