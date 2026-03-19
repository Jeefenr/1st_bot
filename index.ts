import { Bot } from "grammy";


const bot = new Bot(process.env.BOT_TOKEN || "");


bot.command("start", (ctx) => {
  ctx.reply("Привіт! Я твій новий бот. Я працюю! \nНапиши /help щоб побачити мої команди.");
});


bot.command("help", (ctx) => {
  ctx.reply("Мої команди:\n/start - Перезапустити\n/help - Довідка\n/about - Про мене");
});


bot.command("about", (ctx) => {
  ctx.reply("Я крутий бот Олександра, створений для домашнього завдання! ");
});


bot.on("message:text", (ctx) => {
  const originalText = ctx.message.text;
  const lowerText = originalText.toLowerCase(); 
  
  
  if (lowerText === "привіт" || lowerText === "hello") {
    ctx.reply("Привіт-привіт! Дуже радий тебе бачити ");
    return; 
  }

  
  if (lowerText === "help" || lowerText === "допомога") {
    ctx.reply("Здається, ти шукаєш підказку! Використай команду /help (зі слешем), щоб побачити меню.");
    return;
  }

  
  const randomResponses = [
    "Ого, цікава думка!",
    "Я всього лише бот, але повністю з тобою згоден ",
    "Хмм, треба над цим подумати... Може, напишу про це статтю на сайт новин технологій ",
    "Головне, щоб передача цих даних була захищена на рівні протоколів! ",
    `Я отримав твоє повідомлення: "${originalText}"` 
  ];

 
  const randomIndex = Math.floor(Math.random() * randomResponses.length);
  ctx.reply(randomResponses[randomIndex]!);
});

console.log(" Бот запускається...");
bot.start();