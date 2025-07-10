const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class ReservedWordsService {
  constructor() {
    this.filePath = path.resolve(__dirname, '../../reserved_words.txt');
  }

  /**
   * Get reserved words list
   * @returns {Promise<string[]>} Reserved words array
   * @throws {Error} If file reading fails
   */
  async getReservedWords() {
    try {
      logger.debug('Reading reserved words from file:', this.filePath);
      
      const content = await fs.promises.readFile(this.filePath, 'utf8');
      const words = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#')); // Ignore empty lines and comments

      if (!words.length) {
        throw new Error('Reserved words list is empty');
      }

      logger.debug(`Successfully loaded ${words.length} reserved words`);
      return words;

    } catch (error) {
      logger.error('Failed to read reserved words:', error);
      throw new Error('Unable to validate domain: reserved words list is not accessible');
    }
  }
}

// Create singleton instance
const reservedWordsService = new ReservedWordsService();

module.exports = reservedWordsService; 