import { Bot, session, Context, SessionFlavor, Keyboard } from "grammy";
import { Database } from "bun:sqlite";

// ==========================================
// ІНІЦІАЛІЗАЦІЯ БАЗИ ДАНИХ
// ==========================================
const db = new Database("bot.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY, age INTEGER, weight INTEGER,
    height INTEGER, sex TEXT, activity_level REAL, bmr REAL, tdee REAL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS meals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
    raw_text TEXT, calories_estimated INTEGER, timestamp TEXT
  );
`);

// ==========================================
// НАЛАШТУВАННЯ БОТА ТА СЕСІЙ
// ==========================================
interface SessionData {
  // Додали крок "waiting_delete_id"
  step: "idle" | "waiting_age" | "waiting_height" | "waiting_weight" | "waiting_sex" | "waiting_activity" | "waiting_meal_name" | "waiting_meal_calories" | "waiting_delete_id";
  age?: number;
  height?: number;
  weight?: number;
  sex?: "male" | "female";
  activity?: number;
  tempMealName?: string;
}

type MyContext = Context & SessionFlavor<SessionData>;
const bot = new Bot<MyContext>(process.env.BOT_TOKEN || "");
bot.use(session({ initial: (): SessionData => ({ step: "idle" }) }));

function calculateBMR(weight: number, height: number, age: number, sex: string): number {
  return sex === "male" ? 10 * weight + 6.25 * height - 5 * age + 5 : 10 * weight + 6.25 * height - 5 * age - 161;
}

function calculateTDEE(bmr: number, activity: number): number {
  return bmr * activity;
}

// ==========================================
// БАЗОВІ КОМАНДИ
// ==========================================
bot.command("start", (ctx) => {
  ctx.session.step = "idle";
  ctx.reply("Привіт! Я бот-дієтолог 🍏 з ідеальною пам'яттю.\n\nКоманди:\n/set_profile - Налаштувати профіль\n/my_profile - Мої дані\n/add_meal - Записати їжу\n/today - Що я сьогодні їв\n/delete_meal - Видалити запис");
});

bot.command("set_profile", (ctx) => {
  ctx.session.step = "waiting_age";
  ctx.reply("Давай налаштуємо твій профіль! 📝\nКрок 1: Введи свій вік:", { reply_markup: { remove_keyboard: true } });
});

bot.command("add_meal", (ctx) => {
  ctx.session.step = "waiting_meal_name";
  ctx.reply("Що ви їли? 🍽️ (напишіть текстом, наприклад: 2 яйця і тост)", { reply_markup: { remove_keyboard: true } });
});

// НОВА КОМАНДА: ВИДАЛЕННЯ ЇЖІ
bot.command("delete_meal", (ctx) => {
  ctx.session.step = "waiting_delete_id";
  ctx.reply("Введи ID прийому їжі, який хочеш видалити 🗑️\n(Свій ID можна знайти в списку /today):", { reply_markup: { remove_keyboard: true } });
});

bot.command("today", (ctx) => {
  const userId = ctx.from?.id;
  const todayPrefix = new Date().toISOString().split('T')[0]; 
  
  // Тепер ми витягуємо ще й `id` з бази даних
  const getMeals = db.query("SELECT id, raw_text, calories_estimated, timestamp FROM meals WHERE user_id = ? AND timestamp LIKE ?");
  const meals = getMeals.all(userId, `${todayPrefix}%`) as any[];

  if (meals.length === 0) {
    ctx.reply("Сьогодні ще немає записаних прийомів їжі 🤷‍♂️");
    return;
  }

  let response = "📅 **Сьогодні ви зʼїли:**\n\n";
  let totalCal = 0;

  meals.forEach((meal, index) => {
    const time = new Date(meal.timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
    // Додаємо відображення ID у список
    response += `${index + 1}. [${time}] 🍲 ${meal.raw_text} (${meal.calories_estimated} kcal) — ID: ${meal.id}\n`;
    totalCal += meal.calories_estimated;
  });

  response += `\n**Всього:** ${totalCal} kcal 🔥\n\n💡 Помилилися? Напишіть /delete_meal`;
  ctx.reply(response);
});

bot.command("my_profile", (ctx) => {
  const userId = ctx.from?.id;
  const getUser = db.query("SELECT * FROM users WHERE telegram_id = ?");
  const user = getUser.get(userId) as any;

  if (!user) {
    ctx.reply("Твій профіль ще не знайдено в базі! Напиши /set_profile");
    return;
  }

  ctx.reply(
    `📊 **Твій збережений профіль:**\n` +
    `Вік: ${user.age} | Зріст: ${user.height} см | Вага: ${user.weight} кг\n` +
    `Стать: ${user.sex} | Активність: ${user.activity_level}\n\n` +
    `🔥 BMR: ${Math.round(user.bmr)} ккал\n` +
    `🏃‍♂️ TDEE: ${Math.round(user.tdee)} ккал`
  );
});

// ==========================================
// ОБРОБКА ТЕКСТУ ТА ЗБЕРЕЖЕННЯ В БД
// ==========================================
bot.on("message:text", (ctx) => {
  const text = ctx.message.text.trim().toLowerCase();
  const originalText = ctx.message.text.trim();
  const step = ctx.session.step;
  const userId = ctx.from.id;

  if (step === "idle") {
    ctx.reply("Використай меню команд зліва від поля вводу, щоб керувати ботом 🤖");
    return;
  }

  // ЛОГІКА ВИДАЛЕННЯ З БАЗИ
  if (step === "waiting_delete_id") {
    const mealId = parseInt(text);
    if (isNaN(mealId)) return ctx.reply("❌ Помилка! Введи коректний числовий ID (наприклад: 5):");
    
    // Видаляємо лише той запис, який належить саме цьому користувачу (безпека!)
    const deleteMeal = db.query("DELETE FROM meals WHERE id = ? AND user_id = ?");
    const result = deleteMeal.run(mealId, userId);
    
    ctx.session.step = "idle";
    
    // result.changes показує, скільки рядків було видалено з таблиці
    if (result.changes > 0) {
      ctx.reply(`Запис успішно видалено! 🗑️✅\nПеревір оновлений список: /today`);
    } else {
      ctx.reply(`❌ Запис з таким ID не знайдено. Перевір правильність у списку: /today`);
    }
    return;
  }

  // ЗАПИС ЇЖІ (Назва -> Калорії)
  if (step === "waiting_meal_name") {
    ctx.session.tempMealName = originalText;
    ctx.session.step = "waiting_meal_calories";
    ctx.reply(`Ти з'їв(ла): "${originalText}".\nСкільки калорій у цій порції? 🔢 (напиши просто число, наприклад: 350)`);
    return;
  }

  if (step === "waiting_meal_calories") {
    const calories = parseInt(text);
    if (isNaN(calories) || calories < 0) return ctx.reply("❌ Помилка! Введи коректне число калорій:");
    
    const insertMeal = db.query("INSERT INTO meals (user_id, raw_text, calories_estimated, timestamp) VALUES (?, ?, ?, ?)");
    const timestamp = new Date().toISOString(); 
    
    insertMeal.run(userId, ctx.session.tempMealName, calories, timestamp);
    
    ctx.session.step = "idle";
    ctx.session.tempMealName = undefined; 
    ctx.reply("Прийом їжі та калорії збережено ✅\nМожеш перевірити список командою /today");
    return;
  }

  // ПРОФІЛЬ (Вік -> Зріст -> Вага -> Стать -> Активність)
  if (step === "waiting_age") {
    const age = parseInt(text);
    if (isNaN(age) || age < 10 || age > 100) return ctx.reply("❌ Помилка! Введи число від 10 до 100:");
    ctx.session.age = age; ctx.session.step = "waiting_height"; ctx.reply("✅ Зріст у см (від 100 до 250):");
  } 
  else if (step === "waiting_height") {
    const height = parseInt(text);
    if (isNaN(height) || height < 100 || height > 250) return ctx.reply("❌ Помилка! Від 100 до 250:");
    ctx.session.height = height; ctx.session.step = "waiting_weight"; ctx.reply("✅ Вага в кг (від 30 до 300):");
  } 
  else if (step === "waiting_weight") {
    const weight = parseInt(text);
    if (isNaN(weight) || weight < 30 || weight > 300) return ctx.reply("❌ Помилка! Від 30 до 300:");
    ctx.session.weight = weight; ctx.session.step = "waiting_sex"; 
    
    const sexKeyboard = new Keyboard().text("male").text("female").resized().oneTime();
    ctx.reply("✅ Вага збережена! Обери свою стать (натисни кнопку):", { reply_markup: sexKeyboard });
  } 
  else if (step === "waiting_sex") {
    if (text !== "male" && text !== "female") return ctx.reply("❌ Натисни кнопку male або female:");
    ctx.session.sex = text; ctx.session.step = "waiting_activity"; 
    
    const activityKeyboard = new Keyboard()
      .text("low").text("light").row() 
      .text("medium").text("high").resized().oneTime();
    
    ctx.reply("✅ Стать збережена! Обери рівень активності (натисни кнопку):", { reply_markup: activityKeyboard });
  } 
  else if (step === "waiting_activity") {
    let activity = 0;
    if (text === "low") activity = 1.2; else if (text === "light") activity = 1.375;
    else if (text === "medium") activity = 1.55; else if (text === "high") activity = 1.725;
    else return ctx.reply("❌ Обери кнопку: low, light, medium, high:");

    const bmr = calculateBMR(ctx.session.weight!, ctx.session.height!, ctx.session.age!, ctx.session.sex!);
    const tdee = calculateTDEE(bmr, activity);

    const insertOrUpdateUser = db.query(`
      INSERT INTO users (telegram_id, age, weight, height, sex, activity_level, bmr, tdee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        age=excluded.age, weight=excluded.weight, height=excluded.height,
        sex=excluded.sex, activity_level=excluded.activity_level, bmr=excluded.bmr, tdee=excluded.tdee
    `);

    insertOrUpdateUser.run(userId, ctx.session.age, ctx.session.weight, ctx.session.height, ctx.session.sex, activity, bmr, tdee);
    ctx.session.step = "idle";

    ctx.reply(`🎉 **Дані збережено в базу!**\nТепер я пам'ятатиму тебе навіть після перезапуску.\n\nТвій TDEE: ${Math.round(tdee)} ккал/день.`, { reply_markup: { remove_keyboard: true } });
  }
});

console.log("💾 Бот з базою даних запускається...");
bot.start();