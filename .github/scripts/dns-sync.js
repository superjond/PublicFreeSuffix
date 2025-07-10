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
  async handleSync() {
    try {
      // Determine trigger type
      const triggerType = this.determineTriggerType();
      logger.info(`Starting DNS sync process for ${triggerType} trigger`);
      
      if (triggerType === 'manual') {
        return await this.handleManualTrigger();
      } else {
        return await this.handlePRMerge();
      }
      
    } catch (error) {
      logger.error('DNS sync process failed:', error);
      
      // Write error result
      const errorResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        triggerType: this.determineTriggerType()
      };
      
      await FileUtils.writeResultFile(errorResult);
      throw error;
    }
  }

  /**
   * Determine trigger type
   */
  determineTriggerType() {
    const manualDomain = process.env.MANUAL_DOMAIN;
    const manualOperation = process.env.MANUAL_OPERATION;
    
    if (manualDomain || manualOperation) {
      return 'manual';
    }
    return 'pr_merge';
  }

  /**
   * Handle manual trigger
   */
  async handleManualTrigger() {
    logger.info('Processing manual DNS sync trigger');
    
    // Get manual trigger parameters
    const domain = process.env.MANUAL_DOMAIN;
    const operation = process.env.MANUAL_OPERATION || 'auto';
    const whoisFile = process.env.MANUAL_WHOIS_FILE;
    const forceSync = process.env.FORCE_SYNC === 'true';
    
    logger.info(`Manual trigger parameters: domain=${domain}, operation=${operation}, whoisFile=${whoisFile}, forceSync=${forceSync}`);
    
    // Validate parameters
    if (!domain && !whoisFile) {
      throw new Error('Either MANUAL_DOMAIN or MANUAL_WHOIS_FILE must be provided for manual trigger');
    }
    
    let whoisData = null;
    let targetDomain = domain;
    
    // If WHOIS file is specified, read data from file
    if (whoisFile) {
      const fullPath = whoisFile.startsWith('whois/') ? whoisFile : `whois/${whoisFile}`;
      logger.info(`Reading WHOIS data from file: ${fullPath}`);
      
      try {
        whoisData = await FileUtils.readWhoisFile(fullPath);
        targetDomain = whoisData.domain;
        logger.info(`Extracted domain from WHOIS file: ${targetDomain}`);
      } catch (error) {
        if (forceSync) {
          logger.warn(`Failed to read WHOIS file ${fullPath}, but continuing due to force sync: ${error.message}`);
        } else {
          throw new Error(`Failed to read WHOIS file ${fullPath}: ${error.message}`);
        }
      }
    }
    
    // If domain is specified but no WHOIS file, try to find corresponding WHOIS file
    if (domain && !whoisData) {
      const domainFile = `whois/${domain}.json`;
      logger.info(`Attempting to read WHOIS file for domain: ${domainFile}`);
      
      try {
        whoisData = await FileUtils.readWhoisFile(domainFile);
        logger.info(`Successfully read WHOIS data for domain: ${domain}`);
      } catch (error) {
        if (forceSync) {
          logger.warn(`Failed to read WHOIS file for domain ${domain}, but continuing due to force sync: ${error.message}`);
        } else {
          throw new Error(`Failed to read WHOIS file for domain ${domain}: ${error.message}`);
        }
      }
    }
    
    // If still no WHOIS data, create basic data based on domain
    if (!whoisData && domain) {
      logger.info(`Creating basic WHOIS data for domain: ${domain}`);
      const domainParts = domain.split('.');
      if (domainParts.length !== 2) {
        throw new Error(`Invalid domain format: ${domain}`);
      }
      
      whoisData = {
        domain: domainParts[0],
        sld: domainParts[1],
        operation: operation
      };
    }
    
    // Execute DNS sync operation
    const result = await this.dnsManager.handleManualSync(
      process.env.PR_TITLE || 'Manual DNS Sync',
      whoisData,
      {
        operation: operation,
        forceSync: forceSync,
        triggeredBy: process.env.GITHUB_ACTOR || 'unknown'
      }
    );
    
    // Write result file
    await FileUtils.writeResultFile(result);
    
    logger.info('Manual DNS sync process completed successfully');
    return result;
  }

  /**
   * Handle PR merge trigger
   */
  async handlePRMerge() {
    logger.info('Processing PR merge DNS sync trigger');
    
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
    logger.info(`Parsed PR files: ${JSON.stringify(files, null, 2)}`);
    
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
  }
}

// If running this script directly
if (require.main === module) {
  const handler = new DNSSyncHandler();
  
  handler.handleSync()
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