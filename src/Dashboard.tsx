import React, { useEffect, useState } from 'react';
import { Bot, MessageSquare, Package, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { motion } from 'motion/react';

export default function Dashboard() {
    const [stats, setStats] = useState<{ status: string, orders: number } | null>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAll, setShowAll] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const healthRes = await fetch('/api/health');
                const healthData = await healthRes.json();
                setStats(healthData);

                const ordersRes = await fetch(`/api/orders?all=${showAll}`);
                const ordersData = await ordersRes.json();
                setOrders(ordersData);
                
                setLoading(false);
            } catch (err) {
                console.error(err);
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [showAll]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12">
            <div className="max-w-4xl mx-auto">
                <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <motion.h1 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400"
                        >
                            Echo Design Bot
                        </motion.h1>
                        <p className="text-slate-400 mt-2 text-lg">Панель керування замовленнями та статусом бота</p>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <div className={`w-3 h-3 rounded-full animate-pulse ${stats?.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="font-medium">{stats?.status === 'ok' ? 'Бот працює' : 'Бот офлайн'}</span>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <StatusCard 
                        title="Всього замовлень" 
                        value={loading ? '...' : (stats?.orders || 0)} 
                        icon={<Package className="text-blue-400" />} 
                        delay={0.1}
                    />
                    <StatusCard 
                        title="ШІ Модель" 
                        value="Gemini 3 Flash" 
                        icon={<Bot className="text-purple-400" />} 
                        delay={0.2}
                    />
                    <StatusCard 
                        title="Сповіщення" 
                        value="Email" 
                        icon={<Mail className="text-emerald-400" />} 
                        delay={0.3}
                    />
                </div>

                <div className="mb-6">
                    <input 
                        type="text"
                        placeholder="Пошук замовлень (ім'я, контакт, деталі)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 text-slate-100 outline-none focus:border-blue-500 transition-colors"
                    />
                </div>

                {orders.length > 0 && (
                    <div className="mb-12 bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold">{showAll ? 'Повна історія замовлень' : 'Останні замовлення'}</h2>
                            <button 
                                onClick={() => setShowAll(!showAll)}
                                className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-4 py-2 rounded-xl transition-colors font-bold uppercase tracking-wider"
                            >
                                {showAll ? 'Показати останні 10' : 'Завантажити всю історію'}
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-tighter">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Клієнт</th>
                                        <th className="px-6 py-4">Послуга</th>
                                        <th className="px-6 py-4">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {orders
                                        .filter(order => 
                                            order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            order.customer_contact?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            order.order_details?.toLowerCase().includes(searchTerm.toLowerCase())
                                        )
                                        .map((order) => (
                                        <tr key={order.id} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4 font-mono text-blue-400">#{order.id}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium">{order.customer_name}</div>
                                                <div className="text-xs text-slate-500">{order.customer_contact}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-300 truncate max-w-[200px]">{order.order_details}</td>
                                            <td className="px-6 py-4">
                                                <select 
                                                    value={order.status}
                                                    onChange={async (e) => {
                                                        const newStatus = e.target.value;
                                                        try {
                                                            await fetch(`/api/orders/${order.id}`, {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ status: newStatus })
                                                            });
                                                            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
                                                        } catch (err) {
                                                            console.error("Update failed", err);
                                                        }
                                                    }}
                                                    className="bg-slate-800 text-xs border border-slate-700 rounded-lg px-2 py-1 text-slate-200 outline-none focus:border-blue-500"
                                                >
                                                    <option value="Нове">Нове</option>
                                                    <option value="В роботі">В роботі</option>
                                                    <option value="Виконано">Виконано</option>
                                                    <option value="Скасовано">Скасовано</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 mb-12">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <AlertCircle className="text-blue-400" />
                        Як налаштувати бота
                    </h2>
                    <ul className="space-y-4 text-slate-300">
                        <li className="flex gap-4">
                            <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-blue-400 font-bold">1</span>
                            <div>
                                <p className="font-semibold text-slate-100">Створіть бота в Telegram</p>
                                <p>Напишіть @BotFather, отримайте токен та додайте його в налаштування Secrets як <code className="text-emerald-400">TELEGRAM_BOT_TOKEN</code>.</p>
                            </div>
                        </li>
                        <li className="flex gap-4">
                            <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-blue-400 font-bold">2</span>
                            <div>
                                <p className="font-semibold text-slate-100">Налаштуйте Email</p>
                                <p>Додайте <code className="text-emerald-400">EMAIL_USER</code> та <code className="text-emerald-400">EMAIL_PASS</code> (пароль додатку), щоб отримувати повідомлення про нові замовлення.</p>
                            </div>
                        </li>
                        <li className="flex gap-4">
                            <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center shrink-0 text-blue-400 font-bold">3</span>
                            <div>
                                <p className="font-semibold text-slate-100">Gemini API</p>
                                <p>Бот автоматично використовує <code className="text-emerald-400">GEMINI_API_KEY</code> для консультацій та обробки замовлень через Function Calling.</p>
                            </div>
                        </li>
                    </ul>
                </div>

                <footer className="text-center text-slate-500 text-sm">
                    © 2026 Echo Design. Зроблено з любов'ю до деталей.
                </footer>
            </div>
        </div>
    );
}

function StatusCard({ title, value, icon, delay }: { title: string, value: string | number, icon: React.ReactNode, delay: number }) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-colors"
        >
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm uppercase tracking-wider font-semibold">{title}</span>
                {icon}
            </div>
            <div className="text-3xl font-bold text-slate-100">{value}</div>
        </motion.div>
    );
}
