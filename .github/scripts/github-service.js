const { Octokit } = require('@octokit/rest');
const logger = require('./logger');

class GitHubService {
  constructor() {
    if (!process.env.MY_GITHUB_TOKEN) {
      throw new Error('MY_GITHUB_TOKEN environment variable is required');
    }
    
    this.octokit = new Octokit({
      auth: process.env.MY_GITHUB_TOKEN
    });
  }

  /**
   * 检查文件是否存在于指定分支
   */
  async checkFileExists(filePath, branch, owner, repo) {
    try {
      await this.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: branch
      });
      return true;
    } catch (error) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取文件内容
   */
  async getFileContent(filePath, ref, owner, repo) {
    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref
      });

      // 如果是文件
      if (!Array.isArray(response.data)) {
        // GitHub API 返回的是 base64 编码的内容
        const content = Buffer.from(response.data.content, 'base64').toString();
        return content;
      }

      throw new Error('Path points to a directory, not a file');
    } catch (error) {
      logger.error(`Failed to get file content for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * 更新 PR 标签
   */
  async updatePullRequestLabels(prNumber, labels, owner, repo) {
    try {
      await this.octokit.issues.setLabels({
        owner,
        repo,
        issue_number: prNumber,
        labels
      });
    } catch (error) {
      logger.error(`Failed to update PR labels for PR #${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * 获取 PR 信息
   */
  async getPullRequest(prNumber, owner, repo) {
    try {
      const { data: pullRequest } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });
      return pullRequest;
    } catch (error) {
      logger.error(`Failed to get PR info for PR #${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * 获取 PR 文件列表
   */
  async getPullRequestFiles(prNumber, owner, repo) {
    try {
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber
      });
      return files;
    } catch (error) {
      logger.error(`Failed to get PR files for PR #${prNumber}:`, error);
      throw error;
    }
  }

  /**
   * 创建 commit 状态
   */
  async createCommitStatus(sha, state, description, context, owner, repo) {
    try {
      await this.octokit.repos.createCommitStatus({
        owner,
        repo,
        sha,
        state,
        description: description.substring(0, 140), // GitHub API 限制描述长度为 140 字符
        context
      });
    } catch (error) {
      logger.error(`Failed to create commit status for SHA ${sha}:`, error);
      throw error;
    }
  }
}

module.exports = new GitHubService(); 