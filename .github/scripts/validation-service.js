const config = require('./config');
const reservedWordsService = require('./reserved-words');
const sldService = require('./sld-service');
const prService = require('./pr-service');
const logger = require('./logger');
const githubService = require('./github-service');

// Import validators
const nameserversValidator = require('./validators/nameservers');
const agreementsValidator = require('./validators/agreements');
const registrantValidator = require('./validators/registrant');

const titleRegex = /^(Registration|Update|Remove):\s+([a-zA-Z0-9-]+)\.(.+)$/;

/**
 * Validate domain suffix is supported
 */
async function validateDomainSuffix(suffix) {
  const result = { isValid: false, error: null };
  try {
    const supportedSLDs = await sldService.getSupportedSLDs();
    if (!supportedSLDs || !Array.isArray(supportedSLDs)) {
      result.error = 'Unable to validate domain suffix due to SLD list unavailable';
      return result;
    }
    if (!supportedSLDs.includes(suffix)) {
      result.error = `Domain suffix "${suffix}" is not supported. Supported suffixes are: ${supportedSLDs.join(', ')}`;
      return result;
    }
    result.isValid = true;
    return result;
  } catch (error) {
    logger.error('Error occurred while validating domain suffix:', error);
    result.error = `Failed to validate domain suffix: ${error.message}`;
    return result;
  }
}

/**
 * Validate PR title format
 */
async function validateTitle(title) {
  const result = { isValid: false, actionType: null, domainName: null, sld: null, error: null };
  if (!title || typeof title !== 'string') {
    result.error = 'PR title cannot be empty';
    return result;
  }
  const match = title.match(titleRegex);
  if (!match) {
    result.error = `PR title format is incorrect. Correct format should be: "Registration/Update/Remove: {domain-name}.{sld}". Current title: "${title}"`;
    return result;
  }
  const [, actionType, domainName, sldPart] = match;
  const sldValidation = await validateDomainSuffix(sldPart);
  if (!sldValidation.isValid) {
    result.error = sldValidation.error;
    return result;
  }
  result.isValid = true;
  result.actionType = actionType;
  result.domainName = domainName;
  result.sld = sldPart;
  return result;
}

/**
 * Validate PR description length
 */
function validatePRDescription(body) {
    const result = { isValid: false, error: null };

    if (!body || typeof body !== 'string') {
      result.error = 'PR description cannot be empty';
      console.log('PR description validation failed: empty description');
      return result;
    }

    // Define key sections to check
    const requiredSections = {
      'Operation Type': {
        regex: /## Operation Type\s*-\s*\[[\sx]]\s*Registration,\s*Register a new domain name\.\s*-\s*\[[\sx]]\s*Update,\s*Update NS information or registrant email for an existing domain\.\s*-\s*\[[\sx]]\s*Remove,\s*Cancel my domain name\./m,
        error: 'Operation Type section is missing or incomplete. Please select one operation type.'
      },
      'Domain': {
        regex: /## Domain\s*-\s*\[[\sx]]/m,
        error: 'Domain section is missing or incomplete. Please confirm your domain name.'
      },
      'Confirmation Items': {
        regex: /## Confirmation Items(\s*-\s*\[[\sx]].+){9,}/m,  // Ensure at least 9 confirmation items
        error: 'Confirmation Items section is missing or incomplete. All 9 confirmation items must be present.'
      }
    };

    // Check each required section
    const missingParts = [];
    for (const [section, check] of Object.entries(requiredSections)) {
      if (!check.regex.test(body)) {
        missingParts.push(check.error);
        console.log(`PR description validation failed: ${section} section validation failed`);
      }
    }

    // Extract Operation Type section
    const operationTypeMatch = body.match(/## Operation Type([\s\S]*?)(?=##|$)/);
    if (operationTypeMatch) {
      const operationTypePart = operationTypeMatch[1];
      
      // Extract all checkboxes
      const checkboxes = operationTypePart.match(/\[[\sx]]/g) || [];
      const checkedBoxes = checkboxes.filter(box => box === '[x]').length;
      
      // Check if only one operation type is selected
      if (checkedBoxes === 0) {
        missingParts.push('Please select one operation type by checking the corresponding checkbox.');
        logger.debug('No operation type selected');
      } else if (checkedBoxes > 1) {
        missingParts.push('Please select only one operation type. Multiple operation types are selected.');
        logger.debug(`Multiple operation types selected: ${checkedBoxes}`);
      }
    } else {
      missingParts.push('Operation Type section is missing or malformed.');
      logger.debug('Operation Type section not found');
    }

    // Check if all confirmation items are checked
    const confirmationItems = body.match(/\[[\sx]]/g) || [];
    const checkedItems = confirmationItems.filter(item => item === '[x]').length;
    
    // Note: Now we need to judge based on the actual number of checked checkboxes
    // Total should be: 9 confirmation items + 1 domain confirmation + 1 operation type = 11
    if (checkedItems < 11) {
      missingParts.push(`Please check all confirmation items. Only ${checkedItems} of 11 required items are checked.`);
      logger.debug(`Insufficient checked items: ${checkedItems} of 11`);
    }

    if (missingParts.length > 0) {
      result.error = 'PR description validation failed:\n' + missingParts.join('\n');
      return result;
    }

    logger.info('PR description validation passed: all required sections and checkboxes are present');
    result.isValid = true;
    return result;
}

/**
 * Validate file count
 */
function validateFileCount(files) {
  const result = { isValid: false, error: null };
  if (!Array.isArray(files)) {
    result.error = 'Unable to get file change information';
    return result;
  }
  if (files.length === 0) {
    result.error = 'PR must contain at least one file change';
    return result;
  }
  if (files.length > config.validation.maxFileCount) {
    result.error = `PR can only contain 1 file change, currently contains ${files.length} files: ${files.map(f => f.filename).join(', ')}`;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate file path
 */
function validateFilePath(file) {
  const result = { isValid: false, error: null };
  if (!file || !file.filename) {
    result.error = 'Unable to get file information';
    return result;
  }
  if (!config.validation.filePathPattern.test(file.filename)) {
    result.error = `File path is incorrect. File must be located in the whois/ directory and be a .json file. Current file: "${file.filename}"`;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate that domain is not in reserved words list
 */
async function validateDomainNotReserved(domain) {
  const result = { isValid: false, error: null };
  try {
    const reservedWords = await reservedWordsService.getReservedWords();
    const domainLower = domain.toLowerCase();
    for (const reservedWord of reservedWords) {
      if (domainLower === reservedWord.toLowerCase()) {
        result.error = `Domain "${domain}" conflicts with reserved word "${reservedWord}" and cannot be used. Reserved words are used to protect system functions and avoid confusion.`;
        return result;
      }
    }
    result.isValid = true;
    return result;
  } catch (error) {
    logger.error('Error occurred while checking reserved words:', error);
    result.error = error.message;
    return result;
  }
}

/**
 * Validate domain field
 */
async function validateDomainField(domain) {
  const result = { isValid: false, error: null };
  if (!domain || typeof domain !== 'string') {
    result.error = 'domain field is required and must be a string';
    return result;
  }
  if (domain.length < 3) {
    result.error = `domain must be at least 3 characters. Current length: ${domain.length}`;
    return result;
  }
  const domainRegex = /^[a-zA-Z0-9-]+$|^xn--[a-zA-Z0-9-]+$/;
  if (!domainRegex.test(domain)) {
    result.error = `domain must be alphanumeric with hyphens or xn-- format punycode. Current value: "${domain}"`;
    return result;
  }
  if (domain.startsWith('-') || domain.endsWith('-')) {
    result.error = `domain cannot start or end with a hyphen. Current value: "${domain}"`;
    return result;
  }
  const reservedWordsValidation = await validateDomainNotReserved(domain);
  if (!reservedWordsValidation.isValid) {
    result.error = reservedWordsValidation.error;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate sld field
 */
async function validateSldField(sld) {
  const result = { isValid: false, error: null };
  if (!sld || typeof sld !== 'string') {
    result.error = 'sld field is required and must be a string';
    return result;
  }
  const sldValidation = await validateDomainSuffix(sld);
  if (!sldValidation.isValid) {
    result.error = sldValidation.error;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate JSON field content
 */
async function validateJsonFields(jsonData) {
  const result = { isValid: false, error: null };
  const requiredFields = ['registrant', 'domain', 'sld', 'nameservers', 'agree_to_agreements'];
  const missingFields = requiredFields.filter(field => !(field in jsonData));
  if (missingFields.length > 0) {
    result.error = `Missing required fields: ${missingFields.join(', ')}`;
    return result;
  }
  const extraFields = Object.keys(jsonData).filter(field => !requiredFields.includes(field));
  if (extraFields.length > 0) {
    result.error = `Unexpected fields found: ${extraFields.join(', ')}`;
    return result;
  }
  try {
    const validations = [
      { name: 'registrant', result: registrantValidator.validate(jsonData.registrant) },
      { name: 'domain', result: await validateDomainField(jsonData.domain) },
      { name: 'sld', result: await validateSldField(jsonData.sld) },
      { name: 'nameservers', result: nameserversValidator.validate(jsonData.nameservers) },
      { name: 'agree_to_agreements', result: agreementsValidator.validate(jsonData.agree_to_agreements) },
    ];
    for (const v of validations) {
      if (!v.result.isValid) {
        result.error = `Invalid ${v.name}: ${v.result.error}`;
        return result;
      }
    }
    result.isValid = true;
    return result;
  } catch (error) {
    result.error = `Validation error: ${error.message}`;
    return result;
  }
}

/**
 * Validate JSON content format
 */
async function validateJsonContent(file, prData) {
  const result = { isValid: false, error: null, data: null };
  try {
    const fileContent = await prService.getFileContent(file, prData);
    if (!fileContent) {
      result.error = 'Unable to get file content';
      return result;
    }
    try {
      const jsonData = JSON.parse(fileContent);
      if (jsonData === null || typeof jsonData !== 'object' || Array.isArray(jsonData)) {
        result.error = 'JSON file root level must be a non-array object';
        return result;
      }
      const fieldValidation = await validateJsonFields(jsonData);
      if (!fieldValidation.isValid) {
        result.error = fieldValidation.error;
        return result;
      }
      result.isValid = true;
      result.data = jsonData; // Return parsed data on success
      return result;
    } catch (parseError) {
      result.error = `Invalid JSON format: ${parseError.message}`;
      return result;
    }
  } catch (error) {
    result.error = `Error occurred while validating JSON content: ${error.message}`;
    return result;
  }
}

/**
 * Validate PR branch name format
 */
function validateBranchName(branchName, domain, sld) {
  const result = { isValid: false, error: null };
  if (!branchName || typeof branchName !== 'string') {
    result.error = 'Could not determine PR branch name.';
    return result;
  }

  const expectedPrefix = `${domain}.${sld}-request-`;
  const branchRegex = new RegExp(`^${expectedPrefix}\\d+const config = require('./config');
const reservedWordsService = require('./reserved-words');
const sldService = require('./sld-service');
const prService = require('./pr-service');
const logger = require('./logger');
const githubService = require('./github-service');

// Import validators
const nameserversValidator = require('./validators/nameservers');
const agreementsValidator = require('./validators/agreements');
const registrantValidator = require('./validators/registrant');

const titleRegex = /^(Registration|Update|Remove):\s+([a-zA-Z0-9-]+)\.(.+)$/;

/**
 * Validate domain suffix is supported
 */
async function validateDomainSuffix(suffix) {
  const result = { isValid: false, error: null };
  try {
    const supportedSLDs = await sldService.getSupportedSLDs();
    if (!supportedSLDs || !Array.isArray(supportedSLDs)) {
      result.error = 'Unable to validate domain suffix due to SLD list unavailable';
      return result;
    }
    if (!supportedSLDs.includes(suffix)) {
      result.error = `Domain suffix "${suffix}" is not supported. Supported suffixes are: ${supportedSLDs.join(', ')}`;
      return result;
    }
    result.isValid = true;
    return result;
  } catch (error) {
    logger.error('Error occurred while validating domain suffix:', error);
    result.error = `Failed to validate domain suffix: ${error.message}`;
    return result;
  }
}

/**
 * Validate PR title format
 */
async function validateTitle(title) {
  const result = { isValid: false, actionType: null, domainName: null, sld: null, error: null };
  if (!title || typeof title !== 'string') {
    result.error = 'PR title cannot be empty';
    return result;
  }
  const match = title.match(titleRegex);
  if (!match) {
    result.error = `PR title format is incorrect. Correct format should be: "Registration/Update/Remove: {domain-name}.{sld}". Current title: "${title}"`;
    return result;
  }
  const [, actionType, domainName, sldPart] = match;
  const sldValidation = await validateDomainSuffix(sldPart);
  if (!sldValidation.isValid) {
    result.error = sldValidation.error;
    return result;
  }
  result.isValid = true;
  result.actionType = actionType;
  result.domainName = domainName;
  result.sld = sldPart;
  return result;
}

/**
 * Validate PR description length
 */
function validatePRDescription(body) {
    const result = { isValid: false, error: null };

    if (!body || typeof body !== 'string') {
      result.error = 'PR description cannot be empty';
      console.log('PR description validation failed: empty description');
      return result;
    }

    // Define key sections to check
    const requiredSections = {
      'Operation Type': {
        regex: /## Operation Type\s*-\s*\[[\sx]]\s*Registration,\s*Register a new domain name\.\s*-\s*\[[\sx]]\s*Update,\s*Update NS information or registrant email for an existing domain\.\s*-\s*\[[\sx]]\s*Remove,\s*Cancel my domain name\./m,
        error: 'Operation Type section is missing or incomplete. Please select one operation type.'
      },
      'Domain': {
        regex: /## Domain\s*-\s*\[[\sx]]/m,
        error: 'Domain section is missing or incomplete. Please confirm your domain name.'
      },
      'Confirmation Items': {
        regex: /## Confirmation Items(\s*-\s*\[[\sx]].+){9,}/m,  // Ensure at least 9 confirmation items
        error: 'Confirmation Items section is missing or incomplete. All 9 confirmation items must be present.'
      }
    };

    // Check each required section
    const missingParts = [];
    for (const [section, check] of Object.entries(requiredSections)) {
      if (!check.regex.test(body)) {
        missingParts.push(check.error);
        console.log(`PR description validation failed: ${section} section validation failed`);
      }
    }

    // Extract Operation Type section
    const operationTypeMatch = body.match(/## Operation Type([\s\S]*?)(?=##|$)/);
    if (operationTypeMatch) {
      const operationTypePart = operationTypeMatch[1];
      
      // Extract all checkboxes
      const checkboxes = operationTypePart.match(/\[[\sx]]/g) || [];
      const checkedBoxes = checkboxes.filter(box => box === '[x]').length;
      
      // Check if only one operation type is selected
      if (checkedBoxes === 0) {
        missingParts.push('Please select one operation type by checking the corresponding checkbox.');
        logger.debug('No operation type selected');
      } else if (checkedBoxes > 1) {
        missingParts.push('Please select only one operation type. Multiple operation types are selected.');
        logger.debug(`Multiple operation types selected: ${checkedBoxes}`);
      }
    } else {
      missingParts.push('Operation Type section is missing or malformed.');
      logger.debug('Operation Type section not found');
    }

    // Check if all confirmation items are checked
    const confirmationItems = body.match(/\[[\sx]]/g) || [];
    const checkedItems = confirmationItems.filter(item => item === '[x]').length;
    
    // Note: Now we need to judge based on the actual number of checked checkboxes
    // Total should be: 9 confirmation items + 1 domain confirmation + 1 operation type = 11
    if (checkedItems < 11) {
      missingParts.push(`Please check all confirmation items. Only ${checkedItems} of 11 required items are checked.`);
      logger.debug(`Insufficient checked items: ${checkedItems} of 11`);
    }

    if (missingParts.length > 0) {
      result.error = 'PR description validation failed:\n' + missingParts.join('\n');
      return result;
    }

    logger.info('PR description validation passed: all required sections and checkboxes are present');
    result.isValid = true;
    return result;
}

/**
 * Validate file count
 */
function validateFileCount(files) {
  const result = { isValid: false, error: null };
  if (!Array.isArray(files)) {
    result.error = 'Unable to get file change information';
    return result;
  }
  if (files.length === 0) {
    result.error = 'PR must contain at least one file change';
    return result;
  }
  if (files.length > config.validation.maxFileCount) {
    result.error = `PR can only contain 1 file change, currently contains ${files.length} files: ${files.map(f => f.filename).join(', ')}`;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate file path
 */
function validateFilePath(file) {
  const result = { isValid: false, error: null };
  if (!file || !file.filename) {
    result.error = 'Unable to get file information';
    return result;
  }
  if (!config.validation.filePathPattern.test(file.filename)) {
    result.error = `File path is incorrect. File must be located in the whois/ directory and be a .json file. Current file: "${file.filename}"`;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate that domain is not in reserved words list
 */
async function validateDomainNotReserved(domain) {
  const result = { isValid: false, error: null };
  try {
    const reservedWords = await reservedWordsService.getReservedWords();
    const domainLower = domain.toLowerCase();
    for (const reservedWord of reservedWords) {
      if (domainLower === reservedWord.toLowerCase()) {
        result.error = `Domain "${domain}" conflicts with reserved word "${reservedWord}" and cannot be used. Reserved words are used to protect system functions and avoid confusion.`;
        return result;
      }
    }
    result.isValid = true;
    return result;
  } catch (error) {
    logger.error('Error occurred while checking reserved words:', error);
    result.error = error.message;
    return result;
  }
}

/**
 * Validate domain field
 */
async function validateDomainField(domain) {
  const result = { isValid: false, error: null };
  if (!domain || typeof domain !== 'string') {
    result.error = 'domain field is required and must be a string';
    return result;
  }
  if (domain.length < 3) {
    result.error = `domain must be at least 3 characters. Current length: ${domain.length}`;
    return result;
  }
  const domainRegex = /^[a-zA-Z0-9-]+$|^xn--[a-zA-Z0-9-]+$/;
  if (!domainRegex.test(domain)) {
    result.error = `domain must be alphanumeric with hyphens or xn-- format punycode. Current value: "${domain}"`;
    return result;
  }
  if (domain.startsWith('-') || domain.endsWith('-')) {
    result.error = `domain cannot start or end with a hyphen. Current value: "${domain}"`;
    return result;
  }
  const reservedWordsValidation = await validateDomainNotReserved(domain);
  if (!reservedWordsValidation.isValid) {
    result.error = reservedWordsValidation.error;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate sld field
 */
async function validateSldField(sld) {
  const result = { isValid: false, error: null };
  if (!sld || typeof sld !== 'string') {
    result.error = 'sld field is required and must be a string';
    return result;
  }
  const sldValidation = await validateDomainSuffix(sld);
  if (!sldValidation.isValid) {
    result.error = sldValidation.error;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate JSON field content
 */
async function validateJsonFields(jsonData) {
  const result = { isValid: false, error: null };
  const requiredFields = ['registrant', 'domain', 'sld', 'nameservers', 'agree_to_agreements'];
  const missingFields = requiredFields.filter(field => !(field in jsonData));
  if (missingFields.length > 0) {
    result.error = `Missing required fields: ${missingFields.join(', ')}`;
    return result;
  }
  const extraFields = Object.keys(jsonData).filter(field => !requiredFields.includes(field));
  if (extraFields.length > 0) {
    result.error = `Unexpected fields found: ${extraFields.join(', ')}`;
    return result;
  }
  try {
    const validations = [
      { name: 'registrant', result: registrantValidator.validate(jsonData.registrant) },
      { name: 'domain', result: await validateDomainField(jsonData.domain) },
      { name: 'sld', result: await validateSldField(jsonData.sld) },
      { name: 'nameservers', result: nameserversValidator.validate(jsonData.nameservers) },
      { name: 'agree_to_agreements', result: agreementsValidator.validate(jsonData.agree_to_agreements) },
    ];
    for (const v of validations) {
      if (!v.result.isValid) {
        result.error = `Invalid ${v.name}: ${v.result.error}`;
        return result;
      }
    }
    result.isValid = true;
    return result;
  } catch (error) {
    result.error = `Validation error: ${error.message}`;
    return result;
  }
}

);

  if (!branchRegex.test(branchName)) {
    result.error = `PR branch name is invalid. Expected format: "${expectedPrefix}[NUMBER]", but got "${branchName}".`;
    return result;
  }

  result.isValid = true;
  return result;
}

/**
 * Validate title and filename consistency
 */
function validateTitleFileConsistency(titleValidation, fileName) {
  const result = { isValid: false, error: null };
  const fileNameRegex = /^whois\/([^\/]+)\.json$/;
  const fileMatch = fileName.match(fileNameRegex);
  if (!fileMatch) {
    result.error = 'Unable to extract domain information from filename';
    return result;
  }
  const fileBaseName = fileMatch[1];
  const titleDomainFull = `${titleValidation.domainName}.${titleValidation.sld}`;
  if (fileBaseName !== titleDomainFull) {
    result.error = `Domain "${titleDomainFull}" in PR title does not match domain "${fileBaseName}" in filename`;
    return result;
  }
  result.isValid = true;
  return result;
}

/**
 * Validate Remove Operation
 */
async function validateRemoveOperation(file, titleValidation) {
  const result = { isValid: false, error: null };
  try {
    if (file.status !== 'removed') {
      result.error = `For Remove operation, file status must be 'removed', but got '${file.status}'`;
      return result;
    }
    const [owner, repo] = config.github.repository.split('/');
    const fileExists = await githubService.checkFileExists(file.filename, 'main', owner, repo);
    if (!fileExists) {
      result.error = `Cannot remove file '${file.filename}' as it does not exist in the repository`;
      return result;
    }
    const expectedFilename = `whois/${titleValidation.domainName}.${titleValidation.sld}.json`;
    if (file.filename !== expectedFilename) {
      result.error = `File name '${file.filename}' does not match domain in title '${titleValidation.domainName}.${titleValidation.sld}'`;
      return result;
    }
    result.isValid = true;
    return result;
  } catch (error) {
    result.error = `Error validating remove operation: ${error.message}`;
    return result;
  }
}

module.exports = {
  validateTitle,
  validatePRDescription,
  validateFileCount,
  validateFilePath,
  validateJsonContent,
  validateBranchName,
  validateTitleFileConsistency,
  validateRemoveOperation,
};
