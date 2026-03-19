import { Bot } from "grammy";


const bot = new Bot(process.env.BOT_TOKEN || "");


bot.command("start", (ctx) => {
  ctx.reply("Привіт! Я твій новий бот. Я працюю! 🚀\nНапиши /help щоб побачити мої команди.");
});


bot.command("help", (ctx) => {
  ctx.reply("Мої команди:\n/start - Перезапустити\n/help - Довідка\n/about - Про мене");
});


bot.command("about", (ctx) => {
  ctx.reply("Я крутий бот Олександра, створений для домашнього завдання! 👨‍💻");
});


bot.on("message:text", (ctx) => {
  const originalText = ctx.message.text;
  const lowerText = originalText.toLowerCase(); 
  

  if (lowerText === "привіт" || lowerText === "hello") {
    ctx.reply("Привіт-привіт! Дуже радий тебе бачити 👋");
    return; 
  }


  ctx.reply(`Я отримав твоє повідомлення: "${originalText}"`);
});

console.log("🤖 Бот запускається...");
bot.start();