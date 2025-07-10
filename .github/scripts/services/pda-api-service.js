const axios = require('axios');
const logger = require('../logger');

class PDAApiService {
  constructor() {
    this.baseURL = process.env.PDA_API_URL;
    this.apiKey = process.env.PDA_API_KEY;
    
    if (!this.baseURL) {
      throw new Error('PDA_API_URL environment variable is required');
    }
    
    if (!this.apiKey) {
      throw new Error('PDA_API_KEY environment variable is required');
    }
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Get DNS records for specified zone
   */
  async getZoneRecords(zoneId) {
    try {
      logger.info(`Fetching DNS records for zone: ${zoneId}`);
      const response = await this.client.get(`/api/v1/servers/localhost/zones/${zoneId}/records`);
      logger.info(`Successfully fetched ${response.data.length} records for zone: ${zoneId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch DNS records for zone ${zoneId}:`, error.response?.data || error.message);
      throw new Error(`Failed to fetch DNS records for zone ${zoneId}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create or update NS records (overwrite operation)
   */
  async createNSRecord(zoneId, domain, nameservers) {
    try {
      logger.info(`Creating/updating NS records for ${domain}.${zoneId} with nameservers: ${nameservers.join(', ')}`);
      
      const record = {
        rrsets: [{
          name: `${domain}.${zoneId}.`,
          type: 'NS',
          ttl: 300,
          records: nameservers.map(ns => ({
            content: `${ns}.`,
            disabled: false
          }))
        }]
      };

      await this.client.patch(`/api/v1/servers/localhost/zones/${zoneId}`, record);
      logger.info(`Successfully created/updated NS records for ${domain}.${zoneId}`);
    } catch (error) {
      logger.error(`Failed to create/update NS records for ${domain}.${zoneId}:`, error.response?.data || error.message);
      throw new Error(`Failed to create/update NS records for ${domain}.${zoneId}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete NS records
   */
  async deleteNSRecord(zoneId, domain) {
    try {
      logger.info(`Deleting NS records for ${domain}.${zoneId}`);
      
      const record = {
        rrsets: [{
          name: `${domain}.${zoneId}.`,
          type: 'NS',
          changetype: 'DELETE'
        }]
      };

      await this.client.patch(`/api/v1/servers/localhost/zones/${zoneId}`, record);
      logger.info(`Successfully deleted NS records for ${domain}.${zoneId}`);
    } catch (error) {
      logger.error(`Failed to delete NS records for ${domain}.${zoneId}:`, error.response?.data || error.message);
      throw new Error(`Failed to delete NS records for ${domain}.${zoneId}: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Check if zone exists
   */
  async checkZoneExists(zoneId) {
    try {
      await this.client.get(`/api/v1/servers/localhost/zones/${zoneId}`);
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }


}

module.exports = PDAApiService; 