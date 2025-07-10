const DNSRecordManager = require('./services/dns-record-manager');
const FileUtils = require('./utils/file-utils');
const logger = require('./logger');

class DNSSyncHandler {
  constructor() {
    this.dnsManager = new DNSRecordManager();
  }

  /**
   * Main handler function
   */
  async handlePRMerge() {
    try {
      logger.info('Starting DNS sync process for merged PR');
      
      // Get environment variables
      const prTitle = process.env.PR_TITLE;
      const prFiles = process.env.PR_FILES;
      
      if (!prTitle) {
        throw new Error('PR_TITLE environment variable is required');
      }
      
      if (!prFiles) {
        throw new Error('PR_FILES environment variable is required');
      }
      
      logger.info(`Processing PR: ${prTitle}`);
      
      // Parse PR file changes
      const files = JSON.parse(prFiles);
      const whoisFile = FileUtils.extractWhoisFiles(files);
      
      logger.info(`Found whois file: ${whoisFile.filename}`);
      
      // Read whois file content
      const whoisData = await FileUtils.readWhoisFile(whoisFile.filename);
      
      // Execute DNS sync operation
      const result = await this.dnsManager.handlePRMerge(prTitle, whoisData);
      
      // Write result file
      await FileUtils.writeResultFile(result);
      
      logger.info('DNS sync process completed successfully');
      return result;
      
    } catch (error) {
      logger.error('DNS sync process failed:', error);
      
      // Write error result
      const errorResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      await FileUtils.writeResultFile(errorResult);
      throw error;
    }
  }
}

// If running this script directly
if (require.main === module) {
  const handler = new DNSSyncHandler();
  
  handler.handlePRMerge()
    .then(result => {
      logger.info('DNS sync completed successfully:', result);
      process.exit(0);
    })
    .catch(error => {
      logger.error('DNS sync failed:', error);
      process.exit(1);
    });
}

module.exports = DNSSyncHandler; 