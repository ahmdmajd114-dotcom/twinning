# Twinny — توأمك بالدراسة

منصة عربية تساعد الطلاب في العثور على شريك دراسة مناسب حسب التخصص، الجدول، وأسلوب التعلّم، مع بوت تيليغرام يحافظ على خصوصية الاسم الحقيقي.

## التشغيل

```bash
python3 -m http.server 4173
```

ثم افتح `http://localhost:4173`.

## تشغيل البوت

1. أنشئ مشروعاً في Supabase وشغّل محتوى `supabase/schema.sql` من SQL Editor.
2. انسخ `.env.example` إلى `.env` وأضف Token البوت ومفاتيح Supabase.
3. ثبّت الحزم وشغّل البوت:

```bash
npm install
npm start
```

البوت يستخدم long polling؛ لذلك يشتغل على Render أو Railway بدون إعداد Webhook أو دومين في النسخة الأولى.

## النشر على Render

يوجد ملف `render.yaml` جاهز. ارفع المشروع إلى GitHub، ثم من Render اختر **New → Blueprint** واربط المستودع. أضف القيم السرية التالية عند إنشاء الخدمة: `BOT_TOKEN` و`SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`.

تستخدم هذه النسخة خدمة Render المجانية. بعد النشر، أنشئ Cron خارجي يطلب مسار `/health` كل 10 دقائق حتى تبقى الخدمة نشطة.
