# Kuyruk Sistemi (BullMQ) — Teknik Dokümantasyon

Bu proje arka planda iş çalıştırmak için **BullMQ** kütüphanesini kullanır.
BullMQ, **Redis** üzerine kurulu bir iş kuyruğu sistemidir.

---

## Genel Mimari

```
HTTP İsteği
    │
    ▼
users.service.js          ← Kullanıcı oluşturulur (veritabanına yazılır)
    │
    │  emailQueue.add(...)
    ▼
Redis (BullMQ kuyruğu)    ← İş kuyruğa eklenir, burada bekler
    │
    │  Worker dinler
    ▼
worker.js / email.js      ← İş alınır ve işlenir (e-posta gönderilir)
```

Ana uygulama (`npm run dev`) ile Worker (`npm run worker`) **birbirinden bağımsız iki ayrı process** olarak çalışır.
Aralarındaki tek iletişim noktası Redis'tir.

---

## 1. Job Queue — `src/jobs/queues.js`

**Görevi:** Kuyruğu tanımlar. Uygulama tarafından kullanılır; işleri kuyruğa eklemek için bir "üretici (producer)" görevi görür.

```js
import { Queue } from "bullmq";

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const emailQueue = new Queue("email", { connection });
```

### Ne yapar?

| Satır | Açıklama |
|---|---|
| `new Queue("email", ...)` | Redis'te `"email"` adlı bir kuyruk oluşturur (yoksa otomatik yaratılır) |
| `connection` | Hangi Redis sunucusuna bağlanacağını belirtir; `.env` dosyasından okunur |
| `emailQueue.add(...)` | Kuyruğa yeni bir iş (job) ekler — bu çağrı `users.service.js` içinden yapılır |

### Kuyruğa iş ekleme (service katmanında)

```js
// users.service.js
const user = await withTransaction((client) => usersRepo.insert({ name, email }, client));
await emailQueue.add("welcome", { name: user.name, email: user.email, type: "welcome" });
```

- Kullanıcı **veritabanına kaydedildikten sonra** (transaction kapandıktan sonra) kuyruğa iş eklenir.
- Bu sıralama önemlidir: önce kayıt garantilenir, sonra iş eklenir.
- `"welcome"` iş adıdır. `{ name, email, type }` ise işe ait veridir (job data).

---

## 2. Job Processor — `src/jobs/processors/email.js`

**Görevi:** Kuyruktan alınan bir işin nasıl işleneceğini tanımlar. Saf bir fonksiyondur; ne kuyrukla ne de Worker'la doğrudan bağlantısı vardır.

```js
export async function processEmailJob(job) {
  const { name, email, type } = job.data;
  if (type === "welcome") {
    console.log(`[EmailWorker] Sending welcome email to ${name} <${email}>`);
    // Production: call SendGrid / Nodemailer here
  }
}
```

### Ne yapar?

| Parametre | Açıklama |
|---|---|
| `job` | BullMQ'nun geçirdiği iş nesnesi |
| `job.data` | `emailQueue.add(...)` çağrısında gönderilen veri (`name`, `email`, `type`) |
| `type === "welcome"` | Farklı e-posta türleri için genişletilebilir; şu an sadece hoşgeldin maili desteklenir |

Şu an **simüle** edilmektedir (`console.log`). Gerçek uygulamada bu fonksiyona SendGrid veya Nodemailer entegrasyonu eklenir.

---

## 3. Worker — `src/worker.js`

**Görevi:** Arka planda sürekli çalışan bağımsız bir process'tir. Redis'teki kuyruğu dinler; yeni iş geldiğinde `processEmailJob` fonksiyonunu çağırır.

```js
import { Worker } from "bullmq";
import { processEmailJob } from "./jobs/processors/email.js";

const emailWorker = new Worker("email", processEmailJob, { connection });

emailWorker.on("completed", (job) => console.log(`[EmailWorker] Job ${job.id} completed`));
emailWorker.on("failed", (job, err) => console.error(`[EmailWorker] Job ${job.id} failed:`, err.message));
```

### Ne yapar?

| Satır | Açıklama |
|---|---|
| `new Worker("email", processEmailJob, ...)` | `"email"` kuyruğunu dinler; iş gelince `processEmailJob`'u çağırır |
| `on("completed", ...)` | İş başarıyla tamamlandığında loglama yapar |
| `on("failed", ...)` | İş hata verirse hata mesajını loglar |
| `dotenv.config()` | `.env` dosyasını okur (Redis bağlantı bilgileri için) |

### Worker'ı başlatmak

```bash
# Ayrı bir terminal penceresinde:
npm run worker
```

Başarılı başlangıçta şu mesajı görürsünüz:
```
[EmailWorker] Worker started...
```

---

## Tam Akış — Bir İstek Geldiğinde Ne Olur?

```
1. POST /api/v1/users  →  { name: "Ali", email: "ali@example.com" }

2. users.service.js:
   - Validasyon yapılır
   - withTransaction: users tablosuna INSERT çalışır
   - Kullanıcı veritabanına kaydedilir ✓

3. emailQueue.add("welcome", { name: "Ali", email: "ali@example.com", type: "welcome" })
   - Redis'e iş eklenir
   - HTTP yanıtı kullanıcıya döner (201 Created) — bekleme yok ✓

4. worker.js (arka planda):
   - Redis'ten işi alır
   - processEmailJob çağrılır
   - "[EmailWorker] Sending welcome email to Ali <ali@example.com>" loglanır
   - İş tamamlanır → "[EmailWorker] Job 1 completed"
```

Kullanıcı isteği **e-postanın gönderilmesini beklemez.** Bu, kuyruk sisteminin temel avantajıdır.

---

## Ortam Değişkenleri

`.env` dosyanıza şunları ekleyin (`.env.example`'dan kopyalayabilirsiniz):

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

Redis yoksa Docker ile hızlıca başlatabilirsiniz:

```bash
docker run -p 6379:6379 redis
```

---

## Özet Tablo

| Dosya | Rol | Kim kullanır? |
|---|---|---|
| `src/jobs/queues.js` | Kuyruğu tanımlar, iş ekler | `users.service.js` (uygulama) |
| `src/jobs/processors/email.js` | İşi nasıl yapacağını bilir | `worker.js` |
| `src/worker.js` | Kuyruğu dinler, processor'ı tetikler | Ayrı process (`npm run worker`) |
