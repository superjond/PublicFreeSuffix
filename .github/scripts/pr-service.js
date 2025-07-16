const config = require('./config');
const logger = require('./logger');
const githubService = require('./github-service');

/**
 * Extract file content from patch
 */
function extractContentFromPatch(patch) {
  if (!patch) return null;

  const lines = patch.split('\n');
  const content = [];
  
  for (const line of lines) {
    // Skip patch header information
    if (line.startsWith('@@') || line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }
    
    // Add new lines (starting with +, but not +++)
    if (line.startsWith('+') && !line.startsWith('+++')) {
      content.push(line.substring(1)); // Remove the + sign
    }
  }
  
  return content.join('\n');
}

/**
 * Get file content
 */
async function getFileContent(file, prData) {
  try {
    // For added files, extract content from patch
    if (file.status === 'added' && file.patch) {
      return extractContentFromPatch(file.patch);
    }

    // For modified files, get the latest version
    if (file.status === 'modified') {
      const [owner, repo] = config.github.repository.split('/');
      const content = await githubService.getFileContent(
        file.filename,
        prData.headSha,
        owner,
        repo
      );
      
      return content;
    }

    return null;
  } catch (error) {
    logger.error('Failed to get file content:', error);
    return null;
  }
}

/**
 * Get PR data from environment variables
 */
function getPRDataFromEnv() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH environment variable not set');
  }
  const event = require(eventPath);

  const pr = event.pull_request;
  if (!pr) {
    throw new Error('Could not find pull request data in event payload');
  }

  const files = getChangedFiles();

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body,
    author: pr.user.login,
    branchName: pr.head.ref, // Extract branch name
    files: files
  };
}

module.exports = {
  getPRDataFromEnv,
  getFileContent,
  extractContentFromPatch,
};
