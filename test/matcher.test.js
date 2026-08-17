const test = require("node:test");
const assert = require("node:assert/strict");
const { findTopMatches, scoreProfiles } = require("../src/matcher");

const student = {
  telegramId: "1",
  specialty: "طب عام",
  academicYear: "الثالثة",
  subjects: ["تشريح", "فسلجة"],
  days: ["الأحد", "الثلاثاء"],
  preferredTime: "صباحاً",
  studyStyle: "مكالمات",
  commitment: "جاد",
};

test("identical preferences produce a full score", () => {
  const match = scoreProfiles(student, { ...student, telegramId: "2" });
  assert.equal(match.percentage, 100);
  assert.deepEqual(match.sharedSubjects.sort(), ["تشريح", "فسلجه"]);
});

test("matches exclude the current student, sort by score, and limit results", () => {
  const close = { ...student, telegramId: "2", firstName: "سارة" };
  const distant = {
    ...student,
    telegramId: "3",
    firstName: "علي",
    specialty: "هندسة مدنية",
    subjects: ["رياضيات"],
    days: ["الخميس"],
    preferredTime: "ليلاً",
    studyStyle: "شات",
    commitment: "خفيف",
  };
  const results = findTopMatches(student, [student, distant, close], 1);
  assert.equal(results.length, 1);
  assert.equal(results[0].profile.firstName, "سارة");
});
