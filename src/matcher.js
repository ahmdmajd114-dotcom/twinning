const normalize = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ");

const tokenize = (value) =>
  new Set(
    (Array.isArray(value) ? value : value.split(/[,،]/))
      .flatMap((item) => normalize(item).split(" "))
      .filter((item) => item.length > 1),
  );

const intersection = (left, right) => [...left].filter((item) => right.has(item));

function specialtySimilarity(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (a === b) return 1;
  const common = intersection(tokenize(a), tokenize(b));
  return common.length ? 0.65 : 0;
}

function setSimilarity(left, right) {
  const a = tokenize(left);
  const b = tokenize(right);
  if (!a.size || !b.size) return 0;
  return intersection(a, b).length / Math.min(a.size, b.size);
}

function scoreProfiles(student, candidate) {
  const specialty = specialtySimilarity(student.specialty, candidate.specialty);
  const year = normalize(student.academicYear) === normalize(candidate.academicYear) ? 1 : 0;
  const subjects = setSimilarity(student.subjects, candidate.subjects);
  const days = setSimilarity(student.days, candidate.days);
  const time = normalize(student.preferredTime) === normalize(candidate.preferredTime) ? 1 : 0;
  const style = normalize(student.studyStyle) === normalize(candidate.studyStyle) ? 1 : 0;
  const commitment = normalize(student.commitment) === normalize(candidate.commitment) ? 1 : 0;

  const percentage = Math.round(
    specialty * 25 + year * 15 + subjects * 20 + days * 10 + time * 5 + style * 15 + commitment * 10,
  );

  const sharedSubjects = intersection(tokenize(student.subjects), tokenize(candidate.subjects));
  return { profile: candidate, percentage, sharedSubjects };
}

function findTopMatches(student, allUsers, limit = 3) {
  return allUsers
    .filter((candidate) => candidate.telegramId !== student.telegramId)
    .map((candidate) => scoreProfiles(student, candidate))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, limit);
}

module.exports = { findTopMatches, normalize, scoreProfiles };
