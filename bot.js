const { loadLocalEnv } = require("./src/config");
const { findTopMatches } = require("./src/matcher");
const { UserStore } = require("./src/storage");

loadLocalEnv();
let Markup;

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const tokenLooksValid = token && /^\d{6,}:[A-Za-z0-9_-]{20,}$/.test(token);

if (!tokenLooksValid) {
  console.error("خطأ في الإعداد: أضف TELEGRAM_BOT_TOKEN صالحاً إلى ملف .env.");
  process.exitCode = 1;
} else if (process.argv.includes("--check-config")) {
  // Do not print or contact Telegram during configuration checks.
  console.log("إعدادات البوت صالحة، ولم يتم إجراء اتصال بتيليغرام.");
} else {
  startBot(token);
}

function startBot(botToken) {
  const telegraf = require("telegraf");
  const { Telegraf } = telegraf;
  Markup = telegraf.Markup;
  const bot = new Telegraf(botToken);
  const store = new UserStore();
  const sessions = new Map();

  const questions = [
    { key: "firstName", prompt: "شنو اسمك الأول؟", validate: shortText("الاسم الأول", 2, 30) },
    { key: "university", prompt: "بأي جامعة تدرس؟", validate: shortText("اسم الجامعة", 2, 80) },
    { key: "specialty", prompt: "شنو تخصصك؟ مثال: طب عام", validate: shortText("التخصص", 2, 80) },
    {
      key: "academicYear",
      prompt: "اختار المرحلة أو السنة الدراسية:",
      options: [["الأولى", "الثانية"], ["الثالثة", "الرابعة"], ["الخامسة", "السادسة"], ["دراسات عليا"]],
    },
    {
      key: "subjects",
      prompt: "شنو المواد أو المجالات اللي تريد تدرسها؟\nاكتبها مفصولة بفاصلة، مثال: تشريح، فسلجة",
      validate: listText("المواد أو المجالات"),
    },
    {
      key: "days",
      prompt: "اختار الأيام المناسبة إلك، أو اكتب أكثر من يوم مفصول بفاصلة:",
      options: [["الأحد، الثلاثاء", "الاثنين، الأربعاء"], ["الخميس، الجمعة", "كل الأيام"]],
      validate: listText("الأيام المناسبة"),
    },
    {
      key: "preferredTime",
      prompt: "شنو الوقت المفضل للدراسة؟",
      options: [["صباحاً", "ظهراً"], ["مساءً", "ليلاً"]],
    },
    {
      key: "studyStyle",
      prompt: "شنو أسلوب الدراسة اللي تفضله؟",
      options: [["مكالمات", "شات"], ["جلسات مباشرة"]],
    },
    {
      key: "commitment",
      prompt: "وأخيراً، شكد مستوى التزامك؟",
      options: [["خفيف", "متوسط", "جاد"]],
    },
  ];

  bot.start(async (ctx) => {
    sessions.set(ctx.from.id, { step: 0, profile: { telegramId: String(ctx.from.id) } });
    await ctx.reply(
      "أهلاً بيك في رِفقة 👋\nأنا هنا حتى أساعدك تلقى شريك دراسة مناسب إلك. راح أسألك كم سؤال بسيط، ومعلومات التواصل تبقى خاصة.",
      Markup.removeKeyboard(),
    );
    await askQuestion(ctx, questions[0]);
  });

  bot.command("cancel", async (ctx) => {
    sessions.delete(ctx.from.id);
    await ctx.reply("تم إلغاء التسجيل. تقدر تبدأ من جديد بأي وقت باستخدام /start.", Markup.removeKeyboard());
  });

  bot.command("matches", async (ctx) => {
    const users = await store.readAll();
    const profile = users.find((user) => user.telegramId === String(ctx.from.id));
    if (!profile) return ctx.reply("كمّل ملفك أولاً باستخدام /start حتى نبحث عن رِفقة مناسبة.");
    return sendMatches(ctx, profile, users);
  });

  bot.on("text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    const session = sessions.get(ctx.from.id);
    if (!session) return ctx.reply("استخدم /start حتى نبدأ إعداد ملفك الدراسي.");

    const question = questions[session.step];
    const answer = ctx.message.text.trim();
    if (question.options && !question.options.flat().includes(answer)) {
      return ctx.reply("اختار واحد من الخيارات الظاهرة حتى نكمل.", keyboardFor(question));
    }
    const validationError = question.validate?.(answer);
    if (validationError) return ctx.reply(validationError, keyboardFor(question));

    session.profile[question.key] = ["subjects", "days"].includes(question.key)
      ? answer.split(/[,،]/).map((item) => item.trim()).filter(Boolean)
      : answer;
    session.step += 1;

    if (session.step < questions.length) return askQuestion(ctx, questions[session.step]);

    await store.upsert(session.profile);
    sessions.delete(ctx.from.id);
    const users = await store.readAll();
    await ctx.reply("تم حفظ ملفك بأمان ✅\nهسه نشوف أفضل الشركاء المتوافقين وياك.", Markup.removeKeyboard());
    return sendMatches(ctx, session.profile, users);
  });

  bot.catch(async (error, ctx) => {
    console.error("حدث خطأ غير متوقع في البوت:", error?.message || "خطأ غير معروف");
    try {
      await ctx.reply("صار خطأ مؤقت. جرّب مرة ثانية، أو استخدم /start لإعادة البداية.");
    } catch {
      // Telegram may be unavailable; the sanitized server log above is the fallback.
    }
  });

  bot
    .launch()
    .then(() => console.log("بوت رِفقة يعمل الآن."))
    .catch((error) => {
      console.error("تعذر تشغيل بوت رِفقة:", error?.message || "خطأ اتصال غير معروف");
      process.exitCode = 1;
    });
  const stop = (signal) => bot.stop(signal);
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
}

function shortText(label, minimum, maximum) {
  return (value) => {
    if (value.length < minimum) return `رجاءً اكتب ${label} بشكل أوضح.`;
    if (value.length > maximum) return `${label} طويل أكثر من اللازم (الحد ${maximum} حرف).`;
    return null;
  };
}

function listText(label) {
  return (value) => (!value || value.length > 160 ? `رجاءً أدخل ${label} بوضوح وبحد أقصى 160 حرف.` : null);
}

function keyboardFor(question) {
  return question.options ? Markup.keyboard(question.options).resize().oneTime() : Markup.removeKeyboard();
}

async function askQuestion(ctx, question) {
  return ctx.reply(question.prompt, keyboardFor(question));
}

async function sendMatches(ctx, profile, users) {
  const matches = findTopMatches(profile, users);
  if (!matches.length) {
    return ctx.reply("ماكو شركاء متاحين حالياً. نحتاج طلاب أكثر، وراح تقدر تعيد البحث لاحقاً باستخدام /matches.");
  }

  if (matches.length < 3) {
    await ctx.reply(`لقينا ${matches.length} من الشركاء حالياً. نحتاج طلاب أكثر حتى نعرض لك ٣ خيارات، بس هاي أفضل النتائج المتاحة:`);
  } else {
    await ctx.reply("هاي أفضل ٣ نتائج متوافقة وياك:");
  }

  for (const [index, match] of matches.entries()) {
    const user = match.profile;
    const shared = match.sharedSubjects.length ? match.sharedSubjects.join("، ") : "ما محدد بعد";
    await ctx.reply(
      `${index + 1}) نسبة التوافق: ${match.percentage}%\n` +
        `الاسم: ${user.firstName}\nالجامعة: ${user.university}\nالتخصص: ${user.specialty}\n` +
        `المرحلة: ${user.academicYear}\nالمواد المشتركة: ${shared}\n` +
        `أسلوب الدراسة: ${user.studyStyle}\nمستوى الالتزام: ${user.commitment}\n\n` +
        "🔒 معلومات التواصل تبقى خاصة.",
    );
  }
}
