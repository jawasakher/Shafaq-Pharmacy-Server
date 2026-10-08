# خطة تنفيذ المرحلة 16: النشر، الحاويات، وتوثيق الواجهات (Phase 16: Dockerization, Swagger & Health Checks)

تستهدف هذه المرحلة تجهيز الخادم للإنتاج (`Production Readiness`) من خلال:
1. إعداد حاويات Docker و Docker Compose (`Dockerfile`, `docker-compose.yml`).
2. توثيق واجهات الـ API باستخدام Swagger / OpenAPI (`@nestjs/swagger`).
3. إضافة فحص الصحة التشغيلي (`Health Check` endpoint).

## Proposed Changes

### 1. توثيق Swagger / OpenAPI
#### [MODIFY] [main.ts](file:///C:/Users/JAWA/WebstormProjects/untitled/shafaq-server/src/main.ts)
- إعداد `@nestjs/swagger` لتوليد وثائق API تلقائية على المسار `/api/docs`.

### 2. فحص الصحة (Health Check)
#### [MODIFY] [app.controller.ts](file:///C:/Users/JAWA/WebstormProjects/untitled/shafaq-server/src/app.controller.ts) & [app.service.ts](file:///C:/Users/JAWA/WebstormProjects/untitled/shafaq-server/src/app.service.ts)
- إضافة مسار `GET /api/v1/health` للتحقق من سلامة الخادم وقاعدة البيانات.

### 3. إعداد Docker و Docker Compose
#### [NEW] `shafaq-server/Dockerfile`
- بناء متعدد المراحل (Multi-stage build) لـ NestJS للإنتاج.

#### [NEW] `shafaq-server/docker-compose.yml`
- تشغيل قاعدة بيانات PostgreSQL وخادم الـ Backend معاً.

---

## Verification Plan

### Automated Tests
- تشغيل اختبارات E2E والتأكد من نجاحها بالكامل:
  `npm --prefix shafaq-server run test:e2e`
- التحقق من البناء:
  `npm --prefix shafaq-server run build`
