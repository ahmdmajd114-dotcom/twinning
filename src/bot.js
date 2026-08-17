import 'dotenv/config';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
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
  female: 'بنت', male: 'ولد', early_morning: '6–9 صباحاً', morning: '9–12 صباحاً', noon: '12–3 ظهراً', afternoon: '3–6 عصراً', evening: '6–9 مساءً', night: '9–12 ليلاً', flexible: 'مرن',
  visual: 'بصري', reading: 'قراءة وكتابة', discussion: 'نقاش', practice: 'تطبيق وحل أسئلة',
  exam: 'تحضير للامتحانات', routine: 'التزام بروتين', assignments: 'واجبات ومشاريع', revise: 'مراجعة',
  online: 'أونلاين', in_person: 'حضوري', both: 'أونلاين وحضوري',
  study: 'مذاكرة فعلية', accountability: 'التزام ومتابعة',
  call: 'يفضّل مكالمة', no_call: 'بدون مكالمة', prefer: 'يحب القراءة بصوت عالٍ', okay: 'عادي عنده', no: 'لا يفضّلها',
  sessions: 'جلسات بالأسبوع',
  25: '25 دقيقة', 30: '30 دقيقة', 45: '45 دقيقة', 50: '50 دقيقة', 60: 'ساعة', 90: 'ساعة ونصف', 120: 'ساعتان'
};
const buttons = (items) => Markup.inlineKeyboard(items.map(([text, value]) => [Markup.button.callback(text, value)]));
const grid = (items, columns = 2) => Markup.inlineKeyboard(Array.from({ length: Math.ceil(items.length / columns) }, (_, index) => items.slice(index * columns, index * columns + columns).map(([text, value]) => Markup.button.callback(text, value))));
const IRAQI_GOVERNORATES = ['بغداد', 'البصرة', 'نينوى', 'أربيل', 'السليمانية', 'دهوك', 'كركوك', 'الأنبار', 'بابل', 'كربلاء', 'النجف', 'القادسية', 'ذي قار', 'ميسان', 'المثنى', 'واسط', 'صلاح الدين', 'ديالى', 'حلبجة'];
const ARAB_COUNTRIES = ['الأردن', 'الإمارات', 'البحرين', 'الجزائر', 'السعودية', 'السودان', 'الصومال', 'العراق', 'عُمان', 'فلسطين', 'قطر', 'الكويت', 'لبنان', 'ليبيا', 'مصر', 'المغرب', 'موريتانيا', 'اليمن', 'تونس', 'جزر القمر', 'جيبوتي', 'سوريا'];
const IRAQI_UNIVERSITIES = [
  'جامعة بغداد', 'الجامعة المستنصرية', 'الجامعة التكنولوجية', 'جامعة النهرين', 'الجامعة العراقية', 'جامعة ابن سينا للعلوم الطبية والصيدلانية',
  'جامعة البصرة', 'جامعة البصرة للنفط والغاز', 'جامعة الموصل', 'جامعة نينوى', 'جامعة الأنبار', 'جامعة الفلوجة',
  'جامعة الكوفة', 'جامعة القادسية', 'جامعة واسط', 'جامعة ديالى', 'جامعة بابل', 'جامعة كربلاء', 'جامعة ذي قار', 'جامعة ميسان', 'جامعة المثنى', 'جامعة تكريت', 'جامعة كركوك', 'جامعة سامراء', 'جامعة سومر', 'جامعة القاسم الخضراء', 'جامعة الشطرة',
  'الجامعة التقنية الوسطى', 'الجامعة التقنية الشمالية', 'الجامعة التقنية الجنوبية', 'جامعة الفرات الأوسط التقنية', 'جامعة تكنولوجيا المعلومات والاتصالات',
  'جامعة صلاح الدين - أربيل', 'جامعة السليمانية', 'جامعة دهوك', 'جامعة حلبجة', 'جامعة كوية', 'جامعة سوران', 'جامعة رابرين', 'جامعة كرميان', 'جامعة زاخو', 'جامعة جمجمال'
];
const IRAQI_PRIVATE_INSTITUTIONS = ['جامعة المستقبل', 'جامعة وارث الأنبياء', 'جامعة العميد', 'جامعة الكفيل', 'جامعة العين العراقية', 'جامعة المعارف', 'جامعة الإسراء', 'جامعة البيان', 'جامعة الفراهيدي', 'جامعة الإمام جعفر الصادق', 'جامعة أهل البيت', 'جامعة الحلة', 'جامعة النور', 'جامعة الكوت', 'كلية التراث الجامعة', 'كلية المنصور الجامعة', 'كلية الرافدين الجامعة', 'كلية المأمون الجامعة', 'كلية شط العرب الجامعة', 'كلية دجلة الجامعة', 'كلية اليرموك الجامعة', 'كلية الحدباء الجامعة', 'كلية السلام الجامعة', 'كلية بغداد للعلوم الطبية', 'كلية بغداد للعلوم الاقتصادية', 'كلية الشيخ الطوسي الجامعة', 'كلية الحسين الجامعة', 'كلية الطف الجامعة', 'كلية الزهراوي الجامعة'];
const CORE_MAJORS = ['طب عام', 'طب أسنان', 'صيدلة', 'تمريض', 'علوم طبية', 'طب بيطري', 'هندسة', 'علوم الحاسوب / تقنية معلومات', 'علوم', 'قانون', 'إدارة واقتصاد', 'تربية', 'زراعة'];
const WEEK_DAYS = [['sat', 'السبت'], ['sun', 'الأحد'], ['mon', 'الاثنين'], ['tue', 'الثلاثاء'], ['wed', 'الأربعاء'], ['thu', 'الخميس'], ['fri', 'الجمعة']];
const AVAILABILITY_SLOTS = [['early_morning', '6–9 صباحاً'], ['morning', '9–12 صباحاً'], ['noon', '12–3 ظهراً'], ['afternoon', '3–6 عصراً'], ['evening', '6–9 مساءً'], ['night', '9–12 ليلاً'], ['flexible', 'مرن']];
const menu = Markup.keyboard([
  ['🔎 ابحث عن شريك', '🤝 طلباتي'],
  ['⚡ جاهز أدرس هسة', '⏱️ جلسة دراسة'],
  ['🧩 حل أسئلة', '📋 مهامنا'],
  ['➕ مهمة', '🔔 ضبط تذكير'],
  ['📊 تقريرنا', '✉️ راسل شريكاً'],
  ['🔐 كشف هويتي', '📝 تحديث بياناتي'],
  ['👤 ملفي', '⭐ قيّم شريكاً'],
  ['🗑️ حذف حسابي']
]).resize();

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
  if (key.includes('طباسنان') || key.includes('اسنان')) return 'طباسنان';
  if (key.includes('صيدل')) return 'صيدله';
  if (key.includes('طببيطري') || key.includes('بيطري')) return 'طببيطري';
  if (key.includes('علومطبي') || key.includes('تقنياتطبي')) return 'علومطبيه';
  if (key.includes('طب') || key.includes('بشري')) return 'طبعام';
  if (key.includes('تمريض')) return 'تمريض';
  if (key.includes('هندس')) return key === 'هندسه' ? 'هندسه' : `هندسه:${key.replace('هندسه', '')}`;
  if (key.includes('حاسوب') || key.includes('تقنيه') || key.includes('برمج')) return 'حاسوبوتقنيه';
  if (key.includes('اداره') || key.includes('اقتصاد') || key.includes('محاسب') || key.includes('مالي')) return 'ادارهواقتصاد';
  if (key.includes('قانون')) return 'قانون';
  if (key.includes('تربي') || key.includes('تعليم')) return 'تربيه';
  if (key.includes('زراع')) return 'زراعه';
  return `custom:${key}`;
}
function hasCompatibleMajor(left, right) { return majorKey(left) === majorKey(right); }
function countryKey(value = '') { return normalise(value); }
function studyFocusKey(value = '') { return normalise(value); }
function meaningfulWords(value = '') {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).map(normalise).filter((word) => word.length >= 3);
}
function studyTags(value = '') {
  const text = normalise(value);
  const groups = {
    exams: ['امتحان', 'فاينل', 'نهائي', 'وزاري', 'ميد', 'اختبار'],
    board: ['بورد', 'اقامه', 'زماله', 'residency'],
    equivalency: ['معادله', 'usmle', 'plab', 'ifom'],
    routine: ['التزام', 'روتين', 'متابعه', 'جدول', 'استمراريه'],
    revision: ['مراجعه', 'ريفجن', 'تلخيص'],
    questions: ['اسئله', 'mcq', 'تطبيق', 'حل'],
    assignments: ['واجب', 'مشروع', 'بحث', 'تقرير'],
    discussion: ['نقاش', 'مناقشه', 'شرح'],
    reading: ['قراءه', 'محاضره', 'ملازم']
  };
  return new Set(Object.entries(groups).filter(([, words]) => words.some((word) => text.includes(normalise(word)))).map(([tag]) => tag));
}
function hasSharedStudyGoal(left, right) {
  const leftTags = studyTags(left); const rightTags = studyTags(right);
  if ([...leftTags].some((tag) => rightTags.has(tag))) return true;
  const leftWords = new Set(meaningfulWords(left));
  return meaningfulWords(right).some((word) => [...leftWords].some((other) => word === other || (word.length >= 5 && other.length >= 5 && (word.startsWith(other.slice(0, 4)) || other.startsWith(word.slice(0, 4))))));
}
function compatibleChoice(left, right, flexible = 'both') {
  return Boolean(left && right && (left === right || left === flexible || right === flexible));
}
function sharedValues(left, right) {
  const leftValues = Array.isArray(left) ? left : [];
  const rightValues = new Set(Array.isArray(right) ? right : []);
  return leftValues.filter((value) => rightValues.has(value));
}
function availabilitySummary(profile) {
  const days = sharedValues(profile.available_days, WEEK_DAYS.map(([id]) => id)).map((id) => WEEK_DAYS.find(([day]) => day === id)?.[1]).filter(Boolean);
  const slots = sharedValues(profile.available_slots, AVAILABILITY_SLOTS.map(([id]) => id)).map((id) => labels[id]).filter(Boolean);
  return [...days, ...slots].join(' · ');
}
function aiProfile(profile, id) {
  return {
    id,
    country: countryKey(profile.country || 'العراق'),
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
    seriousness: profile.seriousness,
    available_days: Array.isArray(profile.available_days) ? profile.available_days : [],
    available_slots: Array.isArray(profile.available_slots) ? profile.available_slots : [],
    call_preference: profile.call_preference,
    aloud_reading_preference: profile.aloud_reading_preference,
    reliability: profile.reliability ?? 50
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
          { role: 'system', content: 'You rank study-partner candidates. Hard safety filters were already applied; never infer gender or add candidates. Rank primarily by overlapping available_days and available_slots, then goals, commitment/reliability, learning style, academic stage, location, university, current study focus, and previous-course grades. Grades should improve compatibility only when they indicate relevant shared subjects or comparable academic needs; never mention exact grades in the reason. Return ONLY lines in this exact format, one for every candidate and nothing else: c1 | سبب عربي قصير. Make each reason at most 18 Arabic words.' },
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
async function enrichReliability(candidate) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: ratings, error: ratingsError }, { data: sessions, error: sessionsError }, { data: reminders, error: remindersError }] = await Promise.all([
    db.from('ratings').select('stars, commitment').eq('reviewed_telegram_id', candidate.telegram_id).gte('created_at', since),
    db.from('study_sessions').select('status, starter_telegram_id, starter_completed_at, recipient_telegram_id, recipient_completed_at').or(`starter_telegram_id.eq.${candidate.telegram_id},recipient_telegram_id.eq.${candidate.telegram_id}`).gte('started_at', since),
    db.from('study_reminders').select('id').or(`creator_telegram_id.eq.${candidate.telegram_id},recipient_telegram_id.eq.${candidate.telegram_id}`).gte('reminder_at', since)
  ]);
  if (ratingsError || sessionsError || remindersError) return { ...candidate, reliability: 50 };
  let total = 0; let weight = 0;
  if (ratings?.length) {
    const stars = ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length;
    const commitment = ratings.filter((rating) => rating.commitment === 'committed').length / ratings.length;
    total += ((stars / 5) * 0.7 + commitment * 0.3) * 45; weight += 45;
  }
  if (sessions?.length) {
    const completed = sessions.filter((row) => row.status === 'completed').length / sessions.length;
    const reflected = sessions.filter((row) => row.starter_telegram_id === candidate.telegram_id ? row.starter_completed_at : row.recipient_completed_at).length / sessions.length;
    total += (completed * 0.55 + reflected * 0.45) * 40; weight += 40;
  }
  if (reminders?.length) {
    const ids = reminders.map((reminder) => reminder.id);
    const { data: checkins } = await db.from('reminder_checkins').select('reminder_id').eq('telegram_id', candidate.telegram_id).in('reminder_id', ids);
    total += ((checkins?.length || 0) / reminders.length) * 15; weight += 15;
  }
  return { ...candidate, reliability: weight ? Math.round((total / weight) * 100) : 50 };
}
function score(me, candidate) {
  let value = 20;
  const sameCountry = countryKey(me.country || 'العراق') === countryKey(candidate.country || 'العراق');
  if (sameCountry) value += 5;
  if (sameCountry && governorateKey(me.city) === governorateKey(candidate.city)) value += 7;
  if (universityKey(me.university) === universityKey(candidate.university)) value += 9;
  if (hasCompatibleMajor(me.major, candidate.major)) value += 8;
  if (me.academic_year === candidate.academic_year) value += 7;
  if (me.study_focus && candidate.study_focus && studyFocusKey(me.study_focus) === studyFocusKey(candidate.study_focus)) value += 8;
  if (hasSharedStudyGoal(me.goal, candidate.goal)) value += 7;
  const sharedDays = sharedValues(me.available_days, candidate.available_days).length;
  const sharedSlots = sharedValues(me.available_slots, candidate.available_slots).length;
  if (sharedDays) value += Math.min(12, sharedDays * 4);
  if (sharedSlots) value += Math.min(12, sharedSlots * 5);
  if (!sharedSlots && me.study_time === candidate.study_time) value += 4;
  if (me.learning_style === candidate.learning_style) value += 3;
  if (Math.abs(ageFrom(me.birth_year) - ageFrom(candidate.birth_year)) <= 2) value += 2;
  if (me.study_mode && me.study_mode === candidate.study_mode) value += 5;
  if (me.partner_preference && me.partner_preference === candidate.partner_preference) value += 3;
  if (me.sessions_per_week && Math.abs(me.sessions_per_week - candidate.sessions_per_week) <= 1) value += 3;
  if (me.seriousness && Math.abs(me.seriousness - candidate.seriousness) <= 1) value += 2;
  if (compatibleChoice(me.call_preference, candidate.call_preference)) value += 4;
  if (me.aloud_reading_preference && candidate.aloud_reading_preference && me.aloud_reading_preference === candidate.aloud_reading_preference) value += 3;
  value += Math.round(((candidate.reliability ?? 50) - 50) * 0.12);
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
function showLocationChoice(ctx) {
  return ctx.reply('وين تدرس؟', grid([['العراق 🇮🇶', 'location:iraq'], ['دولة عربية 🌍', 'location:arab'], ['دولة أخرى 🌐', 'location:other']]));
}
function showUniversityGroup(ctx) {
  return ctx.reply('اختَر الجامعة أو المعهد:', grid([['جامعات حكومية', 'uni_group:public'], ['جامعات إقليم كردستان', 'uni_group:regional'], ['جامعة/كلية أهلية', 'uni_group:private'], ['جامعتي غير موجودة ✏️', 'uni_group:custom']]));
}
function showMajorChoice(ctx) {
  return ctx.reply('اختَر تخصصك:', grid([...CORE_MAJORS.map((value, index) => [value, `major:${index}`]), ['تخصص آخر ✏️', 'major:custom']]));
}
function showAcademicYearChoice(ctx, prefix = 'year') {
  return ctx.reply('أي مرحلة دراسية؟', grid([['الأولى', `${prefix}:الأولى`], ['الثانية', `${prefix}:الثانية`], ['الثالثة', `${prefix}:الثالثة`], ['الرابعة', `${prefix}:الرابعة`], ['الخامسة', `${prefix}:الخامسة`], ['السادسة', `${prefix}:السادسة`], ['خريج/ة 🎓', `${prefix}:خريج/ة`], ['تحضير بورد/إقامة 🩺', `${prefix}:تحضير بورد/إقامة`], ['تحديد آخر ✏️', `${prefix}:custom`]]));
}
function showStudyTimeChoice(ctx, prefix = 'time') {
  return ctx.reply('متى تفضّل الدراسة غالباً؟', grid([['6–9 صباحاً', `${prefix}:early_morning`], ['9–12 صباحاً', `${prefix}:morning`], ['12–3 ظهراً', `${prefix}:noon`], ['3–6 عصراً', `${prefix}:afternoon`], ['6–9 مساءً', `${prefix}:evening`], ['9–12 ليلاً', `${prefix}:night`], ['مرن', `${prefix}:flexible`], ['وقت آخر ✏️', `${prefix}:custom`]]));
}
function startRegistration(ctx) {
  ctx.session = { flow: 'register', step: 'real_name', form: {} };
  return ctx.reply('أهلاً بك في Twinny 👋\nيلا ندخل بياناتك حتى نجد لك أفضل شريك دراسي مناسب.\n\nاكتب اسمك الحقيقي:');
}
async function startPreferenceQuestions(ctx, flow, form = {}) {
  ctx.session = { flow, step: 'sessions_per_week', form };
  return ctx.reply('كم جلسة دراسة تريد بالأسبوع؟', buttons([['جلسة واحدة', 'sessions:1'], ['جلستان', 'sessions:2'], ['3 جلسات', 'sessions:3'], ['4 جلسات', 'sessions:4'], ['5 جلسات أو أكثر', 'sessions:5']]));
}
async function renderAvailabilityDays(ctx, edit = false) {
  const selected = new Set(ctx.session.form.available_days || []);
  const items = [...WEEK_DAYS.map(([id, label]) => [`${selected.has(id) ? '✅ ' : ''}${label}`, `availability_day:${id}`]), ['تم اختيار الأيام ✅', 'availability_days_done']];
  const text = `اختَر الأيام التي تقدر تدرس بها (تگدر تختار أكثر من يوم):\n${selected.size ? `المختار: ${[...selected].map((id) => WEEK_DAYS.find(([day]) => day === id)?.[1]).join('، ')}` : 'ما اخترت أيام بعد.'}`;
  const markup = grid(items);
  if (!edit) return ctx.reply(text, markup);
  try { return await ctx.editMessageText(text, markup); } catch { return ctx.reply(text, markup); }
}
async function renderAvailabilitySlots(ctx, edit = false) {
  const selected = new Set(ctx.session.form.available_slots || []);
  const items = [...AVAILABILITY_SLOTS.map(([id, label]) => [`${selected.has(id) ? '✅ ' : ''}${label}`, `availability_slot:${id}`]), ['تم اختيار الأوقات ✅', 'availability_slots_done']];
  const text = `اختَر الأوقات المتاحة غالباً (تگدر تختار أكثر من وقت):\n${selected.size ? `المختار: ${[...selected].map((id) => labels[id]).join('، ')}` : 'ما اخترت أوقات بعد.'}`;
  const markup = grid(items);
  if (!edit) return ctx.reply(text, markup);
  try { return await ctx.editMessageText(text, markup); } catch { return ctx.reply(text, markup); }
}
async function startAvailabilityQuestions(ctx, flow, form = {}) {
  ctx.session = { flow, step: 'availability_days', form: { ...form, available_days: form.available_days || [], available_slots: form.available_slots || [] } };
  return renderAvailabilityDays(ctx);
}
async function showUpdateMenu(ctx) {
  return ctx.reply('شنو تحب تحدّث من بياناتك؟', Markup.inlineKeyboard([
    [Markup.button.callback('الاسم الحقيقي', 'edit:real_name'), Markup.button.callback('المكان', 'edit:location')],
    [Markup.button.callback('الجامعة / المعهد', 'edit:university'), Markup.button.callback('التخصص', 'edit:major')],
    [Markup.button.callback('المرحلة الدراسية', 'edit:academic_year'), Markup.button.callback('وقت الدراسة', 'edit:study_time')],
    [Markup.button.callback('أسلوب التعلّم', 'edit:learning_style'), Markup.button.callback('الهدف الدراسي', 'edit:goal')],
    [Markup.button.callback('شنو تدرس/تحضّر؟', 'edit:study_focus'), Markup.button.callback('التقديرات السابقة', 'edit:previous_grades')],
    [Markup.button.callback('تفضيلات التوافق', 'edit:preferences'), Markup.button.callback('الأيام والأوقات المتاحة', 'edit:availability')],
    [Markup.button.callback('الجنس', 'edit:gender'), Markup.button.callback('سنة الميلاد', 'edit:birth_year')],
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
  await ctx.reply(`ملفك\nالاسم الظاهر: ${me.pseudonym}\n${me.major} · ${me.academic_year}\n${me.university}، ${me.country || 'العراق'} · ${me.city}\n🎯 غايتك الرئيسية: ${me.goal}${me.study_focus ? `\nتدرس/تحضّر: ${me.study_focus}` : ''}${me.previous_grades ? `\nتقديراتك السابقة: ${me.previous_grades}` : ''}\nوقت الدراسة: ${labels[me.study_time] || me.study_time}\nأسلوبك: ${labels[me.learning_style]}${me.sessions_per_week ? `\n${me.sessions_per_week} جلسات/أسبوع · ${labels[me.study_mode] || me.study_mode}\n🤝 شنو تريده من الشريك: ${me.partner_preference === 'both' ? 'مذاكرة فعلية والتزام ومتابعة' : labels[me.partner_preference] || 'لم يحدّد'}` : '\n📝 حدّث بياناتك حتى نحسن التوافق.'}${availabilitySummary(me) ? `\n🗓 توفرك: ${availabilitySummary(me)}` : '\n🗓 حدّد أيامك وأوقاتك المتاحة حتى تقوى التوأمة.'}`, menu);
});
bot.command('find', findMatches);
bot.command('matches', showConnections);
bot.command('rate', ratePartner);

async function findMatches(ctx) {
  const me = await ensureRegistered(ctx); if (!me) return;
  return ctx.reply('شلون تحب تبحث عن شريك دراسة؟', Markup.inlineKeyboard([
    [Markup.button.callback('🤖 اختيار بواسطة Twinny', 'match_mode:bot')],
    [Markup.button.callback('👥 عرض كل المتاحين بلا شريك', 'match_mode:all')],
    [Markup.button.callback('⚙️ بحث بمعايير أحددها', 'match_mode:criteria')]
  ]));
}

const MATCH_CRITERIA = [
  ['university', 'الجامعة / المعهد'], ['age', 'العمر (فرق سنتين أو أقل)'], ['city', 'المحافظة'],
  ['academic_year', 'المرحلة أو حالة التخرج'], ['goal', 'الغاية الدراسية'], ['availability', 'الأيام والأوقات'],
  ['learning_style', 'أسلوب التعلّم'], ['study_mode', 'نمط الدراسة'], ['partner_preference', 'ما تريده من الشريك'],
  ['seriousness', 'مستوى الجدية'], ['call', 'تفضيل المكالمة'], ['aloud', 'القراءة بصوت عالٍ']
];

function renderMatchCriteria(ctx, edit = false) {
  const selected = new Set(ctx.session?.criteria || []);
  const items = [
    ...MATCH_CRITERIA.map(([id, label]) => [`${selected.has(id) ? '✅ ' : ''}${label}`, `match_criterion:${id}`]),
    ['🔎 اعرض النتائج', 'match_criteria_done'], ['تصفير الاختيارات', 'match_criteria_clear']
  ];
  const text = `اختَر المعايير التي تريدها. تگدر تختار كلها أو بعضها؛ التخصص والجنس يبقون شرط أمان ثابت.\n\n${selected.size ? `المختار: ${[...selected].map((id) => MATCH_CRITERIA.find(([key]) => key === id)?.[1]).join('، ')}` : 'ما مختار معيار بعد — اضغط المعايير ثم «اعرض النتائج».'}`;
  const markup = grid(items);
  if (!edit) return ctx.reply(text, markup);
  return ctx.editMessageText(text, markup).catch(() => ctx.reply(text, markup));
}

function matchesCriteria(me, candidate, criteria) {
  return criteria.every((criterion) => {
    if (criterion === 'university') return universityKey(me.university) === universityKey(candidate.university);
    if (criterion === 'age') return Math.abs(ageFrom(me.birth_year) - ageFrom(candidate.birth_year)) <= 2;
    if (criterion === 'city') return countryKey(me.country || 'العراق') === countryKey(candidate.country || 'العراق') && governorateKey(me.city) === governorateKey(candidate.city);
    if (criterion === 'academic_year') return me.academic_year === candidate.academic_year;
    if (criterion === 'goal') return hasSharedStudyGoal(me.goal, candidate.goal) || (me.study_focus && candidate.study_focus && studyFocusKey(me.study_focus) === studyFocusKey(candidate.study_focus));
    if (criterion === 'availability') return sharedValues(me.available_days, candidate.available_days).length > 0 && sharedValues(me.available_slots, candidate.available_slots).length > 0;
    if (criterion === 'learning_style') return me.learning_style === candidate.learning_style;
    if (criterion === 'study_mode') return compatibleChoice(me.study_mode, candidate.study_mode);
    if (criterion === 'partner_preference') return compatibleChoice(me.partner_preference, candidate.partner_preference);
    if (criterion === 'seriousness') return me.seriousness && candidate.seriousness && Math.abs(me.seriousness - candidate.seriousness) <= 1;
    if (criterion === 'call') return compatibleChoice(me.call_preference, candidate.call_preference);
    if (criterion === 'aloud') return me.aloud_reading_preference && candidate.aloud_reading_preference && me.aloud_reading_preference === candidate.aloud_reading_preference;
    return true;
  });
}

async function availablePeople(me, { onlyWithoutPartner = false, criteria = [] } = {}) {
  const { data: people, error } = await db.from('profiles').select('*').eq('gender', me.gender).eq('is_active', true).neq('telegram_id', me.telegram_id);
  if (error) throw error;
  let candidates = people.filter((person) => hasCompatibleMajor(me.major, person.major));
  if (onlyWithoutPartner) {
    const { data: connections, error: connectionsError } = await db.from('connections').select('requester_telegram_id, recipient_telegram_id').eq('status', 'accepted');
    if (connectionsError) throw connectionsError;
    const partnered = new Set((connections || []).flatMap((connection) => [String(connection.requester_telegram_id), String(connection.recipient_telegram_id)]));
    candidates = candidates.filter((person) => !partnered.has(String(person.telegram_id)));
  }
  candidates = candidates.filter((person) => matchesCriteria(me, person, criteria));
  return Promise.all(candidates.map(enrichReliability));
}

function matchedCriteriaCount(me, candidate, criteria = []) {
  return criteria.filter((criterion) => matchesCriteria(me, candidate, [criterion])).length;
}

async function sendCandidateCards(ctx, me, candidates, { heading, showScore = false, criteria = [] } = {}) {
  if (!candidates.length) return ctx.reply('ما لكينا أحد يطابق هالاختيارات حالياً. جرّب تقلل بعض المعايير أو ارجع لاحقاً.', menu);
  if (heading) await ctx.reply(heading);
  for (const person of candidates) {
    const { data: ratings } = await db.from('ratings').select('stars, commitment').eq('reviewed_telegram_id', person.telegram_id);
    const average = ratings?.length ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1) : 'جديد';
    const committed = ratings?.filter((r) => r.commitment === 'committed').length ?? 0;
    const studyFocus = person.study_focus ? `\n📖 يدرس/يحضّر: ${person.study_focus}` : '';
    const grades = person.previous_grades ? `\n📊 التقديرات السابقة: ${person.previous_grades}` : '';
    const preferences = person.sessions_per_week
      ? `\n📅 الجلسات: ${person.sessions_per_week} بالأسبوع · ${labels[person.session_duration] || `${person.session_duration} دقيقة`}\n💻 نمط الدراسة: ${labels[person.study_mode] || person.study_mode}\n🤝 يريد من الشريك: ${person.partner_preference === 'both' ? 'الاثنين' : labels[person.partner_preference]}\n🎥 المكالمة: ${labels[person.call_preference] || 'لم يحدّد'}\n🗣 القراءة بصوت عالٍ: ${labels[person.aloud_reading_preference] || 'لم يحدّد'}\n⭐ مستوى الجدية: ${'⭐'.repeat(person.seriousness)}`
      : '\n📝 لم يحدّث تفضيلات الدراسة بعد.';
    const availability = availabilitySummary(person) ? `\n🗓 التوفر: ${availabilitySummary(person)}` : '\n🗓 لم يحدّد أيامه وأوقاته بعد.';
    const rating = average === 'جديد' ? 'جديد — لا توجد تقييمات بعد' : `${average} / 5 · ${ratings.length} تقييم · ملتزم: ${committed}`;
    const criteriaMatch = criteria.length ? `\n🧩 يطابق ${matchedCriteriaCount(me, person, criteria)}/${criteria.length} من المعايير التي اخترتها` : '';
    await ctx.reply(`👤 شريك دراسة\n━━━━━━━━━━━━\n🏷 الاسم الظاهر: ${person.pseudonym}\n🎓 التخصص والمرحلة: ${person.major} · ${person.academic_year}\n🏛 الجامعة: ${person.university}\n📍 المكان: ${person.country || 'العراق'} · ${person.city}\n🎯 الغاية الرئيسية: ${person.goal}${studyFocus}${grades}\n━━━━━━━━━━━━\n⏰ وقت الدراسة: ${labels[person.study_time] || person.study_time}\n🧠 أسلوب الدراسة: ${labels[person.learning_style]}${preferences}${availability}\n🏅 مؤشر الالتزام الفعلي: ${person.reliability}٪${criteriaMatch}${showScore ? `\n━━━━━━━━━━━━\n✨ نسبة التوافق: ${score(me, person)}٪` : ''}\n⭐ التقييم: ${rating}`, buttons([['أرسل طلب تعارف 🤝', `request:${person.telegram_id}`]]));
  }
}

async function incomingRequestProfileText(person) {
  const { data: ratings, error } = await db.from('ratings').select('stars, commitment').eq('reviewed_telegram_id', person.telegram_id);
  if (error) throw error;
  const average = ratings?.length ? (ratings.reduce((sum, rating) => sum + rating.stars, 0) / ratings.length).toFixed(1) : 'جديد';
  const committed = ratings?.filter((rating) => rating.commitment === 'committed').length ?? 0;
  const preferences = person.sessions_per_week
    ? `\n📅 الجلسات: ${person.sessions_per_week} بالأسبوع · ${labels[person.session_duration] || `${person.session_duration} دقيقة`}\n💻 نمط الدراسة: ${labels[person.study_mode] || person.study_mode}\n🤝 يريد من الشريك: ${person.partner_preference === 'both' ? 'الاثنين' : labels[person.partner_preference]}\n🎥 المكالمة: ${labels[person.call_preference] || 'لم يحدّد'}\n🗣 القراءة بصوت عالٍ: ${labels[person.aloud_reading_preference] || 'لم يحدّد'}\n⭐ مستوى الجدية: ${'⭐'.repeat(person.seriousness || 0)}`
    : '\n📝 لم يحدّث تفضيلات الدراسة بعد.';
  return `🤝 وصلك طلب تعارف دراسي\n━━━━━━━━━━━━\n🏷 الاسم الظاهر: ${person.pseudonym}\n🎓 التخصص والمرحلة: ${person.major} · ${person.academic_year}\n🏛 الجامعة: ${person.university}\n📍 المكان: ${person.country || 'العراق'} · ${person.city}${person.study_focus ? `\n📖 يدرس/يحضّر: ${person.study_focus}` : ''}${person.previous_grades ? `\n📊 التقديرات السابقة: ${person.previous_grades}` : ''}\n━━━━━━━━━━━━\n🎯 الغاية الرئيسية: ${person.goal}\n⏰ وقت الدراسة: ${labels[person.study_time] || person.study_time}\n🧠 أسلوب الدراسة: ${labels[person.learning_style] || person.learning_style}${preferences}${availabilitySummary(person) ? `\n🗓 التوفر: ${availabilitySummary(person)}` : ''}\n━━━━━━━━━━━━\n⭐ التقييم: ${average === 'جديد' ? 'جديد — لا توجد تقييمات بعد' : `${average} / 5 · ${ratings.length} تقييم · ملتزم: ${committed}`}\n\nالاسم الحقيقي يبقى مخفياً إلى أن يختار صاحبه كشفه.`;
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
    if (item.status === 'pending' && item.recipient_telegram_id === me.telegram_id && other) {
      await ctx.reply(await incomingRequestProfileText(other), actions);
    } else await ctx.reply(`${other?.pseudonym ?? 'طالب'} — ${state}`, actions);
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
function baghdadParts(date = new Date()) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baghdad', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
}
function baghdadDay(date) {
  const parts = baghdadParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function nextBaghdadTime(value) {
  const match = value.match(/^(?:الساعة\s*)?(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]); const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const now = new Date(); const parts = baghdadParts(now);
  let date = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour - 3, minute));
  if (date.getTime() <= now.getTime() + 60_000) date = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return date;
}
function durationLabel(minutes) { return `${minutes} دقيقة`; }
function sessionActions(sessionId) {
  return buttons([['أنهي واكتب إنجازي ✅', `session_reflect:${sessionId}`]]);
}
async function createSessionInvite(connectionId, starterId, recipientId, minutes) {
  const { data, error } = await db.from('study_sessions').insert({ connection_id: connectionId, starter_telegram_id: starterId, recipient_telegram_id: recipientId, planned_minutes: minutes, status: 'pending' }).select().single();
  if (error) throw error;
  return data;
}
async function activateStudySession(sessionRow) {
  const acceptedAt = new Date();
  const endsAt = new Date(acceptedAt.getTime() + sessionRow.planned_minutes * 60_000);
  const { data: active, error } = await db.from('study_sessions').update({ status: 'active', accepted_at: acceptedAt.toISOString(), started_at: acceptedAt.toISOString(), ends_at: endsAt.toISOString() }).eq('id', sessionRow.id).eq('status', 'pending').select().maybeSingle();
  if (error) throw error;
  return active;
}
async function announceActiveSession(sessionRow) {
  const starter = await profile(sessionRow.starter_telegram_id);
  const recipient = await profile(sessionRow.recipient_telegram_id);
  const end = new Intl.DateTimeFormat('ar-IQ', { timeZone: 'Asia/Baghdad', hour: 'numeric', minute: '2-digit' }).format(new Date(sessionRow.ends_at));
  const text = `⏱️ بدأت جلستكم المشتركة لمدة ${durationLabel(sessionRow.planned_minutes)}\nتنتهي تقريباً ${end}.\n\nركزوا هسه، وعند النهاية اكتبوا شنو أنجزتم.`;
  await bot.telegram.sendMessage(starter.telegram_id, text, sessionActions(sessionRow.id));
  await bot.telegram.sendMessage(recipient.telegram_id, text, sessionActions(sessionRow.id));
}
async function showTasks(ctx) {
  const connections = await acceptedConnections(ctx.from.id);
  if (!connections.length) return ctx.reply('ماكو مهام مشتركة إلى الآن.', menu);
  const ids = connections.map((c) => c.id);
  const { data, error } = await db.from('study_tasks').select('*').in('connection_id', ids).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  if (!data.length) return ctx.reply('🎉 ماكو مهام بعد. أضفوا أول مهمة مشتركة حتى تتابعون التقدم.', menu);
  for (const task of data) {
    const due = task.due_date ? ` · الاستحقاق: ${task.due_date}` : '';
    const state = task.is_done ? '✅ منجزة' : '🕓 مفتوحة';
    const action = task.is_done ? undefined : buttons([['تم الإنجاز ✅', `done:${task.id}`]]);
    await ctx.reply(`${state}\n📋 ${task.title}${due}`, action);
  }
}
function questionSessionKeyboard(questionSession) {
  const rows = [
    [Markup.button.callback('➕ أرسل سؤال', `question_add:${questionSession.id}`), Markup.button.callback('📚 عرض الأسئلة', `question_list:${questionSession.id}`)],
    [Markup.button.callback('✅ أنهي الجلسة', `question_end:${questionSession.id}`)]
  ];
  if (questionSession.call_mode === 'call' && questionSession.room_url) rows.unshift([Markup.button.url('🎥 ادخلوا المكالمة', questionSession.room_url)]);
  return Markup.inlineKeyboard(rows);
}
async function activeQuestionSessionForUser(id, telegramId) {
  const { data, error } = await db.from('question_sessions').select('*').eq('id', id).eq('status', 'active').maybeSingle();
  if (error) throw error;
  if (!data || (data.creator_telegram_id !== telegramId && data.recipient_telegram_id !== telegramId)) return null;
  return data;
}
async function sendQuestionItem(ctx, questionSession, payload) {
  const partnerId = questionSession.creator_telegram_id === ctx.from.id ? questionSession.recipient_telegram_id : questionSession.creator_telegram_id;
  const { count, error: countError } = await db.from('question_items').select('*', { count: 'exact', head: true }).eq('question_session_id', questionSession.id);
  if (countError) throw countError;
  if ((count || 0) >= questionSession.question_count) {
    await ctx.reply(`وصلتوا العدد المحدد (${questionSession.question_count} سؤال). حلّوا الموجود أو أنهوا الجلسة ✅`);
    return null;
  }
  const row = { question_session_id: questionSession.id, sender_telegram_id: ctx.from.id, body: payload.body, attachment_type: payload.attachmentType || null, attachment_file_id: payload.fileId || null };
  const { data: item, error } = await db.from('question_items').insert(row).select().single();
  if (error) throw error;
  const prefix = `❓ سؤال جديد ضمن «${questionSession.topic}»\n━━━━━━━━━━━━\n`;
  if (payload.attachmentType === 'photo') await bot.telegram.sendPhoto(partnerId, payload.fileId, { caption: `${prefix}${payload.body}` });
  else if (payload.attachmentType === 'document') await bot.telegram.sendDocument(partnerId, payload.fileId, { caption: `${prefix}${payload.body}` });
  else await bot.telegram.sendMessage(partnerId, `${prefix}${payload.body}`);
  await bot.telegram.sendMessage(partnerId, 'لما تحلون السؤال، افتحوا «📚 عرض الأسئلة» وعلّموا عليه.', questionSessionKeyboard(questionSession));
  return item;
}
async function streakFor(connectionId) {
  const { data, error } = await db.from('study_sessions').select('completed_at').eq('connection_id', connectionId).eq('status', 'completed').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(90);
  if (error) throw error;
  const days = new Set(data.map((row) => baghdadDay(new Date(row.completed_at))));
  let streak = 0; let cursor = new Date();
  if (!days.has(baghdadDay(cursor))) cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  while (days.has(baghdadDay(cursor))) { streak += 1; cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000); }
  return streak;
}
async function showWeeklyReport(ctx) {
  const connections = await acceptedConnections(ctx.from.id);
  if (!connections.length) return ctx.reply('يظهر التقرير بعد ما يصير عندك شريك دراسة.', menu);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  for (const connection of connections) {
    const otherId = connection.requester_telegram_id === ctx.from.id ? connection.recipient_telegram_id : connection.requester_telegram_id;
    const other = await profile(otherId);
    const { data: sessions, error: sessionError } = await db.from('study_sessions').select('*').eq('connection_id', connection.id).eq('status', 'completed').gte('completed_at', since);
    if (sessionError) throw sessionError;
    const { data: tasks, error: taskError } = await db.from('study_tasks').select('*').eq('connection_id', connection.id).eq('is_done', true).gte('completed_at', since);
    if (taskError) throw taskError;
    const { data: reminders, error: reminderError } = await db.from('study_reminders').select('id, reminder_at').eq('connection_id', connection.id).gte('reminder_at', since).in('status', ['sent', 'closed']);
    if (reminderError) throw reminderError;
    const reminderIds = reminders.map((reminder) => reminder.id);
    const { data: checkins, error: checkinError } = reminderIds.length ? await db.from('reminder_checkins').select('reminder_id, telegram_id, checked_in_at').in('reminder_id', reminderIds) : { data: [], error: null };
    if (checkinError) throw checkinError;
    const minutes = sessions.reduce((sum, row) => sum + (row.planned_minutes || 0), 0);
    const mine = sessions.filter((row) => row.starter_telegram_id === ctx.from.id ? row.starter_completed_at : row.recipient_completed_at).length;
    const partner = sessions.filter((row) => row.starter_telegram_id === otherId ? row.starter_completed_at : row.recipient_completed_at).length;
    const streak = await streakFor(connection.id);
    const mineCheckins = checkins.filter((checkin) => checkin.telegram_id === ctx.from.id).length;
    const partnerCheckins = checkins.filter((checkin) => checkin.telegram_id === otherId).length;
    await ctx.reply(`📊 تقرير آخر 7 أيام — ${other.pseudonym}\n━━━━━━━━━━━━\n⏱️ الجلسات المكتملة: ${sessions.length}\n🕐 وقت الدراسة: ${minutes} دقيقة\n📋 المهام المنجزة: ${tasks.length}\n🙋 التزامك بالجلسات: ${sessions.length ? Math.round((mine / sessions.length) * 100) : 0}٪\n🤝 التزام الشريك: ${sessions.length ? Math.round((partner / sessions.length) * 100) : 0}٪\n🔔 حضورك بالمواعيد: ${mineCheckins}/${reminders.length}\n🔔 حضور الشريك: ${partnerCheckins}/${reminders.length}\n🔥 streak مشترك: ${streak} يوم${streak >= 3 ? ' — استمروا!' : ''}`, menu);
  }
}
async function saveSessionReflection(ctx, sessionId, reflection) {
  const { data: row, error } = await db.from('study_sessions').select('*').eq('id', sessionId).in('status', ['active', 'awaiting_reflection']).maybeSingle();
  if (error) throw error;
  if (!row || (row.starter_telegram_id !== ctx.from.id && row.recipient_telegram_id !== ctx.from.id)) return ctx.reply('هذه الجلسة لم تعد متاحة.', menu);
  const isStarter = row.starter_telegram_id === ctx.from.id;
  const update = isStarter
    ? { starter_reflection: reflection.slice(0, 600), starter_completed_at: new Date().toISOString(), status: 'awaiting_reflection' }
    : { recipient_reflection: reflection.slice(0, 600), recipient_completed_at: new Date().toISOString(), status: 'awaiting_reflection' };
  const { data: updated, error: updateError } = await db.from('study_sessions').update(update).eq('id', sessionId).select().single();
  if (updateError) throw updateError;
  ctx.session = {};
  const partnerId = isStarter ? updated.recipient_telegram_id : updated.starter_telegram_id;
  await bot.telegram.sendMessage(partnerId, 'شريكك كتب إنجازه للجلسة ✅ إذا خلصت، اضغط «أنهي واكتب إنجازي».', sessionActions(sessionId));
  if (!updated.starter_reflection || !updated.recipient_reflection) return ctx.reply('تم حفظ إنجازك ✅ أنتظر شريكك يكمل ملخصه.', menu);
  const { data: completed, error: completeError } = await db.from('study_sessions').update({ status: 'completed', ended_at: new Date().toISOString(), completed_at: new Date().toISOString() }).eq('id', sessionId).select().single();
  if (completeError) throw completeError;
  const starter = await profile(completed.starter_telegram_id);
  const recipient = await profile(completed.recipient_telegram_id);
  const recap = `🎉 اكتملت جلستكم المشتركة — ${durationLabel(completed.planned_minutes)}\n━━━━━━━━━━━━\n📝 إنجاز ${starter.pseudonym}: ${completed.starter_reflection}\n📝 إنجاز ${recipient.pseudonym}: ${completed.recipient_reflection}\n\nقيّموا الجلسة بسرعة حتى تتحسن شراكتكم.`;
  const feedback = buttons([['قيّم الجلسة ⭐', `feedback:${completed.id}`]]);
  await bot.telegram.sendMessage(completed.starter_telegram_id, recap, feedback);
  await bot.telegram.sendMessage(completed.recipient_telegram_id, recap, feedback);
  return ctx.reply('أحسنتم 🔥 اكتملت الجلسة وانحسبت ضمن الـStreak والتقرير الأسبوعي.', menu);
}
async function sendAutomaticWeeklyReports(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Baghdad', weekday: 'short' }).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baghdad', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (weekday !== 'Fri' || hour !== 20) return;
  const weekStart = baghdadDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: connections, error } = await db.from('connections').select('*').eq('status', 'accepted');
  if (error) throw error;
  for (const connection of connections) {
    const { data: sent, error: sentError } = await db.from('weekly_report_sends').upsert({ connection_id: connection.id, week_start: weekStart }, { onConflict: 'connection_id,week_start', ignoreDuplicates: true }).select();
    if (sentError || !sent?.length) continue;
    const { data: sessions } = await db.from('study_sessions').select('planned_minutes').eq('connection_id', connection.id).eq('status', 'completed').gte('completed_at', since);
    const { data: tasks } = await db.from('study_tasks').select('id').eq('connection_id', connection.id).eq('is_done', true).gte('completed_at', since);
    const minutes = (sessions || []).reduce((sum, row) => sum + (row.planned_minutes || 0), 0);
    const streak = await streakFor(connection.id);
    const report = `📊 تقرير Twinny الأسبوعي\n━━━━━━━━━━━━\n⏱️ جلسات مكتملة: ${(sessions || []).length}\n🕐 وقت دراسة: ${minutes} دقيقة\n📋 مهام منجزة: ${(tasks || []).length}\n🔥 streak مشترك: ${streak} يوم\n\nافتحوا «📊 تقريرنا» حتى تشوفون تفاصيل الالتزام والحضور.`;
    await bot.telegram.sendMessage(connection.requester_telegram_id, report, menu);
    await bot.telegram.sendMessage(connection.recipient_telegram_id, report, menu);
  }
}
async function processStudyAutomation() {
  const now = new Date();
  const nowIso = now.toISOString();
  const { data: reminders, error: reminderError } = await db.from('study_reminders').select('*').eq('status', 'pending').lte('reminder_at', nowIso).limit(50);
  if (reminderError) throw reminderError;
  for (const reminder of reminders) {
    await db.from('study_reminders').update({ status: 'sent' }).eq('id', reminder.id).eq('status', 'pending');
    const message = '🔔 هذا موعد الدراسة المتفق عليه. اضغط حاضر حتى نسجل الالتزام، وبعدها ابدأوا جلسة الدراسة.';
    const keyboard = buttons([['أنا حاضر ✅', `checkin:${reminder.id}`]]);
    await bot.telegram.sendMessage(reminder.creator_telegram_id, message, keyboard);
    await bot.telegram.sendMessage(reminder.recipient_telegram_id, message, keyboard);
  }
  const { data: endingSessions, error: endingError } = await db.from('study_sessions').select('*').eq('status', 'active').lte('ends_at', nowIso).limit(50);
  if (endingError) throw endingError;
  for (const sessionRow of endingSessions) {
    await db.from('study_sessions').update({ status: 'awaiting_reflection' }).eq('id', sessionRow.id).eq('status', 'active');
    const message = `⏰ انتهت جلسة ${durationLabel(sessionRow.planned_minutes)}. شنو أنجزت؟`;
    const keyboard = sessionActions(sessionRow.id);
    await bot.telegram.sendMessage(sessionRow.starter_telegram_id, message, keyboard);
    await bot.telegram.sendMessage(sessionRow.recipient_telegram_id, message, keyboard);
  }
  const { data: expiredSessions, error: expiredError } = await db.from('study_sessions').select('*').eq('status', 'pending').lte('created_at', new Date(now.getTime() - 20 * 60_000).toISOString()).limit(50);
  if (expiredError) throw expiredError;
  for (const sessionRow of expiredSessions) {
    await db.from('study_sessions').update({ status: 'expired' }).eq('id', sessionRow.id).eq('status', 'pending');
    await bot.telegram.sendMessage(sessionRow.starter_telegram_id, 'انتهت صلاحية دعوة جلسة الدراسة. جرّب مرة ثانية أو اضبط تذكيراً لوقت مناسب.', menu);
  }
  const { data: expiredQuestionSessions, error: expiredQuestionError } = await db.from('question_sessions').select('*').eq('status', 'pending').lte('created_at', new Date(now.getTime() - 20 * 60_000).toISOString()).limit(50);
  if (expiredQuestionError) throw expiredQuestionError;
  for (const questionSession of expiredQuestionSessions) {
    await db.from('question_sessions').update({ status: 'expired' }).eq('id', questionSession.id).eq('status', 'pending');
    await bot.telegram.sendMessage(questionSession.creator_telegram_id, 'انتهت صلاحية دعوة جلسة حل الأسئلة. جرّب مرة ثانية أو اضبطوا وقتاً مناسباً.', menu);
  }
  const { data: closingReminders, error: closingError } = await db.from('study_reminders').select('*').eq('status', 'sent').lte('reminder_at', new Date(now.getTime() - 15 * 60_000).toISOString()).limit(50);
  if (closingError) throw closingError;
  for (const reminder of closingReminders) {
    const { data: checkins, error: checkinError } = await db.from('reminder_checkins').select('telegram_id').eq('reminder_id', reminder.id);
    if (checkinError) throw checkinError;
    await db.from('study_reminders').update({ status: 'closed' }).eq('id', reminder.id).eq('status', 'sent');
    const attendanceLabel = (telegramId, label) => {
      const checkin = checkins.find((item) => item.telegram_id === telegramId);
      if (!checkin) return `${label}: ما سجّل حضور`;
      const delay = Math.max(0, Math.round((new Date(checkin.checked_in_at) - new Date(reminder.reminder_at)) / 60_000));
      return delay <= 5 ? `${label}: حاضر بوقته ✅` : `${label}: حاضر متأخر ${delay} د`;
    };
    const result = `📌 نتيجة الموعد:\n${attendanceLabel(reminder.creator_telegram_id, 'الطالب الأول')}\n${attendanceLabel(reminder.recipient_telegram_id, 'الشريك')}\n\nاستخدموا «⏱️ جلسة دراسة» حتى تبدي الجلسة المشتركة.`;
    await bot.telegram.sendMessage(reminder.creator_telegram_id, result, menu);
    await bot.telegram.sendMessage(reminder.recipient_telegram_id, result, menu);
  }
  await sendAutomaticWeeklyReports(now);
}

bot.on('callback_query', async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCbQuery();
  if (data === 'match_mode:bot') {
    const me = await ensureRegistered(ctx); if (!me) return;
    const candidates = await availablePeople(me);
    candidates.sort((left, right) => score(me, right) - score(me, left));
    return sendCandidateCards(ctx, me, candidates.slice(0, 10), { heading: '🤖 أفضل 10 اقتراحات من Twinny حسب الجامعة، العمر، المرحلة/التخرج، الهدف، التوفر، الالتزام وبقية تفضيلات الدراسة:', showScore: true });
  }
  if (data === 'match_mode:all') {
    const me = await ensureRegistered(ctx); if (!me) return;
    const candidates = await availablePeople(me, { onlyWithoutPartner: true });
    candidates.sort((left, right) => score(me, right) - score(me, left));
    return sendCandidateCards(ctx, me, candidates, { heading: `👥 كل المتاحين حالياً بلا شريك: ${candidates.length} طالب/ة.`, showScore: false });
  }
  if (data === 'match_mode:criteria') {
    const me = await ensureRegistered(ctx); if (!me) return;
    ctx.session = { flow: 'match_criteria', criteria: [] };
    return renderMatchCriteria(ctx);
  }
  if (data.startsWith('match_criterion:') && ctx.session?.flow === 'match_criteria') {
    const criterion = data.split(':')[1];
    if (!MATCH_CRITERIA.some(([id]) => id === criterion)) return ctx.reply('هذا المعيار غير متاح.');
    const selected = new Set(ctx.session.criteria || []);
    selected.has(criterion) ? selected.delete(criterion) : selected.add(criterion);
    ctx.session.criteria = [...selected];
    return renderMatchCriteria(ctx, true);
  }
  if (data === 'match_criteria_clear' && ctx.session?.flow === 'match_criteria') {
    ctx.session.criteria = [];
    return renderMatchCriteria(ctx, true);
  }
  if (data === 'match_criteria_done' && ctx.session?.flow === 'match_criteria') {
    const me = await ensureRegistered(ctx); if (!me) return;
    const criteria = ctx.session.criteria || [];
    ctx.session = {};
    const candidates = await availablePeople(me, { criteria });
    const selected = criteria.length ? criteria.map((id) => MATCH_CRITERIA.find(([key]) => key === id)?.[1]).join('، ') : 'بدون معايير إضافية';
    if (candidates.length) {
      candidates.sort((left, right) => score(me, right) - score(me, left));
      return sendCandidateCards(ctx, me, candidates, { heading: `⚙️ تطابق كامل حسب: ${selected}\nعدد النتائج: ${candidates.length}`, showScore: false, criteria });
    }
    const closest = await availablePeople(me);
    closest.sort((left, right) => matchedCriteriaCount(me, right, criteria) - matchedCriteriaCount(me, left, criteria) || score(me, right) - score(me, left));
    return sendCandidateCards(ctx, me, closest.slice(0, 10), { heading: `ماكو تطابق كامل لكل المعايير المختارة، لكن هذني أقرب 10 طلاب. راح تشوف تحت كل ملف شكد من معاييرك يطابق.\n\nبحثك: ${selected}`, showScore: true, criteria });
  }
  const registrationButton = /^(gender|year|time|style|sessions|duration|mode|preference|seriousness|availability_day|availability_slot|call_pref|aloud_pref):/.test(data) || ['year_custom', 'availability_days_done', 'availability_slots_done'].includes(data);
  if (registrationButton && !ctx.session?.form) {
    return ctx.reply('انتهت جلسة التسجيل السابقة بسبب إعادة تشغيل البوت. اكتب /start ونبدأ من جديد 👋');
  }
  if (data === 'update_preferences') {
    const me = await ensureRegistered(ctx); if (!me) return;
    return showUpdateMenu(ctx);
  }
  if (data === 'update_availability') {
    const me = await ensureRegistered(ctx); if (!me) return;
    return startAvailabilityQuestions(ctx, 'update_preferences', { available_days: me.available_days || [], available_slots: me.available_slots || [] });
  }
  if (data.startsWith('availability_day:')) {
    const day = data.split(':')[1];
    if (!WEEK_DAYS.some(([id]) => id === day)) return ctx.reply('هذا اليوم غير متاح.');
    const selected = new Set(ctx.session.form.available_days || []);
    selected.has(day) ? selected.delete(day) : selected.add(day);
    ctx.session.form.available_days = [...selected];
    return renderAvailabilityDays(ctx, true);
  }
  if (data === 'availability_days_done') {
    if (!(ctx.session.form.available_days || []).length) return ctx.reply('اختَر يوم واحد على الأقل.');
    ctx.session.step = 'availability_slots';
    return renderAvailabilitySlots(ctx, true);
  }
  if (data.startsWith('availability_slot:')) {
    const slot = data.split(':')[1];
    if (!AVAILABILITY_SLOTS.some(([id]) => id === slot)) return ctx.reply('هذا الوقت غير متاح.');
    const selected = new Set(ctx.session.form.available_slots || []);
    selected.has(slot) ? selected.delete(slot) : selected.add(slot);
    ctx.session.form.available_slots = [...selected];
    return renderAvailabilitySlots(ctx, true);
  }
  if (data === 'availability_slots_done') {
    if (!(ctx.session.form.available_slots || []).length) return ctx.reply('اختَر وقت واحد على الأقل.');
    ctx.session.step = 'call_preference';
    return ctx.reply('بالدراسة مع الشريك، شنو تفضيلك للمكالمة؟', buttons([['أفضل مكالمة 🎥', 'call_pref:call'], ['أفضل بدون مكالمة 💬', 'call_pref:no_call'], ['عادي الاثنين', 'call_pref:both']]));
  }
  if (data.startsWith('call_pref:')) {
    const value = data.split(':')[1];
    if (!['call', 'no_call', 'both'].includes(value)) return ctx.reply('هذا الخيار غير متاح.');
    ctx.session.form.call_preference = value;
    ctx.session.step = 'aloud_reading_preference';
    return ctx.reply('بالجلسة أو المكالمة، شنو موقفك من القراءة بصوت عالٍ؟', buttons([['أحبها 🗣️', 'aloud_pref:prefer'], ['عادي عندي', 'aloud_pref:okay'], ['ما أفضلها', 'aloud_pref:no']]));
  }
  if (data.startsWith('aloud_pref:')) {
    const value = data.split(':')[1];
    if (!['prefer', 'okay', 'no'].includes(value)) return ctx.reply('هذا الخيار غير متاح.');
    ctx.session.form.aloud_reading_preference = value;
    return finishPreferences(ctx);
  }
  if (data.startsWith('location:')) {
    if (!ctx.session?.form && ctx.session?.flow !== 'edit_location') return ctx.reply('ابدأ التسجيل عبر /start أولاً.');
    const kind = data.split(':')[1];
    if (kind === 'iraq') return ctx.reply('اختَر محافظتك:', grid(IRAQI_GOVERNORATES.map((value, index) => [value, `gov:${index}`])));
    if (kind === 'arab') return ctx.reply('اختَر الدولة:', grid(ARAB_COUNTRIES.map((value, index) => [value, `arab:${index}`])));
    ctx.session.step = 'country_custom';
    return ctx.reply('اكتب اسم الدولة:');
  }
  if (data.startsWith('gov:')) {
    const city = IRAQI_GOVERNORATES[Number(data.split(':')[1])];
    if (!city) return ctx.reply('هذا الخيار غير متاح.');
    if (ctx.session.flow === 'edit_location') {
      const { error } = await db.from('profiles').update({ country: 'العراق', city, updated_at: new Date().toISOString() }).eq('telegram_id', ctx.from.id);
      if (error) throw error;
      ctx.session = {}; await ctx.reply('تم تحديث المكان ✅'); return showUpdateMenu(ctx);
    }
    ctx.session.form.country = 'العراق'; ctx.session.form.city = city; ctx.session.step = 'university';
    return showUniversityGroup(ctx);
  }
  if (data.startsWith('arab:')) {
    const country = ARAB_COUNTRIES[Number(data.split(':')[1])];
    if (!country) return ctx.reply('هذا الخيار غير متاح.');
    if (ctx.session.flow === 'edit_location') { ctx.session.country = country; ctx.session.step = 'foreign_city'; return ctx.reply('اكتب مدينتك:'); }
    ctx.session.form.country = country; ctx.session.step = 'foreign_city'; return ctx.reply('اكتب مدينتك:');
  }
  if (data.startsWith('uni_group:')) {
    const group = data.split(':')[1];
    if (group === 'custom') { ctx.session.step = 'university_custom'; return ctx.reply('اكتب اسم الجامعة أو المعهد:'); }
    const list = group === 'public' ? IRAQI_UNIVERSITIES.slice(0, 32) : group === 'regional' ? IRAQI_UNIVERSITIES.slice(32) : IRAQI_PRIVATE_INSTITUTIONS;
    return ctx.reply('اختَر الاسم، أو استخدم الكتابة الحرة إذا غير موجود:', grid([...list.map((value, index) => [value, `uni:${group}:${index}`]), ['جامعتي غير موجودة ✏️', 'uni:custom:0']]));
  }
  if (data.startsWith('uni:')) {
    const [, group, index] = data.split(':');
    if (group === 'custom') { ctx.session.step = 'university_custom'; return ctx.reply('اكتب اسم الجامعة أو المعهد:'); }
    const list = group === 'public' ? IRAQI_UNIVERSITIES.slice(0, 32) : group === 'regional' ? IRAQI_UNIVERSITIES.slice(32) : IRAQI_PRIVATE_INSTITUTIONS;
    const university = list[Number(index)];
    if (!university) return ctx.reply('هذا الخيار غير متاح.');
    if (ctx.session.flow === 'edit_profile') return saveProfileField(ctx, 'university', university);
    ctx.session.form.university = university; ctx.session.step = 'major'; return showMajorChoice(ctx);
  }
  if (data.startsWith('major:')) {
    const value = data.split(':')[1];
    if (value === 'custom') { ctx.session.step = 'major_custom'; return ctx.reply('اكتب تخصصك:'); }
    const major = CORE_MAJORS[Number(value)];
    if (!major) return ctx.reply('هذا الخيار غير متاح.');
    if (ctx.session.flow === 'edit_profile') return saveProfileField(ctx, 'major', major);
    ctx.session.form.major = major; ctx.session.step = 'academic_year'; return showAcademicYearChoice(ctx);
  }
  if (data.startsWith('edit:')) {
    const me = await ensureRegistered(ctx); if (!me) return;
    const field = data.split(':')[1];
    const prompts = { real_name: 'اكتب اسمك الحقيقي:', university: 'اكتب اسم الجامعة أو المعهد:', major: 'اكتب تخصصك:', goal: 'اكتب هدفك الدراسي:', study_focus: 'شنو تدرس أو تحضّر حالياً؟ اكتب بحرية، مثال: تحضير المعادلة أو امتحان البورد.', previous_grades: 'اكتب تقديراتك بالمرحلة السابقة بحرية. مثال: باطنية جيد، جراحة جيد، فارما جيد جداً.\nاكتب - إذا ما تريد تضيفها.' };
    if (field === 'location') { ctx.session = { flow: 'edit_location' }; return showLocationChoice(ctx); }
    if (field === 'university') { ctx.session = { flow: 'edit_profile', field }; return showUniversityGroup(ctx); }
    if (field === 'major') { ctx.session = { flow: 'edit_profile', field }; return showMajorChoice(ctx); }
    if (field === 'preferences') return startPreferenceQuestions(ctx, 'update_preferences');
    if (field === 'availability') return startAvailabilityQuestions(ctx, 'update_preferences', { available_days: me.available_days || [], available_slots: me.available_slots || [] });
    if (field === 'gender') return ctx.reply('حدّد جنسك:', buttons([['بنت', 'edit_gender:female'], ['ولد', 'edit_gender:male']]));
    if (field === 'birth_year') { ctx.session = { flow: 'edit_profile', field }; return ctx.reply('اكتب سنة ميلادك:'); }
    if (field === 'academic_year') return showAcademicYearChoice(ctx, 'edit_year');
    if (field === 'study_time') return showStudyTimeChoice(ctx, 'edit_time');
    if (field === 'learning_style') return ctx.reply('شنو أسلوبك المفضل؟', buttons([['بصري', 'edit_style:visual'], ['قراءة وكتابة', 'edit_style:reading'], ['نقاش', 'edit_style:discussion'], ['حل أسئلة', 'edit_style:practice']]));
    if (!prompts[field]) return ctx.reply('هذا الخيار غير متاح.');
    ctx.session = { flow: 'edit_profile', field };
    return ctx.reply(prompts[field]);
  }
  if (data.startsWith('edit_gender:')) return saveProfileField(ctx, 'gender', data.split(':')[1]);
  if (data.startsWith('edit_time:')) {
    const value = data.split(':')[1];
    if (value === 'custom') { ctx.session = { flow: 'edit_profile', field: 'study_time' }; return ctx.reply('اكتب الوقت الذي يناسبك:'); }
    return saveProfileField(ctx, 'study_time', value);
  }
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
    const { data: connection, error: connectionError } = await db.from('connections').select('id, status').eq('requester_telegram_id', me.telegram_id).eq('recipient_telegram_id', recipient).maybeSingle();
    if (connectionError) throw connectionError;
    await ctx.reply('تم إرسال طلب التعارف 🤝');
    if (connection?.status === 'pending') return bot.telegram.sendMessage(recipient, await incomingRequestProfileText(me), buttons([['أقبل ✅', `accept:${connection.id}`], ['أرفض', `reject:${connection.id}`], ['عرض طلباتي', 'open_requests']]));
    return;
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
  if (data.startsWith('questions:')) {
    const [, connectionId, recipientId] = data.split(':');
    ctx.session = { flow: 'question_setup', connectionId: Number(connectionId), recipientId: Number(recipientId), step: 'topic' };
    return ctx.reply('شنو موضوع جلسة حل الأسئلة؟ مثال: باطنية — أمراض الكلى.');
  }
  if (data === 'qcount_custom' && ctx.session?.flow === 'question_setup') {
    ctx.session.step = 'question_count_custom';
    return ctx.reply('اكتب عدد الأسئلة من 1 إلى 100:');
  }
  if (data.startsWith('qcount:') && ctx.session?.flow === 'question_setup') {
    const count = Number(data.split(':')[1]);
    if (!Number.isInteger(count) || count < 1 || count > 100) return ctx.reply('عدد الأسئلة غير صالح.');
    ctx.session.questionCount = count;
    ctx.session.step = 'call_mode';
    return ctx.reply('تحبون تكون الجلسة بمكالمة؟', buttons([['🎥 نعم، مكالمة', 'qcall:call'], ['💬 لا، داخل البوت فقط', 'qcall:no_call']]));
  }
  if (data.startsWith('qcall:') && ctx.session?.flow === 'question_setup') {
    const callMode = data.split(':')[1];
    if (!['call', 'no_call'].includes(callMode)) return ctx.reply('هذا الخيار غير متاح.');
    const roomUrl = callMode === 'call' ? `https://meet.jit.si/Twinny-${randomUUID()}` : null;
    const { data: questionSession, error } = await db.from('question_sessions').insert({ connection_id: ctx.session.connectionId, creator_telegram_id: ctx.from.id, recipient_telegram_id: ctx.session.recipientId, topic: ctx.session.topic, question_count: ctx.session.questionCount, call_mode: callMode, room_url: roomUrl }).select().single();
    if (error) throw error;
    const me = await profile(ctx.from.id);
    ctx.session = {};
    await bot.telegram.sendMessage(questionSession.recipient_telegram_id, `🧩 ${me.pseudonym} يدعوك لجلسة حل أسئلة\n📖 الموضوع: ${questionSession.topic}\n🔢 العدد: ${questionSession.question_count} سؤال\n${callMode === 'call' ? '🎥 تتضمن مكالمة خاصة.' : '💬 داخل البوت فقط.'}`, buttons([['أوافق وأبدأ ✅', `question_accept:${questionSession.id}`], ['مو هسه', `question_decline:${questionSession.id}`]]));
    return ctx.reply('تم إرسال دعوة جلسة حل الأسئلة 🤝', menu);
  }
  if (data.startsWith('question_accept:')) {
    const id = Number(data.split(':')[1]);
    const { data: row, error } = await db.from('question_sessions').update({ status: 'active', accepted_at: new Date().toISOString() }).eq('id', id).eq('recipient_telegram_id', ctx.from.id).eq('status', 'pending').select().maybeSingle();
    if (error) throw error;
    if (!row) return ctx.reply('هذه الدعوة انتهت أو تم التعامل معها.');
    const text = `🧩 بدأت جلسة حل الأسئلة\n📖 ${row.topic}\n🎯 الهدف: ${row.question_count} سؤال\n\nأرسلوا الأسئلة نصاً أو كصورة/ملف، وعلّموا السؤال من تحلوه.`;
    await bot.telegram.sendMessage(row.creator_telegram_id, text, questionSessionKeyboard(row));
    await bot.telegram.sendMessage(row.recipient_telegram_id, text, questionSessionKeyboard(row));
    return;
  }
  if (data.startsWith('question_decline:')) {
    const id = Number(data.split(':')[1]);
    const { data: row } = await db.from('question_sessions').update({ status: 'declined' }).eq('id', id).eq('recipient_telegram_id', ctx.from.id).eq('status', 'pending').select().maybeSingle();
    if (!row) return ctx.reply('هذه الدعوة انتهت أو تم التعامل معها.');
    await bot.telegram.sendMessage(row.creator_telegram_id, 'شريكك ما يقدر يبدأ جلسة الأسئلة هسه. نسقوا وقت آخر 🔔', menu);
    return ctx.reply('تمام، نسقوا وقت آخر.', menu);
  }
  if (data.startsWith('question_add:')) {
    const id = Number(data.split(':')[1]);
    const questionSession = await activeQuestionSessionForUser(id, ctx.from.id);
    if (!questionSession) return ctx.reply('هذه الجلسة غير متاحة.');
    ctx.session = { flow: 'question_add', questionSessionId: id };
    return ctx.reply('أرسل السؤال الآن: نص، أو صورة، أو ملف.');
  }
  if (data.startsWith('question_list:')) {
    const id = Number(data.split(':')[1]);
    const questionSession = await activeQuestionSessionForUser(id, ctx.from.id);
    if (!questionSession) return ctx.reply('هذه الجلسة غير متاحة.');
    const { data: items, error } = await db.from('question_items').select('*').eq('question_session_id', id).order('created_at', { ascending: true });
    if (error) throw error;
    if (!items.length) return ctx.reply(`بعد ما انضافت أسئلة لجلسة «${questionSession.topic}».`, questionSessionKeyboard(questionSession));
    for (const item of items) await ctx.reply(`${item.is_solved ? '✅' : '❓'} سؤال ${item.id}\n${item.body}`, item.is_solved ? undefined : buttons([['تم الحل ✅', `question_solved:${item.id}`]]));
    return;
  }
  if (data.startsWith('question_solved:')) {
    const id = Number(data.split(':')[1]);
    const { data: item, error } = await db.from('question_items').select('question_session_id').eq('id', id).maybeSingle();
    if (error) throw error;
    const questionSession = item && await activeQuestionSessionForUser(item.question_session_id, ctx.from.id);
    if (!questionSession) return ctx.reply('هذا السؤال غير متاح.');
    await db.from('question_items').update({ is_solved: true, solved_by_telegram_id: ctx.from.id, solved_at: new Date().toISOString() }).eq('id', id);
    return ctx.reply('تم تعليم السؤال كمحلول ✅');
  }
  if (data.startsWith('question_end:')) {
    const id = Number(data.split(':')[1]);
    const questionSession = await activeQuestionSessionForUser(id, ctx.from.id);
    if (!questionSession) return ctx.reply('هذه الجلسة غير متاحة.');
    const { data: items, error } = await db.from('question_items').select('id, is_solved').eq('question_session_id', id);
    if (error) throw error;
    await db.from('question_sessions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id);
    const summary = `🏁 اكتملت جلسة حل الأسئلة\n📖 ${questionSession.topic}\n✅ المحلول: ${(items || []).filter((item) => item.is_solved).length}/${(items || []).length} سؤال\n🎯 الهدف الأصلي: ${questionSession.question_count} سؤال`;
    await bot.telegram.sendMessage(questionSession.creator_telegram_id, summary, menu);
    await bot.telegram.sendMessage(questionSession.recipient_telegram_id, summary, menu);
    return;
  }
  if (data.startsWith('task:')) {
    const [, connectionId, recipientId] = data.split(':');
    ctx.session = { flow: 'task', connectionId: Number(connectionId), recipientId: Number(recipientId), step: 'title' };
    return ctx.reply('اكتب المهمة المشتركة باختصار. مثال: حل محاضرة الكلى 3');
  }
  if (data.startsWith('session:')) {
    const [, connectionId, recipientId] = data.split(':');
    return ctx.reply('اختَر مدة الجلسة المشتركة:', buttons([['25 دقيقة ⚡', `start_session:${connectionId}:${recipientId}:25`], ['50 دقيقة 🎯', `start_session:${connectionId}:${recipientId}:50`]]));
  }
  if (data.startsWith('start_session:')) {
    const [, connectionId, recipientId, minutes] = data.split(':');
    const sessionRow = await createSessionInvite(Number(connectionId), ctx.from.id, Number(recipientId), Number(minutes));
    const me = await profile(ctx.from.id);
    await bot.telegram.sendMessage(Number(recipientId), `⏱️ ${me.pseudonym} يدعوك لجلسة دراسة مشتركة مدتها ${durationLabel(sessionRow.planned_minutes)}.\nهل تبدأون الآن؟`, buttons([['أوافق وأبدأ ✅', `session_accept:${sessionRow.id}`], ['مو هسه', `session_decline:${sessionRow.id}`]]));
    return ctx.reply('تم إرسال الدعوة 🤝 أنتظر موافقة شريكك.', menu);
  }
  if (data.startsWith('session_accept:')) {
    const id = Number(data.split(':')[1]);
    const { data: row, error } = await db.from('study_sessions').select('*').eq('id', id).eq('recipient_telegram_id', ctx.from.id).eq('status', 'pending').maybeSingle();
    if (error) throw error;
    if (!row) return ctx.reply('هذه الدعوة منتهية أو تم التعامل معها.');
    const active = await activateStudySession(row);
    if (!active) return ctx.reply('هذه الدعوة لم تعد متاحة.');
    await announceActiveSession(active);
    return;
  }
  if (data.startsWith('session_decline:')) {
    const id = Number(data.split(':')[1]);
    const { data: row } = await db.from('study_sessions').select('*').eq('id', id).eq('recipient_telegram_id', ctx.from.id).eq('status', 'pending').maybeSingle();
    if (!row) return ctx.reply('هذه الدعوة منتهية أو تم التعامل معها.');
    await db.from('study_sessions').update({ status: 'declined' }).eq('id', id);
    await bot.telegram.sendMessage(row.starter_telegram_id, 'شريكك ما يقدر يبدأ هسه. تقدرون تنسقون وقت أنسب 🔔', menu);
    return ctx.reply('تم، ممكن تنسقون موعد مناسب من «🔔 ضبط تذكير».', menu);
  }
  if (data.startsWith('session_reflect:')) {
    const id = Number(data.split(':')[1]);
    const { data: row, error } = await db.from('study_sessions').select('*').eq('id', id).in('status', ['active', 'awaiting_reflection']).maybeSingle();
    if (error) throw error;
    if (!row || (row.starter_telegram_id !== ctx.from.id && row.recipient_telegram_id !== ctx.from.id)) return ctx.reply('هذه الجلسة غير متاحة.');
    ctx.session = { flow: 'session_reflection', sessionId: id };
    return ctx.reply('شنو أنجزت بهالجلسة؟ اكتب باختصار، مثال: خلصت محاضرة الكلى وحليت 20 سؤال.');
  }
  if (data.startsWith('ready:')) {
    const [, connectionId, recipientId] = data.split(':');
    const me = await profile(ctx.from.id);
    await bot.telegram.sendMessage(Number(recipientId), `⚡ ${me.pseudonym} جاهز/ة يدرس هسة. تحبون تبدون 25 دقيقة؟`, buttons([['يلا نبدأ ⚡', `quick_session:${connectionId}:${ctx.from.id}:25`], ['مو هسه', `ready_decline:${ctx.from.id}`]]));
    return ctx.reply('وصلت إشارة الجاهزية لشريكك ⚡', menu);
  }
  if (data.startsWith('quick_session:')) {
    const [, connectionId, starterId, minutes] = data.split(':');
    const { data: row, error } = await db.from('study_sessions').insert({ connection_id: Number(connectionId), starter_telegram_id: Number(starterId), recipient_telegram_id: ctx.from.id, planned_minutes: Number(minutes), status: 'active', accepted_at: new Date().toISOString(), started_at: new Date().toISOString(), ends_at: new Date(Date.now() + Number(minutes) * 60_000).toISOString() }).select().single();
    if (error) throw error;
    await announceActiveSession(row);
    return;
  }
  if (data.startsWith('ready_decline:')) return ctx.reply('تمام، اختَرون وقت آخر يناسبكم 🔔', menu);
  if (data.startsWith('reminder:')) {
    const [, connectionId, recipientId] = data.split(':');
    ctx.session = { flow: 'reminder', connectionId: Number(connectionId), recipientId: Number(recipientId) };
    return ctx.reply('اكتب وقت التذكير بصيغة 24 ساعة HH:MM بتوقيت بغداد. مثال: 20:00\nإذا مرّ الوقت، ينضبط تلقائياً لباجر.');
  }
  if (data.startsWith('checkin:')) {
    const id = Number(data.split(':')[1]);
    const { data: reminder } = await db.from('study_reminders').select('*').eq('id', id).eq('status', 'sent').maybeSingle();
    if (!reminder || (reminder.creator_telegram_id !== ctx.from.id && reminder.recipient_telegram_id !== ctx.from.id)) return ctx.reply('هذا التذكير منتهٍ.');
    const { error } = await db.from('reminder_checkins').upsert({ reminder_id: id, telegram_id: ctx.from.id }, { onConflict: 'reminder_id,telegram_id' });
    if (error) throw error;
    return ctx.reply('تم تسجيل حضورك ✅ يلا ابدأوا الجلسة من «⏱️ جلسة دراسة».', menu);
  }
  if (data.startsWith('feedback:')) {
    const id = Number(data.split(':')[1]);
    const { data: row } = await db.from('study_sessions').select('*').eq('id', id).eq('status', 'completed').maybeSingle();
    if (!row || (row.starter_telegram_id !== ctx.from.id && row.recipient_telegram_id !== ctx.from.id)) return ctx.reply('التقييم غير متاح.');
    ctx.session = { flow: 'session_feedback', sessionId: id, feedback: {} };
    return ctx.reply('هل كان شريكك حاضر بالجلسة؟', buttons([['نعم ✅', 'feedback_present:yes'], ['لا ❌', 'feedback_present:no']]));
  }
  if (data.startsWith('feedback_present:') && ctx.session?.flow === 'session_feedback') {
    ctx.session.feedback.partner_present = data.endsWith(':yes');
    return ctx.reply('قيّم التزامه بالجلسة:', buttons([['1', 'feedback_commitment:1'], ['2', 'feedback_commitment:2'], ['3', 'feedback_commitment:3'], ['4', 'feedback_commitment:4'], ['5', 'feedback_commitment:5']]));
  }
  if (data.startsWith('feedback_commitment:') && ctx.session?.flow === 'session_feedback') {
    ctx.session.feedback.commitment = Number(data.split(':')[1]);
    return ctx.reply('شكد كانت الجلسة مفيدة؟', buttons([['1', 'feedback_usefulness:1'], ['2', 'feedback_usefulness:2'], ['3', 'feedback_usefulness:3'], ['4', 'feedback_usefulness:4'], ['5', 'feedback_usefulness:5']]));
  }
  if (data.startsWith('feedback_usefulness:') && ctx.session?.flow === 'session_feedback') {
    const usefulness = Number(data.split(':')[1]);
    const { error } = await db.from('session_feedback').upsert({ study_session_id: ctx.session.sessionId, reviewer_telegram_id: ctx.from.id, ...ctx.session.feedback, usefulness }, { onConflict: 'study_session_id,reviewer_telegram_id' });
    if (error) throw error;
    ctx.session = {};
    return ctx.reply('شكراً، سجّلنا تقييم الجلسة ⭐', menu);
  }
  if (data.startsWith('done:')) {
    const id = Number(data.split(':')[1]);
    const { data: task } = await db.from('study_tasks').select('connection_id').eq('id', id).maybeSingle();
    const ownConnections = await acceptedConnections(ctx.from.id);
    if (!task || !ownConnections.some((c) => c.id === task.connection_id)) return ctx.reply('هذه المهمة غير متاحة.');
    await db.from('study_tasks').update({ is_done: true, completed_by_telegram_id: ctx.from.id, completed_at: new Date().toISOString() }).eq('id', id);
    const partnerId = ownConnections.find((c) => c.id === task.connection_id).requester_telegram_id === ctx.from.id ? ownConnections.find((c) => c.id === task.connection_id).recipient_telegram_id : ownConnections.find((c) => c.id === task.connection_id).requester_telegram_id;
    const me = await profile(ctx.from.id);
    await bot.telegram.sendMessage(partnerId, `✅ ${me.pseudonym} أنجز/ت مهمة مشتركة. شوفوا «📋 مهامنا» حتى تتابعون التقدم.`, menu);
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
  if (text === '🧩 حل أسئلة') return choosePartner(ctx, 'questions', 'اختَر الشريك لجلسة حل الأسئلة:');
  if (text === '⚡ جاهز أدرس هسة') return choosePartner(ctx, 'ready', 'منو تريد تناديه لجلسة سريعة هسه؟');
  if (text === '🔔 ضبط تذكير') return choosePartner(ctx, 'reminder', 'اختَر الشريك ثم حدّد وقت التذكير:');
  if (text === '📊 تقريرنا') return showWeeklyReport(ctx);
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
  if (ctx.session?.flow === 'question_setup' && ctx.session.step === 'topic') {
    if (!text || text.length > 180) return ctx.reply('اكتب موضوعاً مختصراً، حتى 180 حرف.');
    ctx.session.topic = text;
    ctx.session.step = 'question_count';
    return ctx.reply('كم سؤال تريدون تحلون بهالجلسة؟', buttons([['5 أسئلة', 'qcount:5'], ['10 أسئلة', 'qcount:10'], ['20 سؤال', 'qcount:20'], ['عدد آخر ✏️', 'qcount_custom']]));
  }
  if (ctx.session?.flow === 'question_setup' && ctx.session.step === 'question_count_custom') {
    const count = Number(text);
    if (!Number.isInteger(count) || count < 1 || count > 100) return ctx.reply('اكتب عدداً من 1 إلى 100.');
    ctx.session.questionCount = count;
    ctx.session.step = 'call_mode';
    return ctx.reply('تحبون تكون الجلسة بمكالمة؟', buttons([['🎥 نعم، مكالمة', 'qcall:call'], ['💬 لا، داخل البوت فقط', 'qcall:no_call']]));
  }
  if (ctx.session?.flow === 'question_add') {
    const questionSession = await activeQuestionSessionForUser(ctx.session.questionSessionId, ctx.from.id);
    if (!questionSession) { ctx.session = {}; return ctx.reply('الجلسة انتهت أو لم تعد متاحة.', menu); }
    const item = await sendQuestionItem(ctx, questionSession, { body: text });
    ctx.session = {};
    if (!item) return ctx.reply('ما انضاف سؤال جديد.', questionSessionKeyboard(questionSession));
    return ctx.reply('تم إرسال السؤال لشريكك ✅', questionSessionKeyboard(questionSession));
  }
  if (ctx.session?.flow === 'session_reflection') return saveSessionReflection(ctx, ctx.session.sessionId, text);
  if (ctx.session?.flow === 'reminder') {
    const reminderAt = nextBaghdadTime(text);
    if (!reminderAt) return ctx.reply('اكتب الوقت هكذا HH:MM، مثال: 20:00.');
    const { error } = await db.from('study_reminders').insert({ connection_id: ctx.session.connectionId, creator_telegram_id: ctx.from.id, recipient_telegram_id: ctx.session.recipientId, reminder_at: reminderAt.toISOString() });
    if (error) throw error;
    const partner = await profile(ctx.session.recipientId);
    const shownTime = new Intl.DateTimeFormat('ar-IQ', { timeZone: 'Asia/Baghdad', hour: 'numeric', minute: '2-digit' }).format(reminderAt);
    ctx.session = {};
    await bot.telegram.sendMessage(partner.telegram_id, `🔔 تم ضبط تذكير دراسة مشترك الساعة ${shownTime} بتوقيت بغداد. راح توصلكم رسالة بالحضور وقت الموعد.`, menu);
    return ctx.reply(`تم ضبط التذكير الساعة ${shownTime} بتوقيت بغداد ✅`, menu);
  }
  if (ctx.session?.flow === 'edit_location') {
    if (ctx.session.step === 'country_custom') { ctx.session.country = text; ctx.session.step = 'foreign_city'; return ctx.reply('اكتب مدينتك:'); }
    if (ctx.session.step === 'foreign_city') {
      const { error } = await db.from('profiles').update({ country: ctx.session.country, city: text, updated_at: new Date().toISOString() }).eq('telegram_id', ctx.from.id);
      if (error) throw error;
      ctx.session = {}; await ctx.reply('تم تحديث المكان ✅'); return showUpdateMenu(ctx);
    }
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
  if (s.step === 'birth_year') { const year = Number(text); if (!Number.isInteger(year) || ageFrom(year) < 16 || ageFrom(year) > 60) return ctx.reply('اكتب سنة ميلاد صحيحة (العمر المسموح من 16 إلى 60).'); s.form.birth_year = year; s.step = 'location'; return showLocationChoice(ctx); }
  if (s.step === 'country_custom') { s.form.country = text; s.step = 'foreign_city'; return ctx.reply('اكتب مدينتك:'); }
  if (s.step === 'foreign_city') { s.form.city = text; s.step = 'university'; return showUniversityGroup(ctx); }
  if (s.step === 'university_custom') { s.form.university = text; s.step = 'major'; return showMajorChoice(ctx); }
  if (s.step === 'major_custom') { s.form.major = text; s.step = 'academic_year'; return showAcademicYearChoice(ctx); }
  if (s.step === 'academic_year_custom') { s.form.academic_year = text; s.step = 'study_time'; return showStudyTimeChoice(ctx); }
  if (s.step === 'study_time_custom') { s.form.study_time = text; s.step = 'learning_style'; return ctx.reply('شنو أسلوبك المفضل؟', buttons([['بصري', 'style:visual'], ['قراءة وكتابة', 'style:reading'], ['نقاش', 'style:discussion'], ['حل أسئلة', 'style:practice']])); }
  if (s.step === 'session_duration_custom') { const minutes = Number(text); if (!Number.isInteger(minutes) || minutes < 10 || minutes > 240) return ctx.reply('اكتب رقماً من 10 إلى 240 دقيقة.'); s.form.session_duration = minutes; s.step = 'study_mode'; return ctx.reply('تفضّل الدراسة شلون؟', grid([['أونلاين', 'mode:online'], ['حضوري', 'mode:in_person'], ['الاثنين', 'mode:both'], ['نمط آخر ✏️', 'mode:custom']])); }
  if (s.step === 'study_mode_custom') { s.form.study_mode = text; s.step = 'partner_preference'; return ctx.reply('شنو تريد من شريكك أكثر؟', buttons([['مذاكرة فعلية', 'preference:study'], ['التزام ومتابعة', 'preference:accountability'], ['الاثنين', 'preference:both']])); }
  if (s.step === 'goal') { s.form.goal = text; s.step = 'study_focus'; return ctx.reply('شنو تدرس أو تحضّر حالياً؟ اكتب بحرية، مثال: تحضير المعادلة أو امتحان البورد.'); }
  if (s.step === 'study_focus') { s.form.study_focus = text; s.step = 'previous_grades'; return ctx.reply('اكتب تقديراتك بالمرحلة السابقة بحرية. مثال: باطنية جيد، جراحة جيد، فارما جيد جداً.\nاكتب - إذا ما تريد تضيفها.'); }
  if (s.step === 'previous_grades') { s.form.previous_grades = text === '-' ? null : text; return startPreferenceQuestions(ctx, 'register', s.form); }
});

bot.on('photo', async (ctx) => {
  if (ctx.session?.flow !== 'question_add') return;
  const questionSession = await activeQuestionSessionForUser(ctx.session.questionSessionId, ctx.from.id);
  if (!questionSession) { ctx.session = {}; return ctx.reply('الجلسة انتهت أو لم تعد متاحة.', menu); }
  const fileId = ctx.message.photo.at(-1).file_id;
  const body = ctx.message.caption?.trim() || 'سؤال بصورة';
  const item = await sendQuestionItem(ctx, questionSession, { body, attachmentType: 'photo', fileId });
  ctx.session = {};
  if (!item) return ctx.reply('ما انضاف سؤال جديد.', questionSessionKeyboard(questionSession));
  return ctx.reply('تم إرسال صورة السؤال لشريكك ✅', questionSessionKeyboard(questionSession));
});

bot.on('document', async (ctx) => {
  if (ctx.session?.flow !== 'question_add') return;
  const questionSession = await activeQuestionSessionForUser(ctx.session.questionSessionId, ctx.from.id);
  if (!questionSession) { ctx.session = {}; return ctx.reply('الجلسة انتهت أو لم تعد متاحة.', menu); }
  const fileId = ctx.message.document.file_id;
  const body = ctx.message.caption?.trim() || `ملف سؤال: ${ctx.message.document.file_name || 'مرفق'}`;
  const item = await sendQuestionItem(ctx, questionSession, { body, attachmentType: 'document', fileId });
  ctx.session = {};
  if (!item) return ctx.reply('ما انضاف سؤال جديد.', questionSessionKeyboard(questionSession));
  return ctx.reply('تم إرسال ملف السؤال لشريكك ✅', questionSessionKeyboard(questionSession));
});

// Registration callbacks are separate so all selection questions remain button-only.
bot.action(/^gender:(female|male)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.gender = ctx.match[1]; ctx.session.step = 'birth_year'; await ctx.reply('اكتب سنة ميلادك (مثال: 2004):'); });
bot.action('year_custom', async (ctx) => { await ctx.answerCbQuery(); ctx.session.step = 'academic_year_custom'; await ctx.reply('اكتب مرحلتك الدراسية أو الوصف الذي يناسبك:'); });
bot.action(/^year:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.academic_year = ctx.match[1]; ctx.session.step = 'study_time'; await showStudyTimeChoice(ctx); });
bot.action(/^time:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); if (ctx.match[1] === 'custom') { ctx.session.step = 'study_time_custom'; return ctx.reply('اكتب الوقت الذي يناسبك:'); } ctx.session.form.study_time = ctx.match[1]; ctx.session.step = 'learning_style'; await ctx.reply('شنو أسلوبك المفضل؟', buttons([['بصري', 'style:visual'], ['قراءة وكتابة', 'style:reading'], ['نقاش', 'style:discussion'], ['حل أسئلة', 'style:practice']])); });
bot.action(/^style:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.learning_style = ctx.match[1]; ctx.session.step = 'goal'; await ctx.reply('شنو هدفك الأساسي من شريك الدراسة؟ مثال: التزام 3 جلسات بالأسبوع أو تحضير للفاينل'); });
bot.action(/^sessions:(\d+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.sessions_per_week = Number(ctx.match[1]); ctx.session.step = 'session_duration'; await ctx.reply('كم مدة الجلسة التي تفضّلها؟', grid([['25 دقيقة', 'duration:25'], ['50 دقيقة', 'duration:50'], ['ساعة', 'duration:60'], ['ساعة ونصف', 'duration:90'], ['ساعتان', 'duration:120'], ['مدة أخرى ✏️', 'duration:custom']])); });
bot.action(/^duration:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); if (ctx.match[1] === 'custom') { ctx.session.step = 'session_duration_custom'; return ctx.reply('اكتب المدة بالدقائق، من 10 إلى 240:'); } ctx.session.form.session_duration = Number(ctx.match[1]); ctx.session.step = 'study_mode'; await ctx.reply('تفضّل الدراسة شلون؟', grid([['أونلاين', 'mode:online'], ['حضوري', 'mode:in_person'], ['الاثنين', 'mode:both'], ['نمط آخر ✏️', 'mode:custom']])); });
bot.action(/^mode:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); if (ctx.match[1] === 'custom') { ctx.session.step = 'study_mode_custom'; return ctx.reply('اكتب نمط الدراسة الذي تفضّله:'); } ctx.session.form.study_mode = ctx.match[1]; ctx.session.step = 'partner_preference'; await ctx.reply('شنو تريد من شريكك أكثر؟', buttons([['مذاكرة فعلية', 'preference:study'], ['التزام ومتابعة', 'preference:accountability'], ['الاثنين', 'preference:both']])); });
bot.action(/^preference:(.+)$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.partner_preference = ctx.match[1]; ctx.session.step = 'seriousness'; await ctx.reply('قيّم مستوى جديتك بالدراسة:', buttons([['1', 'seriousness:1'], ['2', 'seriousness:2'], ['3', 'seriousness:3'], ['4', 'seriousness:4'], ['5', 'seriousness:5']])); });
bot.action(/^seriousness:([1-5])$/, async (ctx) => { await ctx.answerCbQuery(); ctx.session.form.seriousness = Number(ctx.match[1]); await startAvailabilityQuestions(ctx, ctx.session.flow, ctx.session.form); });

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
async function notifyAvailabilityUpdates() {
  const { data, error } = await db.from('profiles').select('telegram_id').is('available_days', null).is('availability_notified_at', null).limit(500);
  if (error) return console.error('Could not find profiles needing availability updates:', error.message);
  for (const student of data) {
    try {
      await bot.telegram.sendMessage(student.telegram_id, '🗓 حتى نخلي توأمتك أدق، حدّد الأيام والأوقات المتاحة للدراسة.', buttons([['حدّث التوفر', 'update_availability']]));
      await db.from('profiles').update({ availability_notified_at: new Date().toISOString() }).eq('telegram_id', student.telegram_id);
    } catch (error) {
      console.error(`Could not notify availability update for ${student.telegram_id}:`, error.message);
    }
  }
}
async function notifyCallPreferenceUpdates() {
  const { data, error } = await db.from('profiles').select('telegram_id').not('available_days', 'is', null).is('call_preference', null).is('call_preferences_notified_at', null).limit(500);
  if (error) return console.error('Could not find profiles needing call-preference updates:', error.message);
  for (const student of data) {
    try {
      await bot.telegram.sendMessage(student.telegram_id, '🎥 أضفنا تفضيل المكالمة والقراءة بصوت عالٍ حتى نخلي التوأمة أدق.', buttons([['حدّث تفضيلات الجلسات', 'update_availability']]));
      await db.from('profiles').update({ call_preferences_notified_at: new Date().toISOString() }).eq('telegram_id', student.telegram_id);
    } catch (error) {
      console.error(`Could not notify call preference update for ${student.telegram_id}:`, error.message);
    }
  }
}

healthServer.listen(port, '0.0.0.0', () => console.log(`Health check listening on :${port}`));
let shuttingDown = false;
let automationTimer;

async function startBot() {
  try {
    await bot.launch();
    console.log('Twinny bot is running with long polling.');
    await notifyExistingStudents();
    await notifyAvailabilityUpdates();
    await notifyCallPreferenceUpdates();
    await processStudyAutomation().catch((error) => console.error('Study automation failed:', error.message));
    if (!automationTimer) automationTimer = setInterval(() => processStudyAutomation().catch((error) => console.error('Study automation failed:', error.message)), 60_000);
  } catch (error) {
    console.error('Telegram polling stopped; retrying in 30 seconds:', error.message);
    if (!shuttingDown) setTimeout(startBot, 30_000);
  }
}

startBot();
process.once('SIGINT', () => { shuttingDown = true; bot.stop('SIGINT'); });
process.once('SIGTERM', () => { shuttingDown = true; bot.stop('SIGTERM'); });
