const { AppDataSource } = require("../models/data-source");

class Database {
  static getDataSource() {
    return AppDataSource;
  }

  static async initialize() {
    return await AppDataSource.initialize();
  }

  static getRepository(entityName) {
    return AppDataSource.getRepository(entityName);
  }
}

module.exports = Database;
