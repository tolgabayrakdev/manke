# Test Dokümantasyonu

Bu dokümanda projedeki unit ve integration testlerinin nasıl yapılandırıldığı, hangi araçların kullanıldığı ve testlerin nasıl yazıldığı açıklanmaktadır.

---

## Kullanılan Araçlar

| Araç | Sürüm | Amaç |
|------|-------|-------|
| [Vitest](https://vitest.dev) | 4.0.18 | Test runner |
| [@vitest/coverage-v8](https://vitest.dev/guide/coverage) | 4.0.18 | Kod kapsam raporu |
| [Supertest](https://github.com/ladjs/supertest) | ^7.0.0 | HTTP endpoint testi |

---

## Proje Yapısı

```
backend/
├── src/
│   ├── app.js                  ← Express uygulaması (export)
│   ├── server.js               ← Sunucuyu başlatır (listen)
│   ├── database.js             ← pg Pool + withTransaction
│   ├── errors/appError.js      ← Özel hata sınıfları
│   ├── middleware/
│   │   └── errorHandler.js     ← Global hata yakalayıcı
│   ├── repository/users.js     ← Ham SQL sorguları
│   ├── service/users.js        ← İş mantığı
│   ├── controller/users.js     ← HTTP req/res
│   └── routes/users.js         ← Route tanımları
└── tests/
    ├── unit/
    │   └── users.service.test.js
    └── integration/
        └── users.api.test.js
```

### `app.js` ve `server.js` Ayrımı

Testlerde Express uygulamasını import edebilmek için `app.listen()` çağrısı `app.js`'den ayrılmıştır. Bu sayede test dosyaları sunucuyu başlatmadan uygulamayı kullanabilir.

```js
// src/app.js — sadece uygulamayı export eder
export default app;

// src/server.js — sunucuyu başlatır
import app from "./app.js";
app.listen(1234, () => console.log("Server is running on http://localhost:1234"));
```

---

## Katmanlı Test Stratejisi

Her katman bağımsız olarak test edilir. Alt katmanlar mock'lanarak sadece ilgili katmanın davranışı doğrulanır.

```
Controller
    ↓  (mock: service)       ← Integration test
Service
    ↓  (mock: repository + withTransaction)  ← Unit test
Repository
    ↓
Veritabanı
```

---

## Unit Test — Service Katmanı

**Dosya:** `tests/unit/users.service.test.js`

### Amaç

Service katmanının iş mantığını (validasyon, hata fırlatma, transaction kullanımı) veritabanına bağlanmadan test etmek.

### Neleri Mock'larız?

- `repository/users.js` — tüm fonksiyonlar `vi.fn()` ile mock'lanır
- `database.js` — `withTransaction` doğrudan callback'i çalıştıracak şekilde mock'lanır

```js
vi.mock("../../src/repository/users.js");
vi.mock("../../src/database.js", () => ({
  default: {},
  withTransaction: vi.fn((fn) => fn({})),
}));
```

### Örnek: `getUserById`

```js
describe("getUserById", () => {
  it("kullanıcı bulunursa döner", async () => {
    usersRepo.findById.mockResolvedValue(mockUser);

    const result = await usersService.getUserById(1);

    expect(result).toEqual(mockUser);
    expect(usersRepo.findById).toHaveBeenCalledWith(1);
  });

  it("kullanıcı bulunamazsa NotFoundError fırlatır", async () => {
    usersRepo.findById.mockResolvedValue(null);

    await expect(usersService.getUserById(99)).rejects.toThrow(NotFoundError);
    await expect(usersService.getUserById(99)).rejects.toThrow("User not found");
  });
});
```

### Örnek: `createUser` — Transaction Kontrolü

Transaction'ın doğru kullanıldığını ve validasyon hatasında transaction'ın hiç başlatılmadığını doğrularız.

```js
describe("createUser", () => {
  it("transaction içinde insert yapar ve kullanıcıyı döner", async () => {
    usersRepo.insert.mockResolvedValue(mockUser);

    const result = await usersService.createUser({ name: "Alice", email: "alice@example.com" });

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(usersRepo.insert).toHaveBeenCalledWith(
      { name: "Alice", email: "alice@example.com" },
      {}  // transaction client
    );
    expect(result).toEqual(mockUser);
  });

  it("name eksikse ValidationError fırlatır ve transaction başlatmaz", async () => {
    await expect(
      usersService.createUser({ email: "alice@example.com" })
    ).rejects.toThrow(ValidationError);

    expect(withTransaction).not.toHaveBeenCalled();
  });
});
```

### Test Edilen Durumlar

| Fonksiyon | Test Edilen Durum |
|-----------|------------------|
| `getAllUsers` | Repository'den tüm kullanıcıları döner |
| `getUserById` | Kullanıcı bulunursa döner, bulunamazsa `NotFoundError` |
| `createUser` | Başarılı insert, `name` eksik → `ValidationError`, `email` eksik → `ValidationError` |
| `updateUser` | Başarılı update, kullanıcı yok → `NotFoundError`, alan eksik → `ValidationError` |
| `deleteUser` | Başarılı silme, kullanıcı yok → `NotFoundError` |

---

## Integration Test — API Katmanı

**Dosya:** `tests/integration/users.api.test.js`

### Amaç

HTTP endpoint'lerini uçtan uca test etmek: route → controller → middleware zincirinin doğru çalıştığını, status kodlarının ve response body'nin doğru olduğunu doğrulamak.

### Neleri Mock'larız?

Sadece service katmanı mock'lanır. Router, Controller ve `errorHandler` middleware'i gerçek kodlarıyla çalışır.

```js
vi.mock("../../src/service/users.js");

import request from "supertest";
import app from "../../src/app.js";
```

> `supertest(app)` — uygulamayı bir portta başlatmadan HTTP istekleri gönderir.

### Örnek: `POST /api/users`

```js
describe("POST /api/users", () => {
  it("başarılıysa 201 ve kullanıcıyı döner", async () => {
    usersService.createUser.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/users")
      .send({ name: "Alice", email: "alice@example.com" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(mockUser);
  });

  it("validasyon hatası varsa 400 döner", async () => {
    usersService.createUser.mockRejectedValue(
      new ValidationError("name and email are required")
    );

    const res = await request(app).post("/api/users").send({ name: "Alice" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "name and email are required" });
  });
});
```

### Örnek: `DELETE /api/users/:id`

```js
describe("DELETE /api/users/:id", () => {
  it("başarılıysa 204 döner", async () => {
    usersService.deleteUser.mockResolvedValue(undefined);

    const res = await request(app).delete("/api/users/1");

    expect(res.status).toBe(204);
  });

  it("kullanıcı bulunamazsa 404 döner", async () => {
    usersService.deleteUser.mockRejectedValue(new NotFoundError("User not found"));

    const res = await request(app).delete("/api/users/99");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "User not found" });
  });
});
```

### Test Edilen Endpoint'ler

| Method | Endpoint | Test Edilen Durum |
|--------|----------|------------------|
| GET | `/api/users` | 200 + kullanıcı listesi |
| GET | `/api/users/:id` | 200 bulunursa, 404 bulunamazsa |
| POST | `/api/users` | 201 başarılıysa, 400 validasyon hatası |
| PUT | `/api/users/:id` | 200 başarılıysa, 404 bulunamazsa, 400 validasyon hatası |
| DELETE | `/api/users/:id` | 204 başarılıysa, 404 bulunamazsa |

---

## Global Hata Yakalayıcı (errorHandler)

Controller'larda `try/catch` yoktur. Service'in fırlattığı hatalar Express 5'in async hata yayılımı sayesinde `errorHandler` middleware'ine iletilir.

```js
// src/middleware/errorHandler.js
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
}
```

Integration testleri bu akışı da doğrular: service `NotFoundError` fırlatır → errorHandler yakalar → 404 response döner.

---

## Testleri Çalıştırma

```bash
# Tüm testleri çalıştır
npm test

# Watch modunda çalıştır (geliştirme sırasında)
npm run test:watch

# Kapsam raporu üret
npm run test:coverage
```

### Beklenen Çıktı

```
✓ tests/unit/users.service.test.js    (12 tests)
✓ tests/integration/users.api.test.js (10 tests)

Test Files  2 passed (2)
     Tests  22 passed (22)
```
