# دليل النشر النهائي - NERVE E-Commerce Platform

**النسخة:** 1.0.0  
**التاريخ:** 2026-10-04  
**الحالة:** ✅ جاهز للنشر

---

## 📋 **الخطوات المطلوبة**

### 1️⃣ **التحقق من البيئة**

```bash
# التحقق من Node.js
node --version  # يجب أن يكون >=22.12.0

# التحقق من npm
npm --version

# التحقق من supabase CLI (اختياري)
supabase --version
```

---

### 2️⃣ **تطبيق المigrations**

#### الطريقة 1: عبر Supabase CLI (موصى بها)

```bash
# ربط المشروع
supabase link --project-ref <your-project-ref>

# تطبيق جميع migrations
supabase db push --linked --include-all

# التحقق من التطبيق
supabase db diff --linked
```

#### الطريقة 2: عبر SQL Editor في Supabase Dashboard

1. افتح Supabase Dashboard
2. انتقل إلى SQL Editor
3. افتح كل migration من `supabase/migrations/`
4. نفذ بالترتيب: 001، 002، ..., 058
5. تحقق من النجاح لكل migration

#### التحقق من المigrations

```sql
-- التحقق من جميع migrations
SELECT * FROM supabase_migrations.migrations ORDER BY name;

-- التحقق من migrations المطبقة
SELECT name FROM supabase_migrations.migrations 
WHERE applied = true 
ORDER BY name;
```

---

### 3️⃣ **إنشاء Admin User**

#### الطريقة 1: SQL Command

```bash
# عبر psql
psql -d postgres -c "INSERT INTO admin_users (user_id, role) VALUES ('your-uuid-here', 'super_admin');"

# أو عبر SQL Editor في Supabase Dashboard
INSERT INTO admin_users (user_id, role) 
VALUES ('your-uuid-here', 'super_admin');
```

#### الطريقة 2: via Supabase Dashboard

1. افتح Supabase Dashboard
2. اذهب إلى **Authentication** → **Users**
3. انسخ UUID للمستخدم
4. نفذ SQL command أعلاه (استبدل `your-uuid-here`)

#### التحقق من Admin User

```sql
-- التحقق من وجود admin user
SELECT * FROM admin_users;

-- التحقق من صلاحيات
SELECT 
  au.user_id,
  au.role,
  u.email,
  u.created_at
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id;
```

---

### 4️⃣ **إعداد Environment Variables**

#### Supabase (في Vercel Dashboard)

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Resend (via Supabase Secrets)

```bash
# عبر Supabase CLI
supabase secrets set RESEND_API_KEY=your-resend-api-key
supabase secrets set RESEND_FROM_EMAIL="NERVE <orders@yourdomain.com>"
supabase secrets set STORE_URL=https://www.nerveey.shop

# أو عبر Supabase Dashboard
# Settings → Environment Variables
```

#### Sentry (اختياري - للتتبع)

```
VITE_SENTRY_DSN=your-sentry-dsn
```

---

### 5️⃣ **بناء ونشر**

#### الطريقة 1: عبر Vercel CLI

```bash
# Build
npm run build

# Deploy
vercel --prod

# التحقق من النشر
vercel ls
```

#### الطريقة 2: عبر Vercel Dashboard

1. افتح [vercel.com](https://vercel.com)
2. اذهب إلى Your Projects
3. اختر مشروع NERVE
4. اضغط **Deployments**
5. اضغط **Redeploy** أحدث deployment

---

### 6️⃣ **التحقق من النشر**

#### التحقق 1: Home Page

```
https://www.nerveey.shop
```

**الاختبارات:**
- ✅ تحميل الصفحة
- ✅ عرض المنتجات
- ✅ تحميل الصور
- ✅ Navigation يعمل

#### التحقق 2: Admin Dashboard

```
https://www.nerveey.shop/admin
```

**الاختبارات:**
- ✅ التحقق من رفض الوصول (غير مسجل دخول)
- ✅ تسجيل الدخول كـ admin
- ✅ التحقق من عرض dashboard
- ✅ التحقق من analytics data
- ✅ التحقق من CRUD operations

#### التحقق 3: Checkout Flow

**الاختبارات:**
1. أضف منتج للسلة
2. اضغط checkout
3. أكمل المعلومات (email, phone, address)
4. اختر delivery method
5. أكمل الطلب
6. التحقق من email confirmation

---

### 7️⃣ **التحقق من الميزات**

#### Admin Features

```sql
-- التحقق من analytics functions
SELECT * FROM get_dashboard_overview(
  NOW() - INTERVAL '7 days',
  NOW(),
  NOW() - INTERVAL '7 days',
  NOW()
);

-- التحقق من best sellers
SELECT * FROM get_best_sellers(5);

-- التحقق من order status distribution
SELECT * FROM get_order_status_distribution_rpc(
  NOW() - INTERVAL '30 days',
  NOW()
);
```

#### Security

```sql
-- التحقق من RLS
SET ROLE anon;
SELECT * FROM admin_users;  -- يجب أن يفشل

SET ROLE authenticated;
SELECT * FROM admin_users;  -- يجب أن يفشل (إلا إذا admin)

-- التحقق من admin access
-- (يجب أن يعمل من admin user فقط)
```

---

## 🚨 **الأخطاء المحتملة والحلول**

### الخطأ 1: Admin Access Denied

**السبب:** لم يتم إنشاء admin user

**الحل:**
```sql
-- إنشاء admin user
INSERT INTO admin_users (user_id, role) 
VALUES ('your-uuid-here', 'super_admin');

-- التحقق
SELECT * FROM admin_users;
```

### الخطأ 2: Analytics Showing No Data

**السبب:** لا توجد طلبات أو بيانات

**الحل:**
- أكمل طلب تجريبي
- تحقق من إعدادات analytics
- انتظر 5-10 دقائق لظهور البيانات

### الخطأ 3: Email Not Sending

**السبب:** Resend API Key غير صحيحة أو منتهية

**الحل:**
1. تحقق من Resend API Key
2. تحقق من Re-send FROM Email
3. تحقق من Supabase secrets

```bash
# التحقق من secrets
supabase secrets list
```

### الخطأ 4: Migration Already Applied

**السبب:** Migration تم تطبيقها سابقاً

**الحل:**
```bash
# تخطي migration
supabase db push --linked --include-all --force-reset
```

---

## 📊 **التحقق من الصحة**

### Checklist ما قبل النشر

- [ ] تطبيق جميع migrations (001-058)
- [ ] إنشاء admin user
- [ ] إعداد environment variables
- [ ] بناء المشروع بدون أخطاء
- [ ] اختبار all flows
- [ ] اختبار admin dashboard
- [ ] اختبار checkout flow
- [ ] اختبار email notifications
- [ ] اختبار analytics

### Checklist بعد النشر

- [ ] Home page يعمل
- [ ] Admin dashboard يعمل
- [ ] Analytics يعمل
- [ ] Checkout يعمل
- [ ] Email notifications يعمل
- [ ] Monitoring يعمل (Sentry)
- [ ] Logs يتم جمعها

---

## 🛠️ **الصيانة اليومية**

### مراقبة الأداء

```bash
# التحقق من الأخطاء
vercel logs

# التحقق من الموارد
vercel stats
```

### نسخ احتياطي

```bash
# نسخ احتياطي قاعدة البيانات
supabase db dump --file=backup.sql

# استعادة
supabase db restore --file=backup.sql
```

### تحديثات

```bash
# تحديث dependencies
npm update

# إعادة النشر
npm run build
vercel --prod
```

---

## 📞 **الدعم**

### للمشاكل الفنية

- افتح issue على GitHub
- تحقق من logs
- راجع documentation

### للمشاكل الأمنية

- تحقق من RLS policies
- راجع admin authorization
- تحقق من rate limiting

### للمشاكل في النشر

- راجع Vercel logs
- تحقق من environment variables
- تحقق من Supabase connection

---

## 📁 **الملفات المهمة**

| الملف | الوصف |
|-------|-------|
| `CHANGELOG.md` | سجل التغييرات |
| `REPORT.md` | تقرير المراجعة |
| `docs/REFACTORING_NOTES.md` | ملاحظات الإصلاح |
| `DEPLOYMENT_GUIDE.md` | هذا الملف |

---

## ✅ **النجاح**

عند اكتمال جميع الخطوات، سيكون المشروع:

- ✅ **آمن:** RLS، admin auth، rate limiting
- ✅ **سريع:** server-side aggregations، فهارس محسنة
- ✅ **موثوق:** idempotency، validation
- ✅ **قابل للصيانة:** documentation، testing
- ✅ **قابل للتطوير:** clean code، architecture

---

**تم الإعداد بواسطة:** Kiro  
**التاريخ:** 2026-10-04  
**النسخة:** 1.0.0  
**الحالة:** ✅ جاهز للنشر