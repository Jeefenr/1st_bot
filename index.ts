import { Bot, session, Context, SessionFlavor } from "grammy";

// 1. ОПИСУЄМО "БЛОКНОТ" БОТА (Session)
// Це те, що бот буде пам'ятати для кожного користувача
interface SessionData {
  step: "idle" | "waiting_age" | "waiting_height" | "waiting_weight" | "waiting_sex" | "waiting_activity";
  age?: number;
  height?: number;
  weight?: number;
  sex?: "male" | "female";
  activity?: number;
}

// Розширюємо стандартний контекст бота нашими сесіями
type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(process.env.BOT_TOKEN || "");

// Ініціалізуємо сесію (за замовчуванням бот нічого не чекає - стан "idle")
bot.use(session({ initial: (): SessionData => ({ step: "idle" }) }));

// ==========================================
// ПУНКТ 1: ФОРМУЛИ
// ==========================================
function calculateBMR(weight: number, height: number, age: number, sex: string): number {
  if (sex === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

function calculateTDEE(bmr: number, activity: number): number {
  return bmr * activity;
}

// ==========================================
// ПУНКТ 2: КОМАНДА /set_profile (Початок опитування)
// ==========================================
bot.command("set_profile", (ctx) => {
  ctx.session.step = "waiting_age"; // Перемикаємо бота в режим очікування віку
  ctx.reply("Давай налаштуємо твій профіль! 📝\nКрок 1: Введи свій вік (цифрою, наприклад: 25):");
});

// ==========================================
// ПУНКТ 5: КОМАНДА /my_profile (Показати дані)
// ==========================================
bot.command("my_profile", (ctx) => {
  const s = ctx.session;
  if (!s.age || !s.height || !s.weight || !s.sex || !s.activity) {
    ctx.reply("Твій профіль ще не заповнений! Напиши /set_profile");
    return;
  }

  const bmr = calculateBMR(s.weight, s.height, s.age, s.sex);
  const tdee = calculateTDEE(bmr, s.activity);

  ctx.reply(
    `📊 **Твій профіль:**\n` +
    `Вік: ${s.age} років\n` +
    `Зріст: ${s.height} см\n` +
    `Вага: ${s.weight} кг\n` +
    `Стать: ${s.sex}\n` +
    `Активність: ${s.activity}\n\n` +
    `🔥 **Твої показники:**\n` +
    `Базовий обмін речовин (BMR): ${Math.round(bmr)} ккал\n` +
    `Денна норма калорій (TDEE): ${Math.round(tdee)} ккал`
  );
});

// ==========================================
// ПУНКТ 3 ТА 4: ОБРОБКА ТЕКСТУ ТА ВАЛІДАЦІЯ
// ==========================================
bot.on("message:text", (ctx) => {
  const text = ctx.message.text.trim().toLowerCase();
  const step = ctx.session.step;

  // Якщо бот нічого не чекає, просто вітаємось
  if (step === "idle") {
    ctx.reply("Напиши /set_profile, щоб почати розрахунок калорій, або /my_profile, щоб подивитися результати.");
    return;
  }

  // КРОК 1: Отримуємо ВІК
  if (step === "waiting_age") {
    const age = parseInt(text);
    if (isNaN(age) || age < 10 || age > 100) {
      ctx.reply("❌ Помилка! Вік має бути числом від 10 до 100. Спробуй ще раз:");
      return;
    }
    ctx.session.age = age;
    ctx.session.step = "waiting_height"; // Перемикаємо на наступний крок
    ctx.reply("✅ Збережено! Крок 2: Введи свій зріст у сантиметрах (від 100 до 250):");
    return;
  }

  // КРОК 2: Отримуємо ЗРІСТ
  if (step === "waiting_height") {
    const height = parseInt(text);
    if (isNaN(height) || height < 100 || height > 250) {
      ctx.reply("❌ Помилка! Зріст має бути числом від 100 до 250. Спробуй ще раз:");
      return;
    }
    ctx.session.height = height;
    ctx.session.step = "waiting_weight";
    ctx.reply("✅ Збережено! Крок 3: Введи свою вагу в кілограмах (від 30 до 300):");
    return;
  }

  // КРОК 3: Отримуємо ВАГУ
  if (step === "waiting_weight") {
    const weight = parseInt(text);
    if (isNaN(weight) || weight < 30 || weight > 300) {
      ctx.reply("❌ Помилка! Вага має бути числом від 30 до 300. Спробуй ще раз:");
      return;
    }
    ctx.session.weight = weight;
    ctx.session.step = "waiting_sex";
    ctx.reply("✅ Збережено! Крок 4: Введи свою стать (напиши 'male' для чоловіка або 'female' для жінки):");
    return;
  }

  // КРОК 4: Отримуємо СТАТЬ
  if (step === "waiting_sex") {
    if (text !== "male" && text !== "female") {
      ctx.reply("❌ Помилка! Напиши чітко: male або female.");
      return;
    }
    ctx.session.sex = text;
    ctx.session.step = "waiting_activity";
    ctx.reply("✅ Збережено! Останній крок!\nОбери свій рівень активності (напиши слово):\n- low (низький)\n- light (легкий)\n- medium (середній)\n- high (високий)");
    return;
  }

  // КРОК 5: Отримуємо АКТИВНІСТЬ і рахуємо результат
  if (step === "waiting_activity") {
    let activityMultiplier = 0;
    if (text === "low") activityMultiplier = 1.2;
    else if (text === "light") activityMultiplier = 1.375;
    else if (text === "medium") activityMultiplier = 1.55;
    else if (text === "high") activityMultiplier = 1.725;
    else {
      ctx.reply("❌ Помилка! Обери один із варіантів: low, light, medium, high.");
      return;
    }

    ctx.session.activity = activityMultiplier;
    ctx.session.step = "idle"; // Опитування завершено!

    // Рахуємо і відправляємо результати (ПУНКТ 3)
    const bmr = calculateBMR(ctx.session.weight!, ctx.session.height!, ctx.session.age!, ctx.session.sex!);
    const tdee = calculateTDEE(bmr, activityMultiplier);

    ctx.reply(
      `🎉 **Профіль успішно налаштовано!**\n\n` +
      `🔥 Твій BMR (Базовий обмін): ${Math.round(bmr)} ккал/день\n` +
      `🏃‍♂️ Твій TDEE (З урахуванням активності): ${Math.round(tdee)} ккал/день\n\n` +
      `Ти завжди можеш переглянути свої дані командою /my_profile`
    );
    return;
  }
});

console.log("🍏 Калорійний Бот запускається...");
bot.start();