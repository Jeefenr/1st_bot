import { Bot } from "grammy";

// Отримуємо токен
const bot = new Bot(process.env.BOT_TOKEN || "");

// Команда /start
bot.command("start", (ctx) => {
  ctx.reply("Привіт! Я твій новий бот. Я працюю! 🚀\nНапиши /help щоб побачити мої команди.");
});

// Команда /help (вимога з пункту 3)
bot.command("help", (ctx) => {
  ctx.reply("Мої команди:\n/start - Перезапустити\n/help - Довідка\n/about - Про мене");
});

// ТВОЯ ВЛАСНА КОМАНДА (пункт 4)
bot.command("about", (ctx) => {
  ctx.reply("Я крутий бот Олександра, створений для домашнього завдання! 👨‍💻");
});

// Обробка тексту та реакція на "привіт" (пункти 3 та 5)
bot.on("message:text", (ctx) => {
  const originalText = ctx.message.text;
  const lowerText = originalText.toLowerCase(); // Робимо текст маленькими літерами для перевірки
  
  // Реакція на слова "привіт" або "hello" (пункт 5)
  if (lowerText === "привіт" || lowerText === "hello") {
    ctx.reply("Привіт-привіт! Дуже радий тебе бачити 👋");
    return; // Зупиняємо виконання, щоб не відправляти ще й стандартну відповідь
  }

  // Ехо-відповідь на будь-який інший текст (пункт 3)
  ctx.reply(`Я отримав твоє повідомлення: "${originalText}"`);
});

console.log("🤖 Бот запускається...");
bot.start();