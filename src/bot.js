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
  exam: 'تحضير للامتحانات', routine: 'التزام بروتين', assignments: 'واجبات ومشاريع', revise: 'مراجعة'
};
const aliasFirst = ['نور', 'أفق', 'نجمة', 'قمر', 'ورد', 'فجر', 'نهر', 'سحاب', 'رونق', 'صفاء'];
const aliasLast = ['المجتهد', 'الهادئ', 'الطموح', 'المثابر', 'المنظم', 'الفضولي', 'المبدع', 'المرتاح'];
const buttons = (items) => Markup.inlineKeyboard(items.map(([text, value]) => [Markup.button.callback(text, value)]));
const menu = Markup.keyboard([['🔎 ابحث عن شريك', '🤝 طلباتي'], ['✉️ راسل شريكاً', '🔐 كشف هويتي'], ['📋 مهامنا', '➕ مهمة'], ['⏱️ جلسة دراسة', '👤 ملفي'], ['⭐ قيّم شريكاً', '🗑️ حذف حسابي']]).resize();

function aliasFor(id) {
  const n = Math.abs(Number(BigInt(id) % 10000n));
  return `${aliasFirst[n % aliasFirst.length]} ${aliasLast[Math.floor(n / aliasFirst.length) % aliasLast.length]} ${String(n).padStart(4, '0')}`;
}
function ageFrom(year) { return new Date().getFullYear() - Number(year); }
function score(me, candidate) {
  let value = 20;
  if (me.city.trim().toLowerCase() === candidate.city.trim().toLowerCase()) value += 22;
  if (me.university.trim().toLowerCase() === candidate.university.trim().toLowerCase()) value += 24;
  if (me.major.trim().toLowerCase() === candidate.major.trim().toLowerCase()) value += 16;
  if (me.academic_year === candidate.academic_year) value += 8;
  if (me.study_time === candidate.study_time) value += 5;
  if (me.learning_style === candidate.learning_style) value += 3;
  if (Math.abs(ageFrom(me.birth_year) - ageFrom(candidate.birth_year)) <= 2) value += 2;
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
  return ctx.reply('أهلاً بك في Twinny 👋\nاسمك الحقيقي يُحفظ داخل النظام فقط ولن يظهر في الاقتراحات.\n\nاكتب اسمك الحقيقي:');
}
async function finishRegistration(ctx) {
  const form = ctx.session.form;
  const row = { telegram_id: ctx.from.id, pseudonym: aliasFor(ctx.from.id), ...form };
  const { error } = await db.from('profiles').upsert(row, { onConflict: 'telegram_id' });
  if (error) throw error;
  ctx.session = {};
  await ctx.reply(`تم إنشاء ملفك بنجاح ✅\nاسمك الظاهر للطلاب: ${row.pseudonym}\n\nنطابقك فقط مع طلاب من نفس الجنس، ولا نعرض اسمك الحقيقي.`, menu);
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
  await ctx.reply(`ملفك\nالاسم الظاهر: ${me.pseudonym}\n${me.major} · ${me.academic_year}\n${me.university}، ${me.city}\nوقت الدراسة: ${labels[me.study_time]}\nأسلوبك: ${labels[me.learning_style]}`, menu);
});
bot.command('find', findMatches);
bot.command('matches', showConnections);
bot.command('rate', ratePartner);

async function findMatches(ctx) {
  const me = await ensureRegistered(ctx); if (!me) return;
  const { data: people, error } = await db.from('profiles').select('*').eq('gender', me.gender).eq('is_active', true).neq('telegram_id', me.telegram_id);
  if (error) throw error;
  const candidates = people.sort((a, b) => score(me, b) - score(me, a)).slice(0, 3);
  if (!candidates.length) return ctx.reply('حالياً ماكو طالب مناسب ضمن نفس الجنس. جرّب لاحقاً، واحنا نوسع المجتمع يومياً.', menu);
  for (const person of candidates) {
    const { data: ratings } = await db.from('ratings').select('stars, commitment').eq('reviewed_telegram_id', person.telegram_id);
    const average = ratings?.length ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1) : 'جديد';
    const committed = ratings?.filter((r) => r.commitment === 'committed').length ?? 0;
    await ctx.reply(`👤 ${person.pseudonym}\n${person.major} · ${person.academic_year}\n${person.university}، ${person.city}\n⏰ ${labels[person.study_time]} · 🧠 ${labels[person.learning_style]}\n✨ توافق ${score(me, person)}٪\n⭐ التقييم: ${average}${average === 'جديد' ? '' : ` / 5 (${ratings.length} تقييم، ملتزم: ${committed})`}`, buttons([['أرسل طلب تعارف 🤝', `request:${person.telegram_id}`]]));
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
      ? buttons([['أقبل ✅', `accept:${item.id}`], ['أرفض', `reject:${item.id}`]]) : undefined;
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
  if (ctx.session?.flow !== 'register') return;
  const s = ctx.session;
  if (s.step === 'real_name') { s.form.real_name = text; s.step = 'gender'; return ctx.reply('حدّد جنسك. هذا يُستخدم حصراً لمنع أي اقتراح بين الجنسين:', buttons([['بنت', 'gender:female'], ['ولد', 'gender:male']])); }
  if (s.step === 'birth_year') { const year = Number(text); if (!Number.isInteger(year) || ageFrom(year) < 16 || ageFrom(year) > 60) return ctx.reply('اكتب سنة ميلاد صحيحة (العمر المسموح من 16 إلى 60).'); s.form.birth_year = year; s.step = 'city'; return ctx.reply('اكتب مدينتك:'); }
  if (s.step === 'city') { s.form.city = text; s.step = 'university'; return ctx.reply('اكتب اسم الجامعة أو المعهد:'); }
  if (s.step === 'university') { s.form.university = text; s.step = 'major'; return ctx.reply('اكتب تخصصك:'); }
  if (s.step === 'major') { s.form.major = text; s.step = 'academic_year'; return ctx.reply('أي مرحلة دراسية؟', buttons([['الأولى', 'year:الأولى'], ['الثانية', 'year:الثانية'], ['الثالثة', 'year:الثالثة'], ['الرابعة+', 'year:الرابعة فما فوق']])); }
  if (s.step === 'goal') { s.form.goal = text; return finishRegistration(ctx); }
});

// Registration callbacks are separate so all selection questions remain button-only.
bot.action(/^gender:(female|male)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.gender = ctx.match[1]; ctx.session.step = 'birth_year'; await ctx.reply('اكتب سنة ميلادك (مثال: 2004):'); });
bot.action(/^year:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.academic_year = ctx.match[1]; ctx.session.step = 'study_time'; await ctx.reply('متى تفضّل الدراسة غالباً؟', buttons([['صباحاً', 'time:morning'], ['ظهراً', 'time:afternoon'], ['مساءً', 'time:evening'], ['مرن', 'time:flexible']])); });
bot.action(/^time:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.study_time = ctx.match[1]; ctx.session.step = 'learning_style'; await ctx.reply('شنو أسلوبك المفضل؟', buttons([['بصري', 'style:visual'], ['قراءة وكتابة', 'style:reading'], ['نقاش', 'style:discussion'], ['حل أسئلة', 'style:practice']])); });
bot.action(/^style:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.learning_style = ctx.match[1]; ctx.session.step = 'goal'; await ctx.reply('شنو هدفك الأساسي من شريك الدراسة؟ مثال: التزام 3 جلسات بالأسبوع أو تحضير للفاينل'); });

const port = Number(process.env.PORT || 3000);
const healthServer = http.createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    return response.end(JSON.stringify({ status: 'ok', service: 'twinny-bot' }));
  }
  response.writeHead(404, { 'content-type': 'application/json' });
  return response.end(JSON.stringify({ error: 'not_found' }));
});

healthServer.listen(port, '0.0.0.0', () => console.log(`Health check listening on :${port}`));
bot.launch().then(() => console.log('Twinny bot is running with long polling.'));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
