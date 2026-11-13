# تغييرات NERVE E-Commerce Platform

جميع التغييرات المهمة في مشروع NERVE سيتم تسجيلها في هذا الملف.

يتم الالتزام بمبدأ [Semantic Versioning](https://semver.org/lang/ar/).

## [1.0.0] - 2026-10-04

### ✅ الإصلاحات الأمنية

#### إصلاح ترقية صلاحية Admin (Migration 058)
- **Type:** أمني / حرجة
- **المشكلة:** عدم وجود admin user مُهيأ بعد تطبيق migrations.
- **الحل:** إضافة migration لتهيئة admin user افتراضي مع UUID قابل للتعديل.
- **الملف:** `supabase/migrations/058_init_admin_user.sql`
- **التأثير:** ضروري لوصول لوحة التحكم

#### تحسينات RLS (Row Level Security)
- **Migration 051:** تقييد صلاحيات `anon` على جدول `customers`
- **Migration 052:** تقييد صلاحيات `anon` على الجداول الخاصة بالعميل والعمليات
- **Migration 053:** تقييد صلاحيات `anon` على حالة العميل والرموز
- **Migration 055:** توحيد policies RLS

#### تحسينات صلاحيات لوحة التحكم
- **Migration 054:** إصلاح صلاحيات `get_dashboard_overview` ووظائف التحليل الأخرى
- إضافة جدول `admin_users` للتحقق من صلاحية admin
- تقييد الوصول إلى التحليلات الحساسة

#### تحسينات rate limiting
- **Migration 011:** distributed rate limiting
- **Migration 08:** authentication rate limiting
- **Migration 056:** server-side rate limiting for analytics

### ✅ تحسينات الأداء

#### تجميعات خادمية
- **Migration 056:** إضافة `get_daily_sales_summary`, `get_best_sellers`, `get_order_status_distribution_rpc`
- نقل التجميعات من العميل إلى الخادم لتحسين الأداء

#### فهارس قاعدة البيانات
- **Migration 040:** فهارس B-tree للمنتجات لتحسين الأداء

### ✅ تحسينات موثوقية النظام

#### إصلاحات place_order
- **Migration 036:** place_order hardening
- دمج الأسطر المكررة قبل التحقق من الحد الأقصى
- حماية滥用 COD للضيوف
- ترتيب أقفال المخزون لمنع deadlocks

#### تحسينات التتبع
- **Migration 027:** إضافة `tracking_number` و `tracking_url` للطلبات
- **Migration 018:** إضافة `idempotency_key` للطلبات

#### إصلاحات متعلقة بالضيوف
- **Migration 014:** hardened guest order RPC
- **Migration 019:** إصلاح صلاحيات `lookup_guest_order`
- **Migration 042:** إصلاح_timing_attack في طلبات الضيوف

### ✅ تحسينات لوحة التحكم

#### RPCs للوحة التحكم
- **Migration 054:** `get_dashboard_overview` مع admin authorization
- **Migration 056:** `get_daily_sales_summary`, `get_best_sellers`, `get_order_status_distribution_rpc`

#### RLS لسجلات Admin
- **Migration 049:** إضافة `admin_activity_log` مع RLS مناسب

### ✅ تحسينات الأمان الشامل

#### تحسينات Admin Authorization
- **Migration 054:** تحقق من admin من جدول `admin_users`
- **Migration 09e7438:** إصلاح AdminLayout للتحقق من admin

#### تحسينات Authentication
- **Migration 016:** Revoking anon access to chatbot RPCs
- **Migration 026:** SECURITY INVOKER views
- **Migration 032:** email_automation cron jobs security

#### تحسينات Input Validation
- **Edge Functions:** التحقق المكثف للمدخلات في `create-order` و `update-order-status`

### ✅ تحسينات تجربة المستخدم

#### تحسينات Checkout
- **Migration 034:** checkout parity و discount honor
- **Migration 036:** place_order hardening

#### تحسينات المراجعات
- **Migration 033:** إضافة `photos` و `helpful_count` للمراجعات

### ✅ تحسينات البرمجيات

#### إصلاحات TypeScript
- **Migration 035:** إصلاح FK repoint في `customers`
- **Migration 037:** إصلاح FK repoint في `customers`

#### تحسينات Code Quality
- تحديث إلى DOMPurify v3.4.14 (إصلاح XSS)
- تحسينات في `create-order` edge function
- تحسينات في `update-order-status` edge function

### ✅ تحسينات التوثيق

#### مستندات جديدة
- **Migration 08c19369:** إضافة `ADMIN_DASHBOARD.md`

### ✅ تحسينات الاختبارات

#### اختبارات Admin Operations
- **Migration 9e743c8:** إصلاح اختبارات AdminLayout

---

## [0.x.x] - قبل الإصلاحات

### الإصدارات السابقة

- إصدارات التطوير الأولية
- إضافة الميزات الأساسية
- إصلاحات أمنية صغيرة
- تحسينات الأداء الأولية

---

## ملاحظات مهمة

### ما قبل النشر

قبل النشر في الإنتاج، تأكد من:

1. ✅ تطبيق جميع migrations (001-058)
2. ⚠️ إنشاء admin user فعلي (استبدل UUID في migration 058)
3. ⚠️ إعداد environment variables (Supabase, Resend, etc.)
4. ⚠️ تفعيل monitoring (Sentry, analytics)
5. ⚠️ اختبار all flows في بيئة staging

### إنشاء Admin User

```bash
# الطريقة 1: عبر SQL
psql -d postgres -c "INSERT INTO admin_users (user_id, role) VALUES ('your-uuid-here', 'super_admin');"

# الطريقة 2: عبر Supabase Dashboard
# 1. اذهب إلى Authentication → Users
# 2. انسخ UUID للمستخدم
# 3. نفذ SQL command أعلاه
```

### التحقق من Admin User

```bash
# التحقق من وجود admin user
psql -d postgres -c "SELECT * FROM admin_users;"

# التحقق من صلاحيات admin
# سجل الدخول كـ admin وتحقق من الوصول لـ /admin
```

---

## دعم واتصال

لأي أسئلة أو مشاكل، يرجى التواصل مع فريق التطوير.

---

**تم التحديث:** 2026-10-04
**تم بواسطة:** Kiro