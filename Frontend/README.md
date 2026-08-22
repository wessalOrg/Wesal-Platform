# Wesal Frontend

Next.js + React + TypeScript + Tailwind CSS.

## التشغيل

```bash
cd Frontend
npm install
npm run dev
```

يفتح عادة على: http://localhost:3000

## الأوامر

| الأمر | الوظيفة |
|---|---|
| `npm run dev` | تشغيل التطوير |
| `npm run build` | بناء للإنتاج |
| `npm run start` | تشغيل نسخة الإنتاج |
| `npm run lint` | فحص الكود |

## البنية

```
src/
  app/          # الصفحات والـ layout
  lib/api.ts    # عميل Axios للـ API
```

انسخ `.env.example` إلى `.env.local` وعدّل `NEXT_PUBLIC_API_BASE_URL` عند جاهزية الـ backend.

## Documentation

ملفات توثيق الفرونت موجودة في [`docs/`](./docs/).

- **Brand colors:** [`docs/wesal-brand-colors.md`](./docs/wesal-brand-colors.md) / [`docs/wesal-brand-colors.pdf`](./docs/wesal-brand-colors.pdf)


مجلد `documentation/` في جذر المشروع مخصّص لشغل الـ QA — لا يُستخدم لملفات الفرونت.
