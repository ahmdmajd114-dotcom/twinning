const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { UserStore } = require("../src/storage");

test("storage creates, updates, and omits contact details", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "rifqa-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const store = new UserStore(path.join(directory, "users.json"));
  const profile = {
    telegramId: "123",
    firstName: "نور",
    university: "جامعة بغداد",
    specialty: "طب عام",
    academicYear: "الثالثة",
    subjects: ["تشريح"],
    days: ["الأحد"],
    preferredTime: "صباحاً",
    studyStyle: "مكالمات",
    commitment: "جاد",
    username: "must_not_be_stored",
    phoneNumber: "must_not_be_stored",
  };

  await store.upsert(profile);
  await store.upsert({ ...profile, firstName: "نورا" });
  const users = await store.readAll();

  assert.equal(users.length, 1);
  assert.equal(users[0].firstName, "نورا");
  assert.equal(users[0].username, undefined);
  assert.equal(users[0].phoneNumber, undefined);
});
