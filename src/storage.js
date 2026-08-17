const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_FILE = path.join(__dirname, "..", "data", "users.json");

class UserStore {
  constructor(filePath = DEFAULT_FILE) {
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async readAll() {
    try {
      const content = await fs.readFile(this.filePath, "utf8");
      const users = JSON.parse(content);
      return Array.isArray(users) ? users : [];
    } catch (error) {
      if (error.code === "ENOENT") return [];
      if (error instanceof SyntaxError) {
        throw new Error("ملف بيانات المستخدمين غير صالح.");
      }
      throw error;
    }
  }

  async upsert(profile) {
    this.writeQueue = this.writeQueue.then(async () => {
      const users = await this.readAll();
      const index = users.findIndex((user) => user.telegramId === profile.telegramId);
      const safeProfile = {
        telegramId: profile.telegramId,
        firstName: profile.firstName,
        university: profile.university,
        specialty: profile.specialty,
        academicYear: profile.academicYear,
        subjects: profile.subjects,
        days: profile.days,
        preferredTime: profile.preferredTime,
        studyStyle: profile.studyStyle,
        commitment: profile.commitment,
        updatedAt: new Date().toISOString(),
      };

      if (index === -1) users.push(safeProfile);
      else users[index] = safeProfile;

      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const temporaryFile = `${this.filePath}.tmp`;
      await fs.writeFile(temporaryFile, JSON.stringify(users, null, 2), "utf8");
      await fs.rename(temporaryFile, this.filePath);
    });

    return this.writeQueue;
  }
}

module.exports = { UserStore };
