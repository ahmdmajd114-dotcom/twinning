import 'dotenv/config';
import http from 'node:http';
import { Telegraf, Markup, session } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

const required = ['BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);

const bot = new Telegraf(process.env.BOT_TOKEN);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const labels = {
  female: 'بنت', male: 'ولد', morning: 'صباحاً', afternoon: 'ظهراً', evening: 'مساءً', flexible: 'مرن',
  visual: 'بصري', reading: 'قراءة وكتابة', discussion: 'نقاش', practice: 'تطبيق وحل أسئلة',
  exam: 'تحضير للامتحانات', routine: 'التزام بروتين', assignments: 'واجبات ومشاريع', revise: 'مراجعة',
  online: 'أونلاين', in_person: 'حضوري', both: 'أونلاين وحضوري',
  study: 'مذاكرة فعلية', accountability: 'التزام ومتابعة',
  sessions: 'جلسات بالأسبوع'
};
const buttons = (items) => Markup.inlineKeyboard(items.map(([text, value]) => [Markup.button.callback(text, value)]));
const menu = Markup.keyboard([['🔎 ابحث عن شريك', '🤝 طلباتي'], ['📝 تحديث بياناتي', '✉️ راسل شريكاً'], ['🔐 كشف هويتي', '📋 مهامنا'], ['➕ مهمة', '⏱️ جلسة دراسة'], ['👤 ملفي', '⭐ قيّم شريكاً'], ['🗑️ حذف حسابي']]).resize();

function aliasFor(id) {
  const n = Math.abs(Number(BigInt(id) % 10000n));
  return `Twinny ${String(n).padStart(4, '0')}`;
}
function ageFrom(year) { return new Date().getFullYear() - Number(year); }
function normalise(value = '') {
  return value.toLowerCase().normalize('NFD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]/gu, '');
}
function governorateKey(value) {
  const key = normalise(value);
  const aliases = { بابل: ['بابل', 'الحله', 'حله', 'babel', 'babylon', 'hilla'], بغداد: ['بغداد', 'baghdad'], البصره: ['البصره', 'بصره', 'basra'], كربلاء: ['كربلاء', 'كربلا', 'karbala'], النجف: ['النجف', 'نجف', 'najaf'], اربيل: ['اربيل', 'erbil'], نينوى: ['نينوى', 'موصل', 'الموصل', 'mosul'], واسط: ['واسط', 'كوت', 'الكوت', 'wasit', 'kut'], ديالى: ['ديالى', 'بعقوبه', 'baqubah', 'diyala'] };
  for (const [canonical, values] of Object.entries(aliases)) if (values.some((item) => key.includes(normalise(item)))) return canonical;
  return key;
}
function universityKey(value) {
  const key = normalise(value);
  const known = ['بغداد', 'بابل', 'البصره', 'الكوفه', 'كربلاء', 'المستنصريه', 'النهرين', 'واسط', 'ديالى', 'تكريت', 'الموصل'];
  const found = known.find((item) => key.includes(item));
  return found ? `جامعه${found}` : key.replace(/(جامعه|كليه|معهد)/g, '');
}
function majorKey(value) {
  const key = normalise(value);
  if (key.includes('طب')) return 'طب';
  if (key.includes('صيدل')) return 'صيدله';
  if (key.includes('اسنان')) return 'طباسنان';
  if (key.includes('تمريض')) return 'تمريض';
  return key;
}
function studyFocusKey(value = '') { return normalise(value); }
function aiProfile(profile, id) {
  return {
    id,
    governorate: governorateKey(profile.city),
    university: universityKey(profile.university),
    major: majorKey(profile.major),
    academic_year: profile.academic_year,
    age: ageFrom(profile.birth_year),
    study_time: profile.study_time,
    learning_style: profile.learning_style,
    goal: profile.goal.slice(0, 220),
    study_focus: (profile.study_focus || '').slice(0, 220),
    previous_grades: (profile.previous_grades || '').slice(0, 300),
    sessions_per_week: profile.sessions_per_week,
    session_duration: profile.session_duration,
    study_mode: profile.study_mode,
    partner_preference: profile.partner_preference,
    seriousness: profile.seriousness
  };
}
async function rerankWithGroq(me, candidates) {
  if (!process.env.GROQ_API_KEY || candidates.length < 2) {
    console.info(`Groq skipped: ${process.env.GROQ_API_KEY ? 'fewer than 2 candidates' : 'GROQ_API_KEY is not configured'}`);
    return candidates;
  }
  const input = {
    student: aiProfile(me, 'student'),
    candidates: candidates.map((candidate, index) => aiProfile(candidate, `c${index + 1}`))
  };
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', temperature: 0.2, reasoning_effort: 'low', max_completion_tokens: 900,
        messages: [
          { role: 'system', content: 'You rank study-partner candidates. Hard safety filters were already applied; never infer gender or add candidates. Rank using compatible study time, goals, commitment, learning style, academic stage, location, university, current study focus, and previous-course grades. Grades should improve compatibility only when they indicate relevant shared subjects or comparable academic needs; never mention exact grades in the reason. Return ONLY lines in this exact format, one for every candidate and nothing else: c1 | سبب عربي قصير. Make each reason at most 18 Arabic words.' },
          { role: 'user', content: JSON.stringify(input) }
        ]
      })
    });
    const responseText = await response.text();
    if (!response.ok) throw new Error(`Groq returned ${response.status}: ${responseText.slice(0, 400)}`);
    const result = JSON.parse(responseText);
    const content = result.choices?.[0]?.message?.content || '';
    const allowed = new Map(candidates.map((candidate, index) => [`c${index + 1}`, candidate]));
    const ordered = [];
    for (const line of content.split('\n')) {
      const match = line.match(/^\s*(c\d+)\s*\|\s*(.+?)\s*$/i);
      if (!match) continue;
      const candidate = allowed.get(match[1].toLowerCase());
      if (candidate && !ordered.includes(candidate)) {
        candidate.aiReason = match[2].slice(0, 160);
        ordered.push(candidate);
      }
    }
    if (!ordered.length) throw new Error('Groq returned no usable ranking');
    console.info(`Groq used successfully: re-ranked ${ordered.length} of ${candidates.length} candidates with ${process.env.GROQ_MODEL || 'openai/gpt-oss-20b'}`);
    return [...ordered, ...candidates.filter((candidate) => !ordered.includes(candidate))];
  } catch (error) {
    console.error('Groq re-ranking failed; using deterministic ranking:', error.message);
    return candidates;
  }
}
function score(me, candidate) {
  let value = 20;
  if (governorateKey(me.city) === governorateKey(candidate.city)) value += 22;
  if (universityKey(me.university) === universityKey(candidate.university)) value += 24;
  if (majorKey(me.major) === majorKey(candidate.major)) value += 16;
  if (me.academic_year === candidate.academic_year) value += 8;
  if (me.study_time === candidate.study_time) value += 5;
  if (me.learning_style === candidate.learning_style) value += 3;
  if (me.study_focus && candidate.study_focus && studyFocusKey(me.study_focus) === studyFocusKey(candidate.study_focus)) value += 8;
  if (Math.abs(ageFrom(me.birth_year) - ageFrom(candidate.birth_year)) <= 2) value += 2;
  if (me.study_mode && me.study_mode === candidate.study_mode) value += 7;
  if (me.partner_preference && me.partner_preference === candidate.partner_preference) value += 5;
  if (me.sessions_per_week && Math.abs(me.sessions_per_week - candidate.sessions_per_week) <= 1) value += 5;
  if (me.seriousness && Math.abs(me.seriousness - candidate.seriousness) <= 1) value += 3;
  return Math.min(value, 100);
}
async function profile(id) {
  const { data, error } = await db.from('profiles').select('*').eq('telegram_id', id).maybeSingle();
  if (error) throw error;
  return data;
}
async function ensureRegistered(ctx) {
  const me = await profile(ctx.from.id);
  if (!me) { await ctx.reply('حتى أبحث لك عن توأم دراسة، ابدأ التسجيل أولاً عبر /start.'); return null; }
  return me;
}
function startRegistration(ctx) {
  ctx.session = { flow: 'register', step: 'real_name', form: {} };
  return ctx.reply('أهلاً بك في Twinny 👋\nيلا ندخل بياناتك حتى نجد لك أفضل شريك دراسي مناسب.\n\nاكتب اسمك الحقيقي:');
}
async function startPreferenceQuestions(ctx, flow, form = {}) {
  ctx.session = { flow, step: 'sessions_per_week', form };
  return ctx.reply('كم جلسة دراسة تريد بالأسبوع؟', buttons([['جلسة واحدة', 'sessions:1'], ['جلستان', 'sessions:2'], ['3 جلسات', 'sessions:3'], ['4 جلسات', 'sessions:4'], ['5 جلسات أو أكثر', 'sessions:5']]));
}
async function showUpdateMenu(ctx) {
  return ctx.reply('شنو تحب تحدّث من بياناتك؟', Markup.inlineKeyboard([
    [Markup.button.callback('الاسم الحقيقي', 'edit:real_name'), Markup.button.callback('المحافظة', 'edit:city')],
    [Markup.button.callback('الجامعة / المعهد', 'edit:university'), Markup.button.callback('التخصص', 'edit:major')],
    [Markup.button.callback('المرحلة الدراسية', 'edit:academic_year'), Markup.button.callback('وقت الدراسة', 'edit:study_time')],
    [Markup.button.callback('أسلوب التعلّم', 'edit:learning_style'), Markup.button.callback('الهدف الدراسي', 'edit:goal')],
    [Markup.button.callback('شنو تدرس/تحضّر؟', 'edit:study_focus'), Markup.button.callback('التقديرات السابقة', 'edit:previous_grades')],
    [Markup.button.callback('تفضيلات التوافق', 'edit:preferences'), Markup.button.callback('الجنس', 'edit:gender')],
    [Markup.button.callback('سنة الميلاد', 'edit:birth_year')]
  ]));
}
async function saveProfileField(ctx, field, value) {
  const { error } = await db.from('profiles').update({ [field]: value, updated_at: new Date().toISOString() }).eq('telegram_id', ctx.from.id);
  if (error) throw error;
  ctx.session = {};
  await ctx.reply('تم تحديث المعلومة ✅');
  return showUpdateMenu(ctx);
}
async function finishPreferences(ctx) {
  if (ctx.session.flow === 'register') return finishRegistration(ctx);
  const { error } = await db.from('profiles').update(ctx.session.form).eq('telegram_id', ctx.from.id);
  if (error) throw error;
  ctx.session = {};
  return ctx.reply('تم تحديث بياناتك ✅ هسه نكدر نطلع لك اقتراحات أدق. اختَر «🔎 ابحث عن شريك».', menu);
}
async function finishRegistration(ctx) {
  const form = ctx.session.form;
  const row = { telegram_id: ctx.from.id, pseudonym: aliasFor(ctx.from.id), ...form };
  const { error } = await db.from('profiles').upsert(row, { onConflict: 'telegram_id' });
  if (error) throw error;
  ctx.session = {};
  await ctx.reply(`تم إنشاء حسابك بنجاح ✅\nاسمك الظاهر للطلاب: ${row.pseudonym}\n\nراح نحاول نجد لك أفضل شريك دراسي مناسب. من الأزرار اختَر «🔎 ابحث عن شريك».`, menu);
}

bot.use(session());
bot.catch((error, ctx) => console.error(`Bot error for ${ctx?.from?.id}:`, error));
bot.start(async (ctx) => {
  const me = await profile(ctx.from.id);
  if (me) return ctx.reply(`هلا ${me.real_name} 👋 استخدم الأزرار حتى نبحث لك عن شريك دراسة.`, menu);
  return startRegistration(ctx);
});

bot.command('profile', async (ctx) => {
  const me = await ensureRegistered(ctx); if (!me) return;
  await ctx.reply(`ملفك\nالاسم الظاهر: ${me.pseudonym}\n${me.major} · ${me.academic_year}\n${me.university}، ${me.city}${me.study_focus ? `\nتدرس/تحضّر: ${me.study_focus}` : ''}${me.previous_grades ? `\nتقديراتك السابقة: ${me.previous_grades}` : ''}\nوقت الدراسة: ${labels[me.study_time]}\nأسلوبك: ${labels[me.learning_style]}${me.sessions_per_week ? `\n${me.sessions_per_week} جلسات/أسبوع · ${labels[me.study_mode]}` : '\n📝 حدّث بياناتك حتى نحسن التوافق.'}`, menu);
});
bot.command('find', findMatches);
bot.command('matches', showConnections);
bot.command('rate', ratePartner);

async function findMatches(ctx) {
  const me = await ensureRegistered(ctx); if (!me) return;
  const { data: people, error } = await db.from('profiles').select('*').eq('gender', me.gender).eq('is_active', true).neq('telegram_id', me.telegram_id);
  if (error) throw error;
  const deterministic = people.sort((a, b) => score(me, b) - score(me, a)).slice(0, 10);
  const candidates = (await rerankWithGroq(me, deterministic)).slice(0, 3);
  if (!candidates.length) return ctx.reply('حالياً ماكو طالب مناسب ضمن نفس الجنس. جرّب لاحقاً، واحنا نوسع المجتمع يومياً.', menu);
  for (const person of candidates) {
    const { data: ratings } = await db.from('ratings').select('stars, commitment').eq('reviewed_telegram_id', person.telegram_id);
    const average = ratings?.length ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1) : 'جديد';
    const committed = ratings?.filter((r) => r.commitment === 'committed').length ?? 0;
    const preferences = person.sessions_per_week ? `\n📅 ${person.sessions_per_week} جلسات/أسبوع · ${labels[person.study_mode]} · جدية ${'⭐'.repeat(person.seriousness)}` : '';
    const aiReason = person.aiReason ? `\n🤖 ${person.aiReason}` : '';
    const studyFocus = person.study_focus ? `\n📖 يدرس/يحضّر: ${person.study_focus}` : '';
    const grades = person.previous_grades ? `\n📊 التقديرات السابقة: ${person.previous_grades}` : '';
    await ctx.reply(`👤 ${person.pseudonym}\n${person.major} · ${person.academic_year}\n${person.university}، ${person.city}${studyFocus}${grades}\n⏰ ${labels[person.study_time]} · 🧠 ${labels[person.learning_style]}${preferences}\n✨ توافق ${score(me, person)}٪${aiReason}\n⭐ التقييم: ${average}${average === 'جديد' ? '' : ` / 5 (${ratings.length} تقييم، ملتزم: ${committed})`}`, buttons([['أرسل طلب تعارف 🤝', `request:${person.telegram_id}`]]));
  }
}

async function showConnections(ctx) {
  const me = await ensureRegistered(ctx); if (!me) return;
  const { data, error } = await db.from('connections').select('*').or(`requester_telegram_id.eq.${me.telegram_id},recipient_telegram_id.eq.${me.telegram_id}`).order('created_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return ctx.reply('ما عندك طلبات حالياً. اضغط «🔎 ابحث عن شريك».', menu);
  for (const item of data) {
    const otherId = item.requester_telegram_id === me.telegram_id ? item.recipient_telegram_id : item.requester_telegram_id;
    const other = await profile(otherId);
    const state = item.status === 'pending' ? 'قيد الانتظار' : item.status === 'accepted' ? 'تم القبول ✅' : 'مرفوض';
    const actions = item.status === 'pending' && item.recipient_telegram_id === me.telegram_id
      ? buttons([['أقبل ✅', `accept:${item.id}`], ['أرفض', `reject:${item.id}`]])
      : item.status === 'pending' && item.requester_telegram_id === me.telegram_id
        ? buttons([['إلغاء الطلب', `cancel_request:${item.id}`]]) : undefined;
    await ctx.reply(`${other?.pseudonym ?? 'طالب'} — ${state}`, actions);
  }
}

async function ratePartner(ctx) {
  const me = await ensureRegistered(ctx); if (!me) return;
  const { data, error } = await db.from('connections').select('*').eq('status', 'accepted').or(`requester_telegram_id.eq.${me.telegram_id},recipient_telegram_id.eq.${me.telegram_id}`);
  if (error) throw error;
  if (!data.length) return ctx.reply('تقدر تقيّم شريكاً بعد قبول طلب التعارف بينكم.', menu);
  const choices = await Promise.all(data.map(async (c) => {
    const id = c.requester_telegram_id === me.telegram_id ? c.recipient_telegram_id : c.requester_telegram_id;
    const other = await profile(id); return [other.pseudonym, `rate:${c.id}:${id}`];
  }));
  await ctx.reply('منو تحب تقيّم؟ التقييم يظهر بشكل مجمّع ومجهول المصدر.', buttons(choices));
}

async function acceptedConnections(telegramId) {
  const { data, error } = await db.from('connections').select('*').eq('status', 'accepted').or(`requester_telegram_id.eq.${telegramId},recipient_telegram_id.eq.${telegramId}`);
  if (error) throw error;
  return data;
}
async function choosePartner(ctx, flow, prompt) {
  const rows = await acceptedConnections(ctx.from.id);
  if (!rows.length) return ctx.reply('تحتاج شريكاً قبل استخدام هذه الميزة. ابحث عن شريك ثم اقبلوا طلب التعارف.', menu);
  const choices = await Promise.all(rows.map(async (connection) => {
    const partnerId = connection.requester_telegram_id === ctx.from.id ? connection.recipient_telegram_id : connection.requester_telegram_id;
    const partner = await profile(partnerId);
    return [partner.pseudonym, `${flow}:${connection.id}:${partnerId}`];
  }));
  return ctx.reply(prompt, buttons(choices));
}
async function hasRevealedName(connectionId, senderId, recipientId) {
  const { data, error } = await db.from('identity_disclosures').select('id').eq('connection_id', connectionId).eq('revealer_telegram_id', senderId).eq('recipient_telegram_id', recipientId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
async function sendRelay(ctx, connectionId, recipientId, body) {
  const me = await profile(ctx.from.id);
  const { error } = await db.from('messages').insert({ connection_id: connectionId, sender_telegram_id: ctx.from.id, recipient_telegram_id: recipientId, body });
  if (error) throw error;
  const displayName = await hasRevealedName(connectionId, ctx.from.id, recipientId) ? me.real_name : me.pseudonym;
  await bot.telegram.sendMessage(recipientId, `💬 ${displayName}\n━━━━━━━━━━━━\n${body}`, { reply_markup: { inline_keyboard: [[Markup.button.callback(`رد على ${displayName} ↩︎`, `message:${connectionId}:${ctx.from.id}`)]] } });
}
async function showTasks(ctx) {
  const connections = await acceptedConnections(ctx.from.id);
  if (!connections.length) return ctx.reply('ماكو مهام مشتركة إلى الآن.', menu);
  const ids = connections.map((c) => c.id);
  const { data, error } = await db.from('study_tasks').select('*').in('connection_id', ids).eq('is_done', false).order('created_at', { ascending: false });
  if (error) throw error;
  if (!data.length) return ctx.reply('🎉 ماكو مهام مفتوحة. أضف مهمة مشتركة حتى تتابعون التقدم.', menu);
  for (const task of data) {
    const due = task.due_date ? ` · الاستحقاق: ${task.due_date}` : '';
    await ctx.reply(`📋 ${task.title}${due}`, buttons([['تم الإنجاز ✅', `done:${task.id}`]]));
  }
}

bot.on('callback_query', async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();
  const registrationButton = /^(gender|year|time|style|sessions|duration|mode|preference|seriousness):/.test(data) || data === 'year_custom';
  if (registrationButton && !ctx.session?.form) {
    return ctx.reply('انتهت جلسة التسجيل السابقة بسبب إعادة تشغيل البوت. اكتب /start ونبدأ من جديد 👋');
  }
  if (data === 'update_preferences') {
    const me = await ensureRegistered(ctx); if (!me) return;
    return showUpdateMenu(ctx);
  }
  if (data.startsWith('edit:')) {
    const me = await ensureRegistered(ctx); if (!me) return;
    const field = data.split(':')[1];
    const prompts = { real_name: 'اكتب اسمك الحقيقي:', city: 'اكتب محافظتك:', university: 'اكتب اسم الجامعة أو المعهد:', major: 'اكتب تخصصك:', goal: 'اكتب هدفك الدراسي:', study_focus: 'شنو تدرس أو تحضّر حالياً؟ اكتب بحرية، مثال: تحضير المعادلة أو امتحان البورد.', previous_grades: 'اكتب تقديراتك بالمرحلة السابقة بحرية. مثال: باطنية جيد، جراحة جيد، فارما جيد جداً.\nاكتب - إذا ما تريد تضيفها.' };
    if (field === 'preferences') return startPreferenceQuestions(ctx, 'update_preferences');
    if (field === 'gender') return ctx.reply('حدّد جنسك:', buttons([['بنت', 'edit_gender:female'], ['ولد', 'edit_gender:male']]));
    if (field === 'birth_year') { ctx.session = { flow: 'edit_profile', field }; return ctx.reply('اكتب سنة ميلادك:'); }
    if (field === 'academic_year') return ctx.reply('حدّد مرحلتك الدراسية:', buttons([['الأولى', 'edit_year:الأولى'], ['الثانية', 'edit_year:الثانية'], ['الثالثة', 'edit_year:الثالثة'], ['الرابعة', 'edit_year:الرابعة'], ['الخامسة', 'edit_year:الخامسة'], ['السادسة', 'edit_year:السادسة'], ['خريج/ة 🎓', 'edit_year:خريج/ة'], ['تحديد آخر ✏️', 'edit_year:custom']]));
    if (field === 'study_time') return ctx.reply('متى تفضّل الدراسة غالباً؟', buttons([['صباحاً', 'edit_time:morning'], ['ظهراً', 'edit_time:afternoon'], ['مساءً', 'edit_time:evening'], ['مرن', 'edit_time:flexible']]));
    if (field === 'learning_style') return ctx.reply('شنو أسلوبك المفضل؟', buttons([['بصري', 'edit_style:visual'], ['قراءة وكتابة', 'edit_style:reading'], ['نقاش', 'edit_style:discussion'], ['حل أسئلة', 'edit_style:practice']]));
    if (!prompts[field]) return ctx.reply('هذا الخيار غير متاح.');
    ctx.session = { flow: 'edit_profile', field };
    return ctx.reply(prompts[field]);
  }
  if (data.startsWith('edit_gender:')) return saveProfileField(ctx, 'gender', data.split(':')[1]);
  if (data.startsWith('edit_time:')) return saveProfileField(ctx, 'study_time', data.split(':')[1]);
  if (data.startsWith('edit_style:')) return saveProfileField(ctx, 'learning_style', data.split(':')[1]);
  if (data.startsWith('edit_year:')) {
    const value = data.split(':')[1];
    if (value === 'custom') { ctx.session = { flow: 'edit_profile', field: 'academic_year' }; return ctx.reply('اكتب مرحلتك الدراسية أو الوصف المناسب:'); }
    return saveProfileField(ctx, 'academic_year', value);
  }
  if (data.startsWith('request:')) {
    const recipient = Number(data.split(':')[1]);
    const me = await ensureRegistered(ctx); if (!me) return;
    const other = await profile(recipient);
    if (!other || other.gender !== me.gender) return ctx.reply('هذا الاقتراح لم يعد متاحاً.');
    const { error } = await db.from('connections').upsert({ requester_telegram_id: me.telegram_id, recipient_telegram_id: recipient }, { onConflict: 'requester_telegram_id,recipient_telegram_id', ignoreDuplicates: true });
    if (error) throw error;
    await ctx.reply('تم إرسال طلب التعارف 🤝');
    return bot.telegram.sendMessage(recipient, `وصلك طلب تعارف دراسي من ${me.pseudonym}.`, buttons([['عرض طلباتي', 'open_requests']]));
  }
  if (data.startsWith('cancel_request:')) {
    const id = Number(data.split(':')[1]);
    const { data: connection } = await db.from('connections').select('*').eq('id', id).maybeSingle();
    if (!connection || connection.requester_telegram_id !== ctx.from.id || connection.status !== 'pending') return ctx.reply('هذا الطلب لم يعد قابلاً للإلغاء.');
    const { error } = await db.from('connections').delete().eq('id', id);
    if (error) throw error;
    return ctx.reply('تم إلغاء طلب التعارف.');
  }
  if (data === 'open_requests') return showConnections(ctx);
  if (data.startsWith('accept:') || data.startsWith('reject:')) {
    const [action, id] = data.split(':');
    const { data: connection } = await db.from('connections').select('*').eq('id', id).maybeSingle();
    if (!connection || connection.recipient_telegram_id !== ctx.from.id) return ctx.reply('لا تملك صلاحية لهذا الطلب.');
    const status = action === 'accept' ? 'accepted' : 'rejected';
    await db.from('connections').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (status === 'accepted') {
      const accepter = await profile(ctx.from.id); const requester = await profile(connection.requester_telegram_id);
      await ctx.reply(`تم القبول ✅ صار بإمكانكم البدء بالتنسيق.\nشريكك حالياً: ${requester.pseudonym}\nتقدر تكشف اسمك له لاحقاً من «🔐 كشف هويتي».`);
      await bot.telegram.sendMessage(connection.requester_telegram_id, `وافق ${accepter.pseudonym} على طلبك ✅ يمكنكما الآن بدء أول جلسة.\nتقدر تكشف اسمك له لاحقاً من «🔐 كشف هويتي».`, menu);
    } else await ctx.reply('تم رفض الطلب.');
    return;
  }
  if (data.startsWith('rate:')) {
    const [, connectionId, reviewedId] = data.split(':');
    ctx.session = { flow: 'rating', connectionId: Number(connectionId), reviewedId: Number(reviewedId), step: 'stars', rating: {} };
    return ctx.reply('كم نجمة تستحق تجربتك معه/معها؟', buttons([['⭐', 'stars:1'], ['⭐⭐', 'stars:2'], ['⭐⭐⭐', 'stars:3'], ['⭐⭐⭐⭐', 'stars:4'], ['⭐⭐⭐⭐⭐', 'stars:5']]));
  }
  if (data.startsWith('stars:') && ctx.session?.flow === 'rating') {
    ctx.session.rating.stars = Number(data.split(':')[1]); ctx.session.step = 'commitment';
    return ctx.reply('شلون كان الالتزام بالمواعيد والجلسات؟', buttons([['ملتزم جداً ✅', 'commitment:committed'], ['متذبذب 🟡', 'commitment:inconsistent'], ['غير ملتزم 🔴', 'commitment:not_committed']]));
  }
  if (data.startsWith('commitment:') && ctx.session?.flow === 'rating') {
    ctx.session.rating.commitment = data.split(':')[1]; ctx.session.step = 'strengths';
    return ctx.reply('اكتب مميزات الشريك باختصار (أو اكتب - للتخطي):');
  }
  if (data.startsWith('message:')) {
    const [, connectionId, recipientId] = data.split(':');
    ctx.session = { flow: 'message', connectionId: Number(connectionId), recipientId: Number(recipientId) };
    return ctx.reply('اكتب رسالتك. إذا كشفت هويتك لهذا الشريك، ستظهر الرسالة باسمك الحقيقي؛ وإلا باسمك المستعار.');
  }
  if (data.startsWith('identity:')) {
    const [, connectionId, recipientId] = data.split(':');
    const connections = await acceptedConnections(ctx.from.id);
    if (!connections.some((connection) => connection.id === Number(connectionId))) return ctx.reply('هذا التوافق لم يعد متاحاً.');
    if (await hasRevealedName(Number(connectionId), ctx.from.id, Number(recipientId))) return ctx.reply('اسمك مكشوف لهذا الشريك بالفعل ✅');
    ctx.session = { flow: 'reveal_identity', connectionId: Number(connectionId), recipientId: Number(recipientId) };
    return ctx.reply('راح يظهر اسمك الحقيقي لهذا الشريك وتصل رسائلك باسمك. هذا لا يكشف اسمه لك إلا إذا هو اختار ذلك أيضاً.\n\nاكتب أكشف للتأكيد.');
  }
  if (data.startsWith('task:')) {
    const [, connectionId, recipientId] = data.split(':');
    ctx.session = { flow: 'task', connectionId: Number(connectionId), recipientId: Number(recipientId), step: 'title' };
    return ctx.reply('اكتب المهمة المشتركة باختصار. مثال: حل محاضرة الكلى 3');
  }
  if (data.startsWith('session:')) {
    const [, connectionId, recipientId] = data.split(':');
    const { data: sessionRow, error } = await db.from('study_sessions').insert({ connection_id: Number(connectionId), starter_telegram_id: ctx.from.id }).select().single();
    if (error) throw error;
    const me = await profile(ctx.from.id);
    await bot.telegram.sendMessage(Number(recipientId), `⏱️ ${me.pseudonym} بدأ/ت جلسة دراسة الآن. تقدرون تبدأون سوا!`, menu);
    return ctx.reply('بدأت الجلسة ⏱️ ركّزوا، ولما تخلصون اضغط الزر.', buttons([['أنهِ جلستي ✅', `end_session:${sessionRow.id}`]]));
  }
  if (data.startsWith('end_session:')) {
    const id = Number(data.split(':')[1]);
    const { data: row } = await db.from('study_sessions').select('*').eq('id', id).eq('starter_telegram_id', ctx.from.id).is('ended_at', null).maybeSingle();
    if (!row) return ctx.reply('هذه الجلسة منتهية أو غير متاحة.');
    const endedAt = new Date();
    await db.from('study_sessions').update({ ended_at: endedAt.toISOString() }).eq('id', id);
    const minutes = Math.max(1, Math.round((endedAt - new Date(row.started_at)) / 60000));
    return ctx.reply(`أحسنتم ✅ أنهيت جلسة مدتها ${minutes} دقيقة.`, menu);
  }
  if (data.startsWith('done:')) {
    const id = Number(data.split(':')[1]);
    const { data: task } = await db.from('study_tasks').select('connection_id').eq('id', id).maybeSingle();
    const ownConnections = await acceptedConnections(ctx.from.id);
    if (!task || !ownConnections.some((c) => c.id === task.connection_id)) return ctx.reply('هذه المهمة غير متاحة.');
    await db.from('study_tasks').update({ is_done: true }).eq('id', id);
    return ctx.reply('تم تعليم المهمة كمنجزة ✅');
  }
  return next();
});

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text === '🔎 ابحث عن شريك') return findMatches(ctx);
  if (text === '👤 ملفي') return bot.handleUpdate({ ...ctx.update, message: { ...ctx.message, text: '/profile', entities: [{ offset: 0, length: 8, type: 'bot_command' }] } });
  if (text === '🤝 طلباتي') return showConnections(ctx);
  if (text === '📝 تحديث بياناتي') { const me = await ensureRegistered(ctx); if (!me) return; return showUpdateMenu(ctx); }
  if (text === '✉️ راسل شريكاً') return choosePartner(ctx, 'message', 'اختَر الشريك الذي تريد مراسلته:');
  if (text === '🔐 كشف هويتي') return choosePartner(ctx, 'identity', 'لأي شريك تحب تكشف اسمك الحقيقي؟');
  if (text === '📋 مهامنا') return showTasks(ctx);
  if (text === '➕ مهمة') return choosePartner(ctx, 'task', 'لمن تريد إضافة هذه المهمة المشتركة؟');
  if (text === '⏱️ جلسة دراسة') return choosePartner(ctx, 'session', 'اختَر الشريك ثم ابدأ جلسة الدراسة:');
  if (text === '⭐ قيّم شريكاً') return ratePartner(ctx);
  if (text === '🗑️ حذف حسابي') { ctx.session = { flow: 'delete' }; return ctx.reply('هذا يحذف ملفك وطلباتك وتقييماتك نهائياً. اكتب احذف للتأكيد.'); }
  if (ctx.session?.flow === 'delete') {
    if (text === 'احذف') { await db.from('profiles').delete().eq('telegram_id', ctx.from.id); ctx.session = {}; return ctx.reply('تم حذف حسابك وبياناتك من Twinny.', Markup.removeKeyboard()); }
    return ctx.reply('تم إلغاء الحذف.');
  }
  if (ctx.session?.flow === 'rating') {
    if (ctx.session.step === 'strengths') { ctx.session.rating.strengths = text === '-' ? null : text; ctx.session.step = 'improvements'; return ctx.reply('اكتب أي ملاحظة أو سلبية بنّاءة (أو اكتب - للتخطي):'); }
    if (ctx.session.step === 'improvements') {
      const rating = { connection_id: ctx.session.connectionId, reviewer_telegram_id: ctx.from.id, reviewed_telegram_id: ctx.session.reviewedId, ...ctx.session.rating, improvements: text === '-' ? null : text };
      const { error } = await db.from('ratings').upsert(rating, { onConflict: 'connection_id,reviewer_telegram_id' }); if (error) throw error;
      ctx.session = {}; return ctx.reply('شكراً لتقييمك. رأيك يساعد المجتمع يبقى جاداً وموثوقاً ⭐', menu);
    }
  }
  if (ctx.session?.flow === 'message') {
    await sendRelay(ctx, ctx.session.connectionId, ctx.session.recipientId, text);
    ctx.session = {}; return ctx.reply('تم إرسال رسالتك ✉️', menu);
  }
  if (ctx.session?.flow === 'reveal_identity') {
    if (text !== 'أكشف' && text !== 'اكشف') return ctx.reply('ما تغير شيء. اكتب أكشف إذا تريد تأكيد كشف اسمك.');
    const { connectionId, recipientId } = ctx.session;
    const { error } = await db.from('identity_disclosures').insert({ connection_id: connectionId, revealer_telegram_id: ctx.from.id, recipient_telegram_id: recipientId });
    if (error) throw error;
    const me = await profile(ctx.from.id);
    await bot.telegram.sendMessage(recipientId, `🔐 ${me.pseudonym} اختار يكشف اسمه لك.\nمن الآن رسائله تظهر باسم: ${me.real_name}\n\nقرار كشف اسمك يبقى إلك.`, menu);
    ctx.session = {}; return ctx.reply('تم كشف اسمك لهذا الشريك فقط ✅ من الآن رسائلك توصله باسمك الحقيقي.', menu);
  }
  if (ctx.session?.flow === 'task') {
    if (ctx.session.step === 'title') { ctx.session.title = text; ctx.session.step = 'due'; return ctx.reply('اكتب تاريخ الاستحقاق بصيغة YYYY-MM-DD، أو - بدون تاريخ:'); }
    const due = text === '-' ? null : text;
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return ctx.reply('الصيغة تكون YYYY-MM-DD، مثال: 2026-08-20، أو اكتب -.');
    const { error } = await db.from('study_tasks').insert({ connection_id: ctx.session.connectionId, creator_telegram_id: ctx.from.id, title: ctx.session.title, due_date: due });
    if (error) throw error;
    await bot.telegram.sendMessage(ctx.session.recipientId, `📋 أضيفت مهمة مشتركة جديدة: ${ctx.session.title}${due ? `\nالاستحقاق: ${due}` : ''}`, menu);
    ctx.session = {}; return ctx.reply('انضافت المهمة وانرسل إشعار لشريكك ✅', menu);
  }
  if (ctx.session?.flow === 'edit_profile') {
    const field = ctx.session.field;
    if (field === 'birth_year') {
      const year = Number(text);
      if (!Number.isInteger(year) || ageFrom(year) < 16 || ageFrom(year) > 60) return ctx.reply('اكتب سنة ميلاد صحيحة (العمر المسموح من 16 إلى 60).');
      return saveProfileField(ctx, field, year);
    }
    return saveProfileField(ctx, field, text);
  }
  if (ctx.session?.flow !== 'register' && ctx.session?.flow !== 'update_preferences') return;
  const s = ctx.session;
  if (s.step === 'real_name') { s.form.real_name = text; s.step = 'gender'; return ctx.reply('حدّد جنسك:', buttons([['بنت', 'gender:female'], ['ولد', 'gender:male']])); }
  if (s.step === 'birth_year') { const year = Number(text); if (!Number.isInteger(year) || ageFrom(year) < 16 || ageFrom(year) > 60) return ctx.reply('اكتب سنة ميلاد صحيحة (العمر المسموح من 16 إلى 60).'); s.form.birth_year = year; s.step = 'city'; return ctx.reply('اكتب محافظتك:'); }
  if (s.step === 'city') { s.form.city = text; s.step = 'university'; return ctx.reply('اكتب اسم الجامعة أو المعهد:'); }
  if (s.step === 'university') { s.form.university = text; s.step = 'major'; return ctx.reply('اكتب تخصصك:'); }
  if (s.step === 'major') { s.form.major = text; s.step = 'academic_year'; return ctx.reply('أي مرحلة دراسية؟', buttons([['الأولى', 'year:الأولى'], ['الثانية', 'year:الثانية'], ['الثالثة', 'year:الثالثة'], ['الرابعة', 'year:الرابعة'], ['الخامسة', 'year:الخامسة'], ['السادسة', 'year:السادسة'], ['خريج/ة 🎓', 'year:خريج/ة'], ['تحديد آخر ✏️', 'year_custom']])); }
  if (s.step === 'academic_year_custom') { s.form.academic_year = text; s.step = 'study_time'; return ctx.reply('متى تفضّل الدراسة غالباً؟', buttons([['صباحاً', 'time:morning'], ['ظهراً', 'time:afternoon'], ['مساءً', 'time:evening'], ['مرن', 'time:flexible']])); }
  if (s.step === 'goal') { s.form.goal = text; s.step = 'study_focus'; return ctx.reply('شنو تدرس أو تحضّر حالياً؟ اكتب بحرية، مثال: تحضير المعادلة أو امتحان البورد.'); }
  if (s.step === 'study_focus') { s.form.study_focus = text; s.step = 'previous_grades'; return ctx.reply('اكتب تقديراتك بالمرحلة السابقة بحرية. مثال: باطنية جيد، جراحة جيد، فارما جيد جداً.\nاكتب - إذا ما تريد تضيفها.'); }
  if (s.step === 'previous_grades') { s.form.previous_grades = text === '-' ? null : text; return startPreferenceQuestions(ctx, 'register', s.form); }
});

// Registration callbacks are separate so all selection questions remain button-only.
bot.action(/^gender:(female|male)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.gender = ctx.match[1]; ctx.session.step = 'birth_year'; await ctx.reply('اكتب سنة ميلادك (مثال: 2004):'); });
bot.action('year_custom', async (ctx) => { await ctx.answerCbQuery(); ctx.session.step = 'academic_year_custom'; await ctx.reply('اكتب مرحلتك الدراسية أو الوصف الذي يناسبك:'); });
bot.action(/^year:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.academic_year = ctx.match[1]; ctx.session.step = 'study_time'; await ctx.reply('متى تفضّل الدراسة غالباً؟', buttons([['صباحاً', 'time:morning'], ['ظهراً', 'time:afternoon'], ['مساءً', 'time:evening'], ['مرن', 'time:flexible']])); });
bot.action(/^time:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.study_time = ctx.match[1]; ctx.session.step = 'learning_style'; await ctx.reply('شنو أسلوبك المفضل؟', buttons([['بصري', 'style:visual'], ['قراءة وكتابة', 'style:reading'], ['نقاش', 'style:discussion'], ['حل أسئلة', 'style:practice']])); });
bot.action(/^style:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.learning_style = ctx.match[1]; ctx.session.step = 'goal'; await ctx.reply('شنو هدفك الأساسي من شريك الدراسة؟ مثال: التزام 3 جلسات بالأسبوع أو تحضير للفاينل'); });
bot.action(/^sessions:(\d+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.sessions_per_week = Number(ctx.match[1]); ctx.session.step = 'session_duration'; await ctx.reply('كم مدة الجلسة التي تفضّلها؟', buttons([['30 دقيقة', 'duration:30'], ['45 دقيقة', 'duration:45'], ['ساعة', 'duration:60'], ['ساعة ونصف', 'duration:90'], ['ساعتان', 'duration:120']])); });
bot.action(/^duration:(\d+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.session_duration = Number(ctx.match[1]); ctx.session.step = 'study_mode'; await ctx.reply('تفضّل الدراسة شلون؟', buttons([['أونلاين', 'mode:online'], ['حضوري', 'mode:in_person'], ['الاثنين', 'mode:both']])); });
bot.action(/^mode:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.study_mode = ctx.match[1]; ctx.session.step = 'partner_preference'; await ctx.reply('شنو تريد من شريكك أكثر؟', buttons([['مذاكرة فعلية', 'preference:study'], ['التزام ومتابعة', 'preference:accountability'], ['الاثنين', 'preference:both']])); });
bot.action(/^preference:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.partner_preference = ctx.match[1]; ctx.session.step = 'seriousness'; await ctx.reply('قيّم مستوى جديتك بالدراسة:', buttons([['1', 'seriousness:1'], ['2', 'seriousness:2'], ['3', 'seriousness:3'], ['4', 'seriousness:4'], ['5', 'seriousness:5']])); });
bot.action(/^seriousness:([1-5])$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.seriousness = Number(ctx.match[1]); await finishPreferences(ctx); });

const port = Number(process.env.PORT || 3000);
const healthServer = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    return response.end(JSON.stringify({ status: 'ok', service: 'twinny-bot' }));
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  return response.end(JSON.stringify({ error: 'not_found' }));
});

async function notifyExistingStudents() {
  const { data, error } = await db.from('profiles').select('telegram_id').is('sessions_per_week', null).is('preferences_notified_at', null).limit(500);
  if (error) return console.error('Could not find profiles needing preference updates:', error.message);
  for (const student of data) {
    try {
      await bot.telegram.sendMessage(student.telegram_id, '✨ أضفنا أسئلة جديدة حتى نطلع لك شريك دراسة أدق. حدّث بياناتك بدقيقتين.', buttons([['📝 تحديث بياناتي', 'update_preferences']]));
      await db.from('profiles').update({ preferences_notified_at: new Date().toISOString() }).eq('telegram_id', student.telegram_id);
    } catch (error) {
      console.error(`Could not notify ${student.telegram_id}:`, error.message);
    }
  }
}

healthServer.listen(port, '0.0.0.0', () => console.log(`Health check listening on :${port}`));
bot.launch().then(async () => {
  console.log('Twinny bot is running with long polling.');
  await notifyExistingStudents();
});
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
