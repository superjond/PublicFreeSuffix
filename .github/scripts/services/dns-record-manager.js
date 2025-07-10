const PDAApiService = require('./pda-api-service');
const logger = require('../logger');

class DNSRecordManager {
  constructor() {
    this.pdaService = new PDAApiService();
  }

  /**
   * Parse PR title to get operation type and domain information
   */
  parsePRTitle(prTitle) {
    const titlePattern = /^(Registration|Update|Remove):\s+([a-zA-Z0-9-]+)\.(.+)$/;
    const match = prTitle.match(titlePattern);
    
    if (!match) {
      throw new Error(`Invalid PR title format: ${prTitle}. Expected format: "Operation: domain.sld"`);
    }
    
    return {
      operation: match[1].toLowerCase(),
      domain: match[2],
      sld: match[3]
    };
  }

  /**
   * Validate whois file data
   */
  validateWhoisData(whoisData) {
    // For delete operations, we only need domain and sld
    if (whoisData.operation === 'delete') {
      const requiredFields = ['domain', 'sld'];
      const missingFields = requiredFields.filter(field => !whoisData[field]);
      
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields in whois data for delete operation: ${missingFields.join(', ')}`);
      }
      
      return true;
    }
    
    // For registration/update operations, we need all fields including nameservers
    const requiredFields = ['domain', 'sld', 'nameservers'];
    const missingFields = requiredFields.filter(field => !whoisData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in whois data: ${missingFields.join(', ')}`);
    }
    
    if (!Array.isArray(whoisData.nameservers) || whoisData.nameservers.length === 0) {
      throw new Error('Nameservers must be a non-empty array');
    }
    
    return true;
  }

  /**
   * Execute DNS record operation
   */
  async executeDNSOperation(operation, whoisData) {
    const { domain, sld, nameservers } = whoisData;
    const zoneId = sld;
    
    logger.info(`Executing ${operation} operation for ${domain}.${zoneId}`);
    
    // Check if zone exists
    const zoneExists = await this.pdaService.checkZoneExists(zoneId);
    if (!zoneExists) {
      throw new Error(`Zone ${zoneId} does not exist in PowerDNS Admin`);
    }
    
    switch (operation) {
      case 'registration':
      case 'update':
      case 'add':
        return await this.handleCreateOrUpdate(zoneId, domain, nameservers, operation);
      
      case 'remove':
      case 'delete':
        return await this.handleRemove(zoneId, domain);
      
      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  }

  /**
   * Handle create or update operation (overwrite operation)
   */
  async handleCreateOrUpdate(zoneId, domain, nameservers, operation) {
    logger.info(`Handling ${operation} for ${domain}.${zoneId}`);
    
    // Directly create or update NS records (overwrite operation)
    await this.pdaService.createNSRecord(zoneId, domain, nameservers);
    
    return {
      success: true,
      message: `Successfully ${operation === 'registration' ? 'registered' : 'updated'} NS records for ${domain}.${zoneId}`,
      operation: operation,
      domain: `${domain}.${zoneId}`,
      nameservers
    };
  }

  /**
   * Handle remove operation
   */
  async handleRemove(zoneId, domain) {
    logger.info(`Handling removal for ${domain}.${zoneId}`);
    
    // Directly delete NS records
    await this.pdaService.deleteNSRecord(zoneId, domain);
    
    return {
      success: true,
      message: `Successfully removed NS records for ${domain}.${zoneId}`,
      operation: 'remove',
      domain: `${domain}.${zoneId}`
    };
  }

  /**
   * Handle DNS sync after PR merge
   */
  async handlePRMerge(prTitle, whoisData) {
    try {
      // Parse PR title
      const { operation } = this.parsePRTitle(prTitle);
      
      // Validate whois data
      this.validateWhoisData(whoisData);
      
      // Execute DNS operation
      const result = await this.executeDNSOperation(operation, whoisData);
      
      logger.info(`DNS operation completed successfully: ${result.message}`);
      return result;
      
    } catch (error) {
      logger.error('DNS operation failed:', error);
      throw error;
    }
  }

  /**
   * Handle manual DNS sync
   */
  async handleManualSync(title, whoisData, options = {}) {
    try {
      const { operation = 'auto', forceSync = false, triggeredBy = 'unknown' } = options;
      
      logger.info(`Processing manual DNS sync: ${title}`);
      logger.info(`Manual sync options: operation=${operation}, forceSync=${forceSync}, triggeredBy=${triggeredBy}`);
      
      // Determine operation type
      let finalOperation = operation;
      if (operation === 'auto') {
        // Auto-detect operation type
        finalOperation = this.detectOperationType(whoisData);
        logger.info(`Auto-detected operation type: ${finalOperation}`);
      }
      
      // Validate WHOIS data
      try {
        this.validateWhoisData(whoisData);
      } catch (error) {
        if (forceSync) {
          logger.warn(`WHOIS data validation failed, but continuing due to force sync: ${error.message}`);
        } else {
          throw error;
        }
      }
      
      // Execute DNS operation
      const result = await this.executeDNSOperation(finalOperation, whoisData);
      
      // Add manual trigger additional information
      result.triggerType = 'manual';
      result.triggeredBy = triggeredBy;
      result.manualOptions = options;
      
      logger.info(`Manual DNS operation completed successfully: ${result.message}`);
      return result;
      
    } catch (error) {
      logger.error('Manual DNS operation failed:', error);
      
      // Return error result instead of throwing exception for better handling
      return {
        success: false,
        error: error.message,
        triggerType: 'manual',
        triggeredBy: options.triggeredBy || 'unknown',
        manualOptions: options,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Auto-detect operation type
   */
  detectOperationType(whoisData) {
    // Check if nameservers field exists to determine if it's add/update or delete
    if (whoisData.nameservers && Array.isArray(whoisData.nameservers) && whoisData.nameservers.length > 0) {
      return 'add'; // Has nameservers means add or update
    } else {
      return 'delete'; // No nameservers means delete
    }
  }

  /**
   * Check if domain exists
   */
  async checkDomainExists(domain, sld) {
    try {
      const zoneId = sld;
      const zoneExists = await this.pdaService.checkZoneExists(zoneId);
      
      if (!zoneExists) {
        return false;
      }
      
      // Check if domain records exist
      const records = await this.pdaService.getDomainRecords(zoneId, domain);
      return records && records.length > 0;
      
    } catch (error) {
      logger.warn(`Error checking domain existence: ${error.message}`);
      return false;
    }
  }

  /**
   * Get domain information
   */
  async getDomainInfo(domain, sld) {
    try {
      const zoneId = sld;
      const records = await this.pdaService.getDomainRecords(zoneId, domain);
      
      return {
        exists: records && records.length > 0,
        records: records || [],
        domain: `${domain}.${zoneId}`
      };
      
    } catch (error) {
      logger.warn(`Error getting domain info: ${error.message}`);
      return {
        exists: false,
        records: [],
        domain: `${domain}.${sld}`,
        error: error.message
      };
    }
  }
}

module.exports = DNSRecordManager; 