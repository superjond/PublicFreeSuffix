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
        return await this.handleCreateOrUpdate(zoneId, domain, nameservers, operation);
      
      case 'remove':
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
}

module.exports = DNSRecordManager; 