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
      
      logger.info(`Found whois file: ${whoisFile.filename} (status: ${whoisFile.status})`);
      
      // Handle different file statuses
      if (whoisFile.status === 'removed') {
        // For deletion, we need to extract domain info from the filename
        const domain = whoisFile.filename.replace('whois/', '').replace('.json', '');
        logger.info(`Processing deletion for domain: ${domain}`);
        
        // Parse domain to get domain name and sld
        const domainParts = domain.split('.');
        if (domainParts.length !== 2) {
          throw new Error(`Invalid domain format in filename: ${domain}`);
        }
        
        const [domainName, sld] = domainParts;
        
        // Execute DNS deletion operation
        const result = await this.dnsManager.handlePRMerge(prTitle, { 
          domain: domainName, 
          sld: sld,
          operation: 'delete' 
        });
        
        // Write result file
        await FileUtils.writeResultFile(result);
        
        logger.info('DNS deletion process completed successfully');
        return result;
      } else {
        // For registration/update, read the whois file content
        const whoisData = await FileUtils.readWhoisFile(whoisFile.filename);
        
        // Execute DNS sync operation
        const result = await this.dnsManager.handlePRMerge(prTitle, whoisData);
        
        // Write result file
        await FileUtils.writeResultFile(result);
        
        logger.info('DNS sync process completed successfully');
        return result;
      }
      
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