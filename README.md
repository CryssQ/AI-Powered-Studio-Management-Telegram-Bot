# Echo Design AI Concierge Bot 🎨🏗️

An intelligent Telegram bot designed for design studios and web agencies to automate client consultations, order management, and status tracking. Powered by Groq AI (Llama 3.3) for natural language processing and featuring a full-stack dashboard for administrative control.

## 🚀 Features

-   **AI Consulting**: Professional guidance on UX/UI design, branding, and web development using advanced LLMs via Groq SDK.
-   **Smart Order Creation**: AI-driven order intake that collects customer info and proactively suggests improvements to project descriptions for better clarity.
-   **Relational Status Tracking**: Clients can check their project status in real-time using their unique Order ID.
-   **Dual Notifications**: 
    -   **Manager**: Instant email alerts when new orders are placed.
    -   **Client**: Automatic email updates when a manager changes the project status in the dashboard.
-   **Admin Dashboard**: A clean, web-based interface (React + Tailwind) to manage orders, search through history, and update project stages.
-   **Data Persistence**: Reliable local storage using SQLite.

## 🛠️ Tech Stack

-   **Backend**: Node.js, Express, TypeScript
-   **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
-   **AI Engine**: Groq SDK (model: `llama-3.3-70b-versatile`)
-   **Database**: SQLite (`better-sqlite3`)
-   **Bot API**: `node-telegram-bot-api`
-   **Email**: Nodemailer (SMTP)

## ⚙️ Installation & Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/CryssQ/AI-Powered-Studio-Management-Telegram-Bot.git
    cd AI-Powered-Studio-Management-Telegram-Bot
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and add the following keys:
    ```env
    TELEGRAM_BOT_TOKEN=your_telegram_bot_token
    GROQ_API_KEY=your_groq_api_key
    EMAIL_USER=your_email@gmail.com
    EMAIL_PASS=your_app_specific_password
    EMAIL_RECEIVER=manager_email@example.com
    ```

4.  **Run the application**:
    ```bash
    npm run dev
    ```

## 📝 Usage

1.  **Telegram Bot**: Customers interact with the bot to ask about prices, services, or place orders.
2.  **Dashboard**: Managers visit the web interface (running on port 3000) to view the orders table and update statuses from "New" to "In Progress" or "Completed".

## 🛡️ License

This project is open-source and available under the [MIT License](LICENSE).
